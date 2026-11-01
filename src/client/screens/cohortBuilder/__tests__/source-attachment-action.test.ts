import { describe, expect, it } from 'vitest';
import { sourceAttachmentAction } from '../source-attachment-action';
import type { CohortSource } from '@/src/shared/cohort-builder/contracts';
const base: CohortSource = { id: 'source-one', version: 1, label: 'A human title, not a URL', text: 'Retained evidence.', locations: [{ start: 0, end: 18, startMs: 0, endMs: 1200 }], checksum: 'a'.repeat(64), state: 'ready' };
describe('canonical chat attachment actions', () => {
  it.each([
    [{ kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', mode: 'video_observation' }, 'add_youtube_source'],
    [{ kind: 'github', repoUrl: 'https://github.com/owner/repo', ref: 'develop' }, 'add_github_source'],
    [{ kind: 'web', url: 'https://example.com/article' }, 'add_web_source'],
  ] as const)('preserves media input and extraction for %s', (input, type) => {
    const action = sourceAttachmentAction({ ...base, input });
    expect(action).toMatchObject({ type, sourceId: base.id, label: base.label, extraction: { text: base.text, locations: base.locations, checksum: base.checksum } });
    if (input.kind === 'github') expect(action).toMatchObject({ ref: 'develop' });
  });
  it('retains structured evidence for text and PDF', () => {
    expect(sourceAttachmentAction(base)).toMatchObject({ type: 'add_text_source', extraction: { locations: base.locations } });
    expect(sourceAttachmentAction({ ...base, label: 'reference.pdf' })).toMatchObject({ type: 'add_pdf_source', sourceId: base.id });
  });
  it('does not classify a text document from URL words in its title', () => {
    expect(sourceAttachmentAction({ ...base, label: 'youtube.com debugging notes' }).type).toBe('add_text_source');
  });
  it('preserves metadata-only URL references without fabricating extraction', () => {
    const action = sourceAttachmentAction({ ...base, text: '', locations: undefined, checksum: null, input: { kind: 'web', url: 'https://example.com' } });
    expect(action).toMatchObject({ type: 'add_web_source', sourceId: base.id });
    expect(action).not.toHaveProperty('extraction');
  });
  it('rejects an empty untyped source rather than pretending it saved', () => {
    expect(() => sourceAttachmentAction({ ...base, text: '' })).toThrow();
  });
});
