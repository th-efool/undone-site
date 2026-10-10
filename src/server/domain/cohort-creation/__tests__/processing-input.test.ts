import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { ExtractedContent, MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { extractRetainedText } from '../materials/text';
import { youtubeMaterialVersion } from '../materials/youtube-identity';
import { youtubeObservationSegmentId, youtubeObservationVersion } from '../materials/youtube-artifacts';
import { videoObservationCoverage } from '../material-observation';
import { normalizeProcessingInput, partitionProcessingInput } from '../processing-input';

const checksum = 'a'.repeat(64);
const artifact = () => ({ id: randomUUID(), kind: 'artifact' as const, checksum, byteLength: 500 });
function fixture(kind: 'markdown' | 'pdf' | 'web' | 'github' | 'notion' = 'markdown') {
  const materialId = randomUUID(); const text = 'Lighting 😀\r\nCode and prose.\n'; const bytes = Buffer.from(text);
  const ref = { id: randomUUID(), kind: 'upload' as const, checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  const original = extractRetainedText(bytes, ref, materialId, materialId);
  let body: unknown = original; let selected: string[] = [materialId]; let sourceChecksum = ref.checksum;
  let selectionScope: ExtractedContent['selectionScope'];
  let input: MaterialSource['input'] = { kind: 'upload', assetId: ref.id };
  if (kind === 'pdf') body = { ...original, segments: original.segments.map(segment => {
    const anchor = segment.location.anchor; if (anchor.kind !== 'text') throw new Error('fixture');
    return { ...segment, start: anchor.start, end: anchor.end, location: { ...segment.location, anchor: { kind: 'page', page: 1 } } };
  }), pdf: { parserVersion: 'fixture', format: 'page_text_items', pages: [{ page: 1, start: 0, end: text.length }] } };
  if (kind === 'web') {
    input = { kind: 'url', url: 'https://example.com/lesson' }; selectionScope = 'full_text_response';
    body = { ...original, contentOrigin: 'external', web: { scope: selectionScope, parserVersion: 'fixture', title: null, format: 'exact_response_text',
      receipt: { schemaVersion: 1, materialId, inputRevision: 1, requestedUrl: input.url, finalUrl: input.url, redirects: [],
        mediaType: 'text/plain', retainedSource: ref, fetchedAt: new Date().toISOString(), fetchVersion: 'public-https-pinned-v1' } } };
  }
  if (kind === 'github') {
    selected = ['b'.repeat(64)]; input = { kind: 'url', url: 'https://github.com/example/lesson' }; selectionScope = 'selected_paths'; sourceChecksum = checksum;
    body = { schemaVersion: 1, materialId, version: original.version, sourceArtifact: artifact(), commit: 'c'.repeat(40), contentOrigin: 'external',
      coverage: { scope: 'selected_paths', completeSelectedText: true, skipped: [{ path: 'image.png', reason: 'binary' }] },
      files: [{ unitId: selected[0], path: 'README.md', blobSha: 'd'.repeat(40), text, byteLength: bytes.length,
        segments: [{ id: 'e'.repeat(64), text, location: { materialId, unitId: selected[0], segmentId: 'e'.repeat(64),
          anchor: { kind: 'file', commit: 'c'.repeat(40), path: 'README.md', startLine: 1, endLine: 2 } } }] }] };
  }
  if (kind === 'notion') {
    const pageId = randomUUID(); const blockId = randomUUID(); selected = ['b'.repeat(64)];
    input = { kind: 'url', url: `https://www.notion.so/${pageId.replaceAll('-', '')}` }; selectionScope = 'supported_page_text'; sourceChecksum = checksum;
    body = { schemaVersion: 1, materialId, version: original.version, sourceArtifact: artifact(), unitId: selected[0], pageId,
      pageEditedAt: new Date().toISOString(), contentOrigin: 'external', coverage: { scope: 'supported_page_text', completeSupportedText: true },
      blocks: [{ id: blockId, parentId: pageId, depth: 1, editedAt: new Date().toISOString(), type: 'paragraph', text, omission: null,
        segments: [{ id: 'e'.repeat(64), start: 0, end: text.length, text, location: { materialId, unitId: selected[0], segmentId: 'e'.repeat(64), anchor: { kind: 'block', blockId } } }] },
      { id: randomUUID(), parentId: pageId, depth: 1, editedAt: new Date().toISOString(), type: 'image', text: '', omission: 'unsupported_or_media', segments: [] }] };
  }
  const source: MaterialSource = { id: materialId, kind, input, selectedUnitIds: selected, status: 'ready' };
  const extraction: ExtractedContent = { materialId, version: original.version, checksum: sourceChecksum, artifactRef: randomUUID(),
    extractionKind: 'text', segmentCount: kind === 'github' || kind === 'notion' ? 1 : original.segments.length, complete: true, ...(selectionScope ? { selectionScope } : {}) };
  return { source, extraction, body, text };
}

describe('grounded processing inputs', () => {
  it.each(['markdown', 'pdf', 'web', 'github', 'notion'] as const)('preserves exact %s content, anchors and scope', kind => {
    const f = fixture(kind); const units = normalizeProcessingInput(f.source, f.extraction, f.body);
    expect(units.flatMap(unit => unit.segments).map(segment => segment.text).join('')).toBe(f.text);
    expect(units[0]).toMatchObject({ artifactId: f.extraction.artifactRef, extractionVersion: f.extraction.version, coverage: { exhaustive: true } });
    expect(units[0].segments[0].location.anchor.kind).toBe(kind === 'pdf' ? 'page' : kind === 'github' ? 'file' : kind === 'notion' ? 'block' : 'text');
    if (kind === 'github' || kind === 'notion') expect(units[0].coverage.limitations).toHaveLength(1);
  });
  it('rejects stale versions, checksums, source selection and incorrect segment counts', () => {
    const f = fixture();
    for (const patch of [{ version: 'f'.repeat(64) }, { checksum: 'f'.repeat(64) }, { materialId: randomUUID() }, { segmentCount: 999 }, { complete: false }]) {
      expect(() => normalizeProcessingInput(f.source, { ...f.extraction, ...patch }, f.body)).toThrow();
    }
    expect(() => normalizeProcessingInput({ ...f.source, selectedUnitIds: [randomUUID()] }, f.extraction, f.body)).toThrow();
    expect(() => normalizeProcessingInput({ ...f.source, status: 'needs_input' }, f.extraction, f.body)).toThrow();
    expect(() => normalizeProcessingInput({ ...f.source, input: { kind: 'upload', assetId: randomUUID() } }, f.extraction, f.body)).toThrow();
  });
  it('partitions exactly once with stable IDs and no normalization or truncation', () => {
    const f = fixture(); const units = normalizeProcessingInput(f.source, f.extraction, f.body);
    const max = Math.max(...units[0].segments.map(segment => Buffer.byteLength(segment.text)));
    const parts = partitionProcessingInput(units, max);
    expect(parts.flatMap(part => part.segments)).toEqual(units[0].segments);
    expect(parts).toEqual(partitionProcessingInput(units, max));
    expect(parts.every(part => part.textBytes <= max)).toBe(true);
    expect(parts.map(part => part.index)).toEqual(parts.map((_, index) => index));
    const changed = structuredClone(units); changed[0].artifactId = randomUUID();
    expect(partitionProcessingInput(changed, max)[0].id).not.toBe(parts[0].id);
    expect(() => partitionProcessingInput(units, 1)).toThrow('nothing was truncated');
    expect(() => partitionProcessingInput([...units, ...units])).toThrow('accepted source');
    const controller = new AbortController(); controller.abort();
    expect(() => partitionProcessingInput(units, max, controller.signal)).toThrow();
  });
  it('retains video observation limitations and refuses reordered or mismatched retained units', () => {
    const materialId = randomUUID(); const unitId = 'abcdefghijk'; const metadataArtifact = artifact();
    const video = { videoId: unitId, url: `https://www.youtube.com/watch?v=${unitId}`, title: 'Fixture video', description: '',
      channelId: 'channel', channelTitle: 'Fixture', durationSeconds: 100, etag: 'etag', privacy: 'public' as const, publishedAt: '2026-01-01T00:00:00Z' };
    const proposal = { canObserve: true, observations: [{ startSeconds: 10, endSeconds: 30, text: 'Observed explanation.' }], limitations: ['Small text unclear.'] };
    const identity = { materialId, unitId, inputRevision: 1, metadataFingerprint: checksum, metadataArtifact, video,
      model: { provider: 'fixture', modelId: 'fixture', adapterVersion: 'fixture' }, proposal };
    const version = youtubeObservationVersion(identity); const id = youtubeObservationSegmentId(version, 0);
    const observation = { ...identity, schemaVersion: 1, version, extractionKind: 'video_observation', contentOrigin: 'ai', observedAt: new Date().toISOString(),
      segments: [{ id, text: proposal.observations[0].text, location: { materialId, unitId, segmentId: id, anchor: { kind: 'video', startSeconds: 10, endSeconds: 30, estimated: true } } }],
      coverage: videoObservationCoverage(proposal, video) };
    const bundle = { phase: 'youtube_observations' as const, materialId, inputRevision: 2, sourceRevision: 1, metadataArtifact, metadataFingerprint: checksum,
      units: [{ unitId, artifact: artifact(), version, segmentCount: 1, textBytes: Buffer.byteLength(proposal.observations[0].text) }] };
    const source: MaterialSource = { id: materialId, kind: 'youtube_video', input: { kind: 'url', url: video.url }, selectedUnitIds: [unitId], status: 'ready' };
    const extraction: ExtractedContent = { materialId, version: youtubeMaterialVersion(bundle), checksum, artifactRef: randomUUID(),
      extractionKind: 'video_observation', segmentCount: 1, complete: false, selectionScope: 'video_observation' };
    const units = normalizeProcessingInput(source, extraction, bundle, [observation]);
    expect(units[0]).toMatchObject({ contentOrigin: 'ai', artifactId: bundle.units[0].artifact.id, coverage: { exhaustive: false } });
    expect(units[0].coverage.limitations).toContain('Model observations are not a transcript; timestamps are estimated.');
    expect(units[0].coverage.limitations).toContain('Unobserved estimated interval: 30–100 seconds.');
    expect(() => normalizeProcessingInput(source, extraction, bundle, [])).toThrow();
    expect(() => normalizeProcessingInput(source, { ...extraction, complete: true }, bundle, [observation])).toThrow();
    expect(() => normalizeProcessingInput(source, extraction, bundle, [{ ...observation, inputRevision: 2 }])).toThrow();
  });
});
