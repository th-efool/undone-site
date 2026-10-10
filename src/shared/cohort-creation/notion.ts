import { z } from 'zod';
import { MATERIAL_LIMITS } from './materials';

export const NOTION_API_VERSION = '2022-06-28';
export const NOTION_LIMITS = { depth: 8, blocks: 2000, snapshotBytes: 8 * 1024 * 1024, requests: 250 } as const;
export const notionIdSchema = z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
export const notionRawBlockSchema = z.object({ object: z.literal('block'), id: notionIdSchema,
  type: z.string().min(1).max(100), has_children: z.boolean(), last_edited_time: z.iso.datetime(),
  archived: z.boolean(), in_trash: z.boolean().optional(),
  parent: z.object({ type: z.enum(['page_id', 'block_id']), page_id: notionIdSchema.optional(), block_id: notionIdSchema.optional() }),
}).catchall(z.json());
const richText = z.array(z.object({ plain_text: z.string().max(MATERIAL_LIMITS.extractedTextBytes) })).max(2000);
const richTypes = new Set(['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item',
  'numbered_list_item', 'to_do', 'toggle', 'quote', 'callout', 'code']);
const structureTypes = new Set(['divider', 'column_list', 'column', 'table', 'synced_block']);
const linkedTypes = new Set(['child_page', 'child_database', 'link_to_page']);

/** Plain text only: table cells use tabs. No remote asset/link is fetched or rendered. */
export function projectNotionBlock(raw: z.infer<typeof notionRawBlockSchema>) {
  const body = raw[raw.type];
  if (richTypes.has(raw.type)) return { disposition: 'text' as const,
    text: z.object({ rich_text: richText }).parse(body).rich_text.map(item => item.plain_text).join(''), omission: null };
  if (raw.type === 'table_row') return { disposition: 'text' as const,
    text: z.object({ cells: z.array(richText).max(100) }).parse(body).cells.map(cell => cell.map(item => item.plain_text).join('')).join('\t'), omission: null };
  if (raw.type === 'equation') return { disposition: 'text' as const,
    text: z.object({ expression: z.string().max(MATERIAL_LIMITS.extractedTextBytes) }).parse(body).expression, omission: null };
  if (structureTypes.has(raw.type)) return { disposition: 'structure' as const, text: '', omission: null };
  return { disposition: 'omitted' as const, text: '', omission: linkedTypes.has(raw.type) ? 'linked_page_or_database' as const : 'unsupported_or_media' as const };
}

export const notionObservedBlockSchema = z.strictObject({ id: notionIdSchema, parentId: notionIdSchema,
  depth: z.number().int().min(1).max(NOTION_LIMITS.depth), raw: notionRawBlockSchema,
  text: z.string().max(MATERIAL_LIMITS.extractedTextBytes), disposition: z.enum(['text', 'structure', 'omitted']),
  omission: z.enum(['linked_page_or_database', 'unsupported_or_media']).nullable() });
export const notionSnapshotSchema = z.strictObject({ schemaVersion: z.literal(1), apiVersion: z.literal(NOTION_API_VERSION),
  pageId: notionIdSchema, sourceUrl: z.url(), title: z.string().max(2000), pageEditedAt: z.iso.datetime(), observedAt: z.iso.datetime(),
  access: z.literal('connected'), coverage: z.literal('supported_page_text'),
  blocks: z.array(notionObservedBlockSchema).min(1).max(NOTION_LIMITS.blocks),
}).superRefine((snapshot, ctx) => {
  const depths = new Map<string, number>([[snapshot.pageId, 0]]); let bytes = 0;
  const byId = new Map(snapshot.blocks.map(block => [block.id, block]));
  try {
    for (const block of snapshot.blocks) {
      const projected = projectNotionBlock(block.raw);
      if (depths.has(block.id) || depths.get(block.parentId) !== block.depth - 1 || block.raw.id !== block.id ||
        block.raw.parent[block.raw.parent.type] !== block.parentId || block.raw.archived || block.raw.in_trash ||
        block.text !== projected.text || block.disposition !== projected.disposition || block.omission !== projected.omission) throw new Error('Invalid block');
      const parent = byId.get(block.parentId);
      const children = snapshot.blocks.some(child => child.parentId === block.id);
      if (parent && (!parent.raw.has_children || parent.disposition === 'omitted') ||
        block.disposition !== 'omitted' && block.raw.has_children !== children) throw new Error('Invalid children');
      depths.set(block.id, block.depth); bytes += new TextEncoder().encode(block.text).byteLength;
    }
    if (bytes > MATERIAL_LIMITS.extractedTextBytes || new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > NOTION_LIMITS.snapshotBytes ||
      snapshot.sourceUrl !== `https://www.notion.so/${snapshot.pageId.replaceAll('-', '')}` || !snapshot.blocks.some(block => block.text.trim())) throw new Error('Invalid scope');
  } catch { ctx.addIssue({ code: 'custom', message: 'Invalid Notion block provenance, content or scope' }); }
});
export type NotionSnapshot = z.infer<typeof notionSnapshotSchema>;
