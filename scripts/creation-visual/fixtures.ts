import { initialSnapshot } from '../../src/shared/cohort-creation/flow';
import { result, draftId } from '../../src/shared/cohort-creation/__tests__/fixtures';

// Browser-only fixtures. Never imported by application routes or used for live generation.
export const screenNumber = Number(new URLSearchParams(location.search).get('screen') ?? 2);
const field = <T,>(value: T) => ({ value, origin: 'ai' as const, acceptedRevision: 1 });
const hash = (letter: string) => letter.repeat(64);
export const partitionIds = [hash('a'), hash('b'), hash('c')];
const ref = { id: draftId, kind: 'artifact', byteLength: 500, checksum: hash('e') };
const titles = ['System Design from First Principles', 'System Design Interviews', 'Distributed Systems in Practice', 'Scalability & Performance', 'System Design for Product Engineers'];
const images = ['/mock/thumbnails/system-design.jpeg', '/images/hero-collage/real-map.jpg', '/images/hero-collage/real-galaxy.jpg', '/mock/thumbnails/docker.avif', '/mock/thumbnails/reader.webp'];
export const recommendations = { ...result, intent: { ...result.intent, rawQuery: 'I want to learn system design.', topic: field('System Design') },
  items: titles.map((title, index) => ({ ...result.items[0], rank: index + 1, isBestMatch: index === 0,
    cohort: { ...result.items[0].cohort, cohortId: `fixture-${index}`, title, description: 'Build a practical understanding of modern systems, from core concepts to real-world architecture.',
      coverImage: images[index], categories: ['Theory + Practice'], memberCount: [1284, 643, 318, 521, 292][index], lessonCount: 42 - index * 5, estimatedCompletionTime: '8h 20m' } })) };
export const conceptPreview = { revision: 1, partitions: [{ partitionId: partitionIds[0], materialId: draftId, unitId: draftId,
  proposal: { summary: 'A retained fixture section about designing reliable systems.', concepts: ['Distributed systems', 'Load balancing', 'Consistency', 'Replication', 'Partitioning', 'Caching', 'Queues', 'Availability', 'Transactions', 'Observability']
    .map(label => ({ label, summary: `Fixture explanation of ${label}.`, segmentIds: ['segment-1'] })), limitations: ['Visual fixture, not a live AI result.'] } }] };
export const curriculum = { version: hash('a'), inputRevision: 1, title: field('System Design from First Principles'), description: field('Build a practical mental model of modern distributed systems.'), warnings: [],
  seasons: [{ id: 'season-1', title: field('Foundations'), order: 0, lessons: ['Understanding distributed systems', 'Designing for availability', 'Choosing consistency guarantees'].map((title, order) => ({
    id: `lesson-${order}`, title: field(title), objectives: field(['Explain the core idea and apply it to a concrete design.']), order, type: 'ARTICLE', chunkIds: [`chunk-${order}`], materialIds: [draftId], durationSeconds: 480 })) }] };
export const review = { title: curriculum.title.value, description: curriculum.description.value, buildFingerprint: hash('a'), editRevision: 0,
  lessonIds: ['lesson-0', 'lesson-1', 'lesson-2'], orphanedLessonIds: [], invalidated: [], lessonEdits: [], visibility: 'PRIVATE', chatEnabled: false, eventsEnabled: false, proposal: null, request: null };
export const reviewResponse = { revision: 1, curriculum, review, conversation: { entries: [], nextBefore: null } };
const checkpoint = { phase: 'understanding', requestId: draftId, inputRevision: 1, inputFingerprint: hash('d'), total: 3, partitionIds,
  completed: partitionIds.map(partitionId => ({ partitionId, artifact: ref })) };
export const snapshot = { ...initialSnapshot(draftId), revision: 1, inputRevision: 1, query: recommendations.intent.rawQuery, result: recommendations,
  status: 'succeeded', stage: screenNumber === 2 ? 'recommendations' : screenNumber <= 4 ? 'starting_point' : screenNumber <= 7 ? 'processing' : screenNumber === 8 ? 'ready' : screenNumber === 9 ? 'review' : 'published',
  startingPoint: screenNumber <= 3 ? null : 'have_material',
  materials: screenNumber <= 3 ? [] : [{ id: draftId, kind: 'web', input: { kind: 'url', url: 'https://example.com/system-design-guide' }, status: 'ready', selectedUnitIds: [draftId] }],
  extractions: screenNumber <= 3 ? [] : [{ materialId: draftId, version: hash('b'), checksum: hash('c'), artifactRef: draftId, extractionKind: 'text', complete: true, segmentCount: 18 }],
  processing: screenNumber < 5 ? null : { requestId: draftId, inputRevision: 1, phase: screenNumber === 5 ? 'understanding' : screenNumber === 6 ? 'chunking' : screenNumber === 7 ? 'analysis' : 'building',
    complete: screenNumber !== 5, checkpoint: screenNumber === 5 ? { ...checkpoint, completed: checkpoint.completed.slice(0, 1) } : checkpoint,
    chunking: screenNumber < 6 ? null : { requestId: draftId, complete: screenNumber > 6, checkpoint: { ...checkpoint, phase: 'chunking', understandingFingerprint: hash('d'),
      completed: checkpoint.completed.slice(0, screenNumber === 6 ? 1 : 3).map(item => ({ ...item, chunkCount: 3 })) } },
    analysis: screenNumber < 7 ? null : { requestId: draftId, complete: screenNumber > 7, checkpoint: { ...checkpoint, phase: 'analysis', completed: checkpoint.completed.slice(0, 1).map(item => ({ ...item, chunkCount: 3 })) } },
    building: screenNumber < 8 ? null : { requestId: draftId, complete: true, checkpoint: { ...checkpoint, phase: 'building', completed: checkpoint.completed.map(item => ({ ...item, lessonCount: 1 })) } } },
  review: screenNumber < 9 ? null : review,
  publication: screenNumber < 10 ? null : { requestId: draftId, mode: 'public_publish', cohortId: draftId, snapshotHash: hash('a'), checkpoint: null,
    receipt: { cohortId: draftId, mode: 'public_publish', committedAt: '2026-10-11T00:00:00.000Z' } },
  ...(screenNumber >= 5 && screenNumber <= 7 ? { status: 'running', activeRequestId: draftId } : {}) };
export function useCreation() {
  return new Proxy({ snapshot, hydrated: true, saved: true, materialPending: false, uploading: false, message: null, query: snapshot.query },
    { get: (target, property) => property in target ? target[property as keyof typeof target] : async () => true });
}
