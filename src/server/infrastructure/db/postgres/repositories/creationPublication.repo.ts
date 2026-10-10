import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma, SourceType } from '@/generated/prisma/client';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { publicationCheckpointSchema, publicationReceiptSchema, type DeliveryArtifact, type PublicationCheckpoint, type PublicationMode, type PublicationReceipt } from '@/src/shared/cohort-creation/publication';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import { publicationArtifactFingerprint, publicationLessonId, publicationSeasonId, publicationSnapshotHash, publicationSourceId, validatePublicationCheckpoint } from '@/src/server/domain/cohort-creation/publication.service';
import type { StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

function materialObjectIds(snapshot: CreationSnapshot): string[] {
  const discovery = snapshot.discovery?.checkpoint;
  return [...snapshot.materials.flatMap(source => source.input.kind === 'upload' ? [source.input.assetId] : []),
    ...snapshot.extractions.map(extraction => extraction.artifactRef), ...snapshot.materialRefs.flatMap(ref => ref.ids),
    ...snapshot.materials.flatMap(source => source.discoveredFrom ? [source.discoveredFrom.searchArtifactId, source.discoveredFrom.observationArtifactId] : []),
    ...(snapshot.processing?.checkpoint?.completed.map(entry => entry.artifact.id) ?? []),
    ...(snapshot.processing?.chunking?.checkpoint?.completed.map(entry => entry.artifact.id) ?? []),
    ...(snapshot.processing?.analysis?.checkpoint?.completed.map(entry => entry.artifact.id) ?? []),
    ...(snapshot.processing?.building?.checkpoint?.completed.map(entry => entry.artifact.id) ?? []),
    ...(discovery ? [discovery.searchArtifact.id, ...(discovery.observationArtifact ? [discovery.observationArtifact.id] : []), ...(discovery.selectionArtifact ? [discovery.selectionArtifact.id] : [])] : [])];
}

type Operation = { cohortId: string; mode: PublicationMode; snapshotHash: string; receipt: unknown };
export function preservePublication(previous: PublicationCheckpoint | null, value: PublicationCheckpoint) {
  const next = publicationCheckpointSchema.parse(value);
  if (previous && (previous.requestId !== next.requestId || previous.mode !== next.mode || previous.cohortId !== next.cohortId || previous.snapshotHash !== next.snapshotHash ||
    JSON.stringify(previous.lessonIds) !== JSON.stringify(next.lessonIds) || next.completed.length < previous.completed.length ||
    previous.completed.some((entry, index) => JSON.stringify(entry) !== JSON.stringify(next.completed[index])))) throw new Error('Cannot replace accepted publication artifacts');
  return next;
}
/** Caller holds the owned draft lock; operation identities are durable before artifact preparation. */
export async function reserveCreationPublication(tx: Prisma.TransactionClient, ownerId: string, snapshot: CreationSnapshot, requestId: string, mode: PublicationMode) {
  const snapshotHash = publicationSnapshotHash(snapshot);
  const owned = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "creation_drafts" WHERE "id"=${snapshot.draftId} AND "ownerId"=${ownerId} AND "expiredAt" IS NULL FOR UPDATE`;
  if (!owned.length) throw new Error('Owned publication draft unavailable');
  const existing = await tx.$queryRaw<Operation[]>`SELECT "cohortId","mode","snapshotHash","receipt" FROM "creation_publications" WHERE "draftId"=${snapshot.draftId} AND "requestId"=${requestId}`;
  if (existing[0]) {
    if (existing[0].snapshotHash !== snapshotHash || existing[0].mode !== mode) throw new Error('Publication idempotency key conflicts with immutable content');
    return { cohortId: existing[0].cohortId, snapshotHash, receipt: existing[0].receipt ? publicationReceiptSchema.parse(existing[0].receipt) : null };
  }
  const reservedId = randomUUID();
  await tx.$executeRaw`INSERT INTO "creation_publication_reservations" ("draftId","cohortId") VALUES (${snapshot.draftId},${reservedId}) ON CONFLICT ("draftId") DO NOTHING`;
  const rows = await tx.$queryRaw<{ cohortId: string }[]>`SELECT "cohortId" FROM "creation_publication_reservations" WHERE "draftId"=${snapshot.draftId}`;
  const cohortId = rows[0]?.cohortId; if (!cohortId) throw new Error('Publication identity reservation unavailable');
  await tx.$executeRaw`INSERT INTO "creation_publications" ("draftId","requestId","cohortId","mode","snapshotHash") VALUES (${snapshot.draftId},${requestId},${cohortId},${mode},${snapshotHash})`;
  return { cohortId, snapshotHash, receipt: null as PublicationReceipt | null };
}
export async function pinPublication(tx: Prisma.TransactionClient, scope: StorageScope, value: PublicationCheckpoint) {
  const checkpoint = publicationCheckpointSchema.parse(value);
  for (const entry of checkpoint.completed) {
    const ref = entry.artifact;
    const result = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: scope.ownerId, draftId: scope.draftId,
      status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'creation-delivery', schemaVersion: 1,
      inputFingerprint: publicationArtifactFingerprint(checkpoint.snapshotHash, entry.lessonId) }, data: { referencedAt: new Date() } });
    if (result.count !== 1) throw new Error('Prepared publication artifact unavailable');
  }
}
const sourceTypes: Record<string, SourceType> = { youtube_video: 'YOUTUBE_VIDEO', youtube_playlist: 'YOUTUBE_PLAYLIST', web: 'WEBSITE', pdf: 'PDF', markdown: 'MARKDOWN', github: 'GITHUB_REPO', notion: 'NOTION' };
/** Called inside the fenced job-finalization transaction, after owned delivery bytes have been read and validated. */
export async function materializeCreationPublication(tx: Prisma.TransactionClient, ownerId: string, snapshot: CreationSnapshot,
  value: PublicationCheckpoint, prepared: DeliveryArtifact[]): Promise<PublicationReceipt> {
  const checkpoint = validatePublicationCheckpoint(snapshot, value.requestId, value.mode, value.cohortId, value);
  if (checkpoint.completed.length !== checkpoint.total || prepared.length !== checkpoint.total || !snapshot.review || !snapshot.result) throw new Error('Publication artifacts incomplete');
  const operations = await tx.$queryRaw<Operation[]>`SELECT "cohortId","mode","snapshotHash","receipt" FROM "creation_publications"
    WHERE "draftId"=${snapshot.draftId} AND "requestId"=${checkpoint.requestId} FOR UPDATE`;
  const operation = operations[0];
  if (!operation || operation.cohortId !== checkpoint.cohortId || operation.mode !== checkpoint.mode || operation.snapshotHash !== checkpoint.snapshotHash) throw new Error('Publication reservation changed');
  if (operation.receipt) return publicationReceiptSchema.parse(operation.receipt);
  await pinPublication(tx, { ownerId, draftId: snapshot.draftId }, checkpoint);
  for (const [index, artifact] of prepared.entries()) {
    if (artifact.requestId !== checkpoint.requestId || artifact.snapshotHash !== checkpoint.snapshotHash || artifact.cohortId !== checkpoint.cohortId ||
      artifact.sourceLessonId !== checkpoint.lessonIds[index] || artifact.lessonId !== publicationLessonId(checkpoint.cohortId, artifact.sourceLessonId)) throw new Error('Prepared publication payload changed');
  }
  const prior = await tx.cohort.findUnique({ where: { id: checkpoint.cohortId }, select: { id: true, creatorId: true, visibility: true, creationSettings: true } });
  const now = new Date();
  if (prior) {
    if (prior.creatorId !== ownerId || (prior.creationSettings as { draftId?: string } | null)?.draftId !== snapshot.draftId) throw new Error('Published cohort ownership changed');
    if ((prior.creationSettings as { snapshotHash?: string } | null)?.snapshotHash !== checkpoint.snapshotHash) throw new Error('Published content cannot be replaced through promotion');
    if (checkpoint.mode === 'private_activation' && prior.visibility === 'PUBLIC') throw new Error('Public cohort cannot be downgraded');
    await tx.cohort.update({ where: { id: prior.id }, data: { visibility: checkpoint.mode === 'public_publish' ? 'PUBLIC' : 'PRIVATE', isPublished: true,
      creationSettings: { ...(prior.creationSettings as Prisma.JsonObject), publicationMode: checkpoint.mode } } });
  } else {
    // The accepted build's seasons/lesson membership is frozen by its fingerprint. Review inventory supplies deterministic order.
    const seasonIds = new Map<string, { id: string; title: string; lessons: DeliveryArtifact[] }>();
    for (const artifact of prepared) {
      const source = artifact.chunks[0].sourceRefs[0]; const unit = JSON.stringify([source.materialId, source.unitId]);
      const existing = seasonIds.get(unit);
      if (existing) existing.lessons.push(artifact); else seasonIds.set(unit, { id: publicationSeasonId(checkpoint.cohortId, unit), title: artifact.chunks[0].title, lessons: [artifact] });
    }
    await tx.cohort.create({ data: { id: checkpoint.cohortId, creatorId: ownerId, title: snapshot.review.title, description: snapshot.review.description,
      difficulty: snapshot.result.intent.level?.value === 'advanced' ? 'ADVANCED' : snapshot.result.intent.level?.value === 'intermediate' ? 'INTERMEDIATE' : 'BEGINNER',
      visibility: checkpoint.mode === 'public_publish' ? 'PUBLIC' : 'PRIVATE', isPublished: true, publishedAt: now,
      categories: [], tags: [], requirements: [], learningOutcomes: snapshot.result.intent.outcomes.value, language: snapshot.result.intent.language?.value ?? 'en', primaryTopic: snapshot.result.intent.topic.value,
      creationSettings: { draftId: snapshot.draftId, publicationMode: checkpoint.mode, buildFingerprint: snapshot.review.buildFingerprint,
        editRevision: snapshot.review.editRevision, snapshotHash: checkpoint.snapshotHash, deliveryVersion: 1 },
      members: { create: { userId: ownerId, role: 'CREATOR' } },
      sources: { create: snapshot.materials.map(material => ({ id: publicationSourceId(checkpoint.cohortId, material.id),
        type: sourceTypes[material.kind] ?? 'CUSTOM_LINK', title: material.kind.startsWith('youtube') ? 'Selected YouTube material' : `Selected ${material.kind} material`,
        url: material.input.kind === 'url' ? material.input.url : `/cohort/${checkpoint.cohortId}?material=${material.id}`, chunkingMethod: 'retained-segment-boundaries-v1' })) },
      seasons: { create: [...seasonIds.values()].map((season, order) => ({ id: season.id, title: season.title, order,
        lessons: { create: season.lessons.map((artifact, lessonOrder) => ({ id: artifact.lessonId, title: artifact.title,
          description: artifact.objectives.join('\n'), order: lessonOrder, lessonType: artifact.chunks.every(chunk => chunk.sourceRefs.every(ref => ref.anchor.kind === 'video')) ? 'VIDEO' : 'ARTICLE',
          isPublished: true, duration: Math.ceil(artifact.chunks.reduce((sum, chunk) => sum + chunk.durationSeconds, 0)),
          sourceUrl: `/cohort/${checkpoint.cohortId}?lesson=${artifact.lessonId}`,
          videoId: artifact.chunks.every(chunk => chunk.sourceRefs.every(ref => ref.anchor.kind === 'video')) ? artifact.chunks[0].sourceRefs[0].unitId : null,
          chunks: artifact.chunks.map(chunk => ({ ...chunk, duration: `${chunk.durationSeconds}s`, vector: PEDAGOGICAL_DIMENSIONS.map(key => chunk.vector[key]) })) as Prisma.InputJsonValue })) } })) },
      community: { create: { chatEnabled: snapshot.review.chatEnabled, eventsEnabled: snapshot.review.eventsEnabled,
        channels: snapshot.review.chatEnabled ? { create: [{ name: 'general' }] } : undefined } },
    } });
  }
  const refs = [...new Set([...materialObjectIds(snapshot), ...checkpoint.completed.map(entry => entry.artifact.id)])];
  if (refs.length) {
    const pinned = await tx.creationStorageObject.updateMany({ where: { id: { in: refs }, ownerId, draftId: snapshot.draftId, status: 'ready' }, data: { referencedAt: now, publishedAt: now } });
    if (pinned.count !== refs.length) throw new Error('Publication source artifacts unavailable');
  }
  const receipt = publicationReceiptSchema.parse({ requestId: checkpoint.requestId, mode: checkpoint.mode, snapshotHash: checkpoint.snapshotHash, cohortId: checkpoint.cohortId, committedAt: now.toISOString() });
  await tx.$executeRaw`UPDATE "creation_publications" SET "receipt"=${JSON.stringify(receipt)}::jsonb WHERE "draftId"=${snapshot.draftId} AND "requestId"=${checkpoint.requestId}`;
  return receipt;
}
