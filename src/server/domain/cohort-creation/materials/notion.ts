import 'server-only';
import { z } from 'zod';
import { notionIdSchema, notionRawBlockSchema, notionSnapshotSchema, projectNotionBlock,
  NOTION_API_VERSION, NOTION_LIMITS, type NotionSnapshot } from '@/src/shared/cohort-creation/notion';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';

export interface NotionPageProvider {
  getPage(pageId: string, signal: AbortSignal): Promise<unknown>;
  getChildren(blockId: string, cursor: string | null, signal: AbortSignal): Promise<unknown>;
}
const fail = (message: string): never => { throw new CreationStorageError('INVALID_INPUT', message); };
const limit = (message: string): never => { throw new CreationStorageError('LIMIT_EXCEEDED', `${message}; nothing was truncated.`); };
export function notionPageIdentity(input: string) {
  if (input.length > 2048 || /[\u0000-\u0020\u007f\\%]/.test(input)) return fail('Provide a Notion page URL without a block fragment.');
  let url: URL; try { url = new URL(input); } catch { return fail('Provide a Notion page URL.'); }
  if (url.protocol !== 'https:' || !['notion.so', 'www.notion.so'].includes(url.hostname) || url.username || url.password || url.port || url.hash) return fail('Use a notion.so page link without a block fragment.');
  const tail = url.pathname.split('/').at(-1) ?? '';
  const match = /(?:^|-)([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.exec(tail);
  if (!match) return fail('The Notion page link must include its page ID.');
  const compact = match[1].replaceAll('-', '').toLowerCase();
  const id = notionIdSchema.parse(`${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`);
  return { pageId: id, url: `https://www.notion.so/${compact}` };
}
const pageSchema = z.object({ object: z.literal('page'), id: notionIdSchema, archived: z.boolean(), in_trash: z.boolean().optional(),
  last_edited_time: z.iso.datetime(), properties: z.record(z.string(), z.unknown()) });
const listSchema = z.object({ object: z.literal('list'), has_more: z.boolean(), next_cursor: z.string().min(1).max(1024).nullable(),
  results: z.array(notionRawBlockSchema).max(100) });
const titleSchema = z.object({ type: z.literal('title'), title: z.array(z.object({ plain_text: z.string() })).max(100) });

/** Observes supported text from one page; Notion does not provide an atomic immutable export. */
export class NotionMaterialReader {
  constructor(private readonly provider: NotionPageProvider) {}
  async read(input: string, callerSignal?: AbortSignal): Promise<NotionSnapshot> {
    const identity = notionPageIdentity(input);
    const signal = AbortSignal.any([...(callerSignal ? [callerSignal] : []), AbortSignal.timeout(120_000)]);
    let calls = 0;
    const call = async <T extends z.ZodType>(schema: T, operation: () => Promise<unknown>): Promise<z.output<T>> => {
      signal.throwIfAborted(); if (++calls > NOTION_LIMITS.requests) return limit('Notion scope exceeds 250 requests. Select a smaller page');
      const value = await operation(); signal.throwIfAborted(); const parsed = schema.safeParse(value);
      if (!parsed.success) return fail('Notion returned incomplete or unsupported page data.');
      return parsed.data;
    };
    const page = await call(pageSchema, () => this.provider.getPage(identity.pageId, signal));
    if (page.id !== identity.pageId || page.archived || page.in_trash) return fail('The selected Notion page is unavailable or archived.');
    const title = Object.values(page.properties).map(value => titleSchema.safeParse(value)).find(value => value.success);
    const titleText = title?.success ? title.data.title.map(item => item.plain_text).join('') : '';
    if (titleText.length > 2000) return limit('Notion title exceeds 2,000 characters');
    const blocks: NotionSnapshot['blocks'] = []; const ids = new Set<string>([identity.pageId]); let textBytes = 0; let rawBytes = 0;
    const walk = async (parentId: string, depth: number): Promise<void> => {
      if (depth > NOTION_LIMITS.depth) return limit('Notion nesting exceeds eight levels. Select a shallower page');
      const cursors = new Set<string>(); let cursor: string | null = null;
      for (;;) {
        const list = await call(listSchema, () => this.provider.getChildren(parentId, cursor, signal));
        if (list.has_more !== (list.next_cursor !== null) || list.has_more && !list.results.length) return fail('Notion pagination is incomplete. Retry the page.');
        for (const raw of list.results) {
          if (ids.has(raw.id) || raw.parent[raw.parent.type] !== parentId || raw.archived || raw.in_trash) return fail('Notion block hierarchy changed or contains duplicate IDs. Retry the page.');
          if (blocks.length >= NOTION_LIMITS.blocks) return limit('Notion page exceeds 2,000 blocks. Select a smaller page');
          const projected = projectNotionBlock(raw);
          textBytes += Buffer.byteLength(projected.text); rawBytes += Buffer.byteLength(JSON.stringify(raw));
          if (textBytes > MATERIAL_LIMITS.extractedTextBytes) return limit('Notion text exceeds 1 MiB. Select a smaller page');
          if (rawBytes > NOTION_LIMITS.snapshotBytes) return limit('Notion retained blocks exceed 8 MiB. Select a smaller page');
          blocks.push({ id: raw.id, parentId, depth, raw, ...projected }); ids.add(raw.id);
          if (raw.has_children && projected.disposition !== 'omitted') {
            const before = blocks.length;
            await walk(raw.id, depth + 1);
            if (blocks.length === before) return fail('Notion child content is incomplete or changed. Retry the page.');
          }
        }
        if (!list.has_more) break;
        if (!list.next_cursor || cursors.has(list.next_cursor)) return fail('Notion returned a repeated pagination cursor. Retry the page.');
        cursor = list.next_cursor; cursors.add(cursor);
      }
    };
    await walk(identity.pageId, 1);
    const current = await call(pageSchema, () => this.provider.getPage(identity.pageId, signal));
    if (current.id !== page.id || current.last_edited_time !== page.last_edited_time || current.archived || current.in_trash ||
      JSON.stringify(current.properties) !== JSON.stringify(page.properties)) return fail('The Notion page changed while reading. Retry after editing is finished.');
    if (!blocks.some(block => block.text.trim())) return fail('This Notion page contains no supported text. Upload text or choose another page.');
    const snapshot = { schemaVersion: 1, apiVersion: NOTION_API_VERSION, pageId: identity.pageId, sourceUrl: identity.url,
      title: titleText, pageEditedAt: page.last_edited_time, observedAt: new Date().toISOString(), access: 'connected', coverage: 'supported_page_text', blocks };
    if (Buffer.byteLength(JSON.stringify(snapshot)) > NOTION_LIMITS.snapshotBytes) return limit('Notion snapshot exceeds 8 MiB. Select a smaller page');
    return notionSnapshotSchema.parse(snapshot);
  }
}
