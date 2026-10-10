import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { notionSnapshotSchema } from '@/src/shared/cohort-creation/notion';
import { NotionMaterialReader, notionPageIdentity, type NotionPageProvider } from '../materials/notion';

const pageId = '11111111-1111-4111-8111-111111111111';
const edited = '2026-10-10T00:00:00.000Z';
const url = `https://www.notion.so/Lesson-${pageId.replaceAll('-', '')}?pvs=4`;
function block(text: string, parentId = pageId, type = 'paragraph', hasChildren = false) {
  return { object: 'block', id: randomUUID(), type, has_children: hasChildren, archived: false, last_edited_time: edited,
    parent: parentId === pageId ? { type: 'page_id', page_id: parentId } : { type: 'block_id', block_id: parentId },
    [type]: { rich_text: [{ type: 'text', plain_text: text, text: { content: text } }] } };
}
const list = (results: unknown[], cursor: string | null = null) => ({ object: 'list', results, has_more: cursor !== null, next_cursor: cursor });
function fixture() {
  const page = { object: 'page', id: pageId, archived: false, last_edited_time: edited,
    properties: { title: { type: 'title', title: [{ plain_text: 'Lighting lesson' }] } } };
  const paragraph = block('Actual source content 😀\r\nSecond line.');
  const provider = { getPage: vi.fn(async () => page), getChildren: vi.fn<NotionPageProvider['getChildren']>(async () => list([paragraph])) };
  return { page, paragraph, provider, reader: new NotionMaterialReader(provider) };
}
describe('bounded Notion page observation', () => {
  it('canonicalizes page identity without fetching source URLs or accepting block fragments', () => {
    expect(notionPageIdentity(url)).toEqual({ pageId, url: `https://www.notion.so/${pageId.replaceAll('-', '')}` });
    for (const input of ['https://notion.so.evil.test/x', `http://www.notion.so/${pageId}`, `${url}#block`, `https://u:p@notion.so/${pageId}`, 'https://notion.so/no-id']) {
      expect(() => notionPageIdentity(input)).toThrow();
    }
  });
  it('retains actual block JSON, order, parent, timestamps and exact supported text', async () => {
    const f = fixture(); const snapshot = await f.reader.read(url);
    expect(snapshot).toMatchObject({ pageId, apiVersion: '2022-06-28', access: 'connected', coverage: 'supported_page_text', title: 'Lighting lesson' });
    expect(snapshot.blocks[0]).toMatchObject({ raw: f.paragraph, text: 'Actual source content 😀\r\nSecond line.', parentId: pageId, depth: 1 });
    expect(f.provider.getPage).toHaveBeenCalledTimes(2);
    expect(notionSnapshotSchema.safeParse({ ...snapshot, blocks: [{ ...snapshot.blocks[0], text: 'Invented content' }] }).success).toBe(false);
  });
  it('paginates each parent and recursively traverses supported children in deterministic order', async () => {
    const f = fixture(); const toggle = block('More detail', pageId, 'toggle', true); const nested = block('Nested content', toggle.id);
    f.provider.getChildren.mockImplementation(async (id, cursor) => id === toggle.id ? list([nested]) : cursor === 'second' ? list([f.paragraph]) : list([toggle], 'second'));
    const snapshot = await f.reader.read(url);
    expect(snapshot.blocks.map(value => value.id)).toEqual([toggle.id, nested.id, f.paragraph.id]);
    expect(snapshot.blocks[1]).toMatchObject({ parentId: toggle.id, depth: 2 });
    expect(f.provider.getChildren.mock.calls.map(args => args.slice(0, 2))).toEqual([[pageId, null], [toggle.id, null], [pageId, 'second']]);
  });
  it('records unsupported media, linked pages and unknown types without fetching their children or URLs', async () => {
    const f = fixture(); const linked = block('', pageId, 'child_page', true); const media = block('', pageId, 'image'); const unknown = block('', pageId, 'new_future_type');
    f.provider.getChildren.mockResolvedValue(list([f.paragraph, linked, media, unknown]));
    const snapshot = await f.reader.read(url);
    expect(snapshot.blocks.slice(1).map(value => value.omission)).toEqual(['linked_page_or_database', 'unsupported_or_media', 'unsupported_or_media']);
    expect(f.provider.getChildren).toHaveBeenCalledOnce();
  });
  it('projects table cells and equations as documented plain text without rendering code', async () => {
    const f = fixture(); const row = { ...block('', pageId, 'table_row'), table_row: { cells: [[{ plain_text: 'A' }], [{ plain_text: 'B' }]] } };
    const equation = { ...block('', pageId, 'equation'), equation: { expression: 'x^2' } };
    f.provider.getChildren.mockResolvedValue(list([row, equation]));
    expect((await f.reader.read(url)).blocks.map(value => value.text)).toEqual(['A\tB', 'x^2']);
  });
  it('rejects missing pagination, repeated cursors, duplicate/cyclic IDs and wrong parents', async () => {
    for (const mode of ['missing', 'cursor', 'duplicate', 'cycle', 'parent']) {
      const f = fixture();
      if (mode === 'missing') f.provider.getChildren.mockResolvedValue({ ...list([f.paragraph]), has_more: true });
      if (mode === 'cursor') f.provider.getChildren.mockImplementation(async () => list([block('Real text')], 'same'));
      if (mode === 'duplicate') f.provider.getChildren.mockResolvedValue(list([f.paragraph, f.paragraph]));
      if (mode === 'cycle') f.provider.getChildren.mockResolvedValue(list([{ ...f.paragraph, id: pageId }]));
      if (mode === 'parent') f.provider.getChildren.mockResolvedValue(list([block('Wrong page', randomUUID())]));
      await expect(f.reader.read(url)).rejects.toThrow();
    }
  });
  it('fails when declared children are absent or the page changed during observation', async () => {
    const f = fixture(); const parent = block('Parent text', pageId, 'toggle', true);
    f.provider.getChildren.mockImplementation(async id => list(id === pageId ? [parent] : []));
    await expect(f.reader.read(url)).rejects.toThrow('child content is incomplete');
    const changed = fixture(); changed.provider.getPage.mockResolvedValueOnce(changed.page).mockResolvedValueOnce({ ...changed.page, last_edited_time: '2026-10-10T01:00:00.000Z' });
    await expect(changed.reader.read(url)).rejects.toThrow('changed while reading');
  });
  it('rejects archived pages, archived blocks and pages with no supported text', async () => {
    const f = fixture(); f.provider.getPage.mockResolvedValue({ ...f.page, archived: true });
    await expect(f.reader.read(url)).rejects.toThrow('archived'); expect(f.provider.getChildren).not.toHaveBeenCalled();
    const archived = fixture(); archived.provider.getChildren.mockResolvedValue(list([{ ...archived.paragraph, archived: true }]));
    await expect(archived.reader.read(url)).rejects.toThrow();
    const empty = fixture(); empty.provider.getChildren.mockResolvedValue(list([block('', pageId, 'image')]));
    await expect(empty.reader.read(url)).rejects.toThrow('no supported text');
  });
  it('enforces eight nesting levels, 2,000 blocks and 1 MiB without truncation', async () => {
    const deep = fixture(); deep.provider.getChildren.mockImplementation(async id => list([block('Nested', id, 'toggle', true)]));
    await expect(deep.reader.read(url)).rejects.toThrow('eight levels');
    const large = fixture(); large.provider.getChildren.mockImplementation(async (_id, cursor) => {
      const page = Number(cursor ?? '0'); return list(Array.from({ length: 100 }, () => block('Text')), String(page + 1));
    });
    await expect(large.reader.read(url)).rejects.toThrow('2,000 blocks');
    const text = fixture(); const huge = { ...block(''), paragraph: { rich_text: [{ plain_text: 'x'.repeat(600_000) }, { plain_text: 'x'.repeat(600_000) }] } };
    text.provider.getChildren.mockResolvedValue(list([huge]));
    await expect(text.reader.read(url)).rejects.toThrow('1 MiB');
  });
  it('bounds retained JSON and refuses work after cancellation', async () => {
    const f = fixture(); const raw = { ...f.paragraph, extra: 'x'.repeat(8 * 1024 * 1024) };
    f.provider.getChildren.mockResolvedValue(list([raw]));
    await expect(f.reader.read(url)).rejects.toThrow('8 MiB');
    const controller = new AbortController(); controller.abort(); const cancelled = fixture();
    await expect(cancelled.reader.read(url, controller.signal)).rejects.toThrow(); expect(cancelled.provider.getPage).not.toHaveBeenCalled();
  });
  it('rejects malformed rich text rather than producing empty success', async () => {
    const f = fixture(); const provider: NotionPageProvider = { getPage: f.provider.getPage,
      getChildren: async () => list([{ ...f.paragraph, paragraph: { rich_text: [{ text: { content: 'Not projected' } }] } } as unknown as ReturnType<typeof block>]) };
    await expect(new NotionMaterialReader(provider).read(url)).rejects.toThrow();
  });
});
