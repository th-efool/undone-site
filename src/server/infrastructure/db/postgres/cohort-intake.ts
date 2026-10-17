import 'server-only';
import { prisma as defaultPrisma } from './client';
import { createPostgresInteractionRepository } from './repositories/interaction.repo';
import { computePayloadHash, deterministicUuid } from 'interaction-builder/runtime';
import { cohortIntakeSchema, initialCohort } from '@/src/shared/cohort-builder/intake';
import { cohortDomain } from '@/src/server/domain/cohort-builder/domain';
import { assertTextJobSchema, ensureJourneyStageSchema } from '@/src/server/domain/cohort-builder/text-schema-readiness';
import { textDriver } from '@/src/server/domain/cohort-builder/text-driver';
import { enqueueJourneyJobPlanInTransaction } from '@/src/server/domain/cohort-builder/journey-job-scheduler';

/** One transaction reuses canonical actions and message scheduling, including their receipts/events. */
export async function acceptCohortIntake(ownerId: string, input: unknown, prisma = defaultPrisma) {
  const body = cohortIntakeSchema.parse(input);
  const workspaceId = deterministicUuid(`cohort-intake:${ownerId}:${body.requestId}`);
  const payloadHash = computePayloadHash(body);
  return prisma.$transaction(async tx => {
    // The workspace does not exist yet: serialize creation on its deterministic identity.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))::text`;
    const key = { workspaceId, actorId: ownerId, operation: 'cohortIntake', requestId: body.requestId };
    const prior = await tx.interactionRequest.findUnique({ where: { workspaceId_actorId_operation_requestId: key } });
    if (prior) {
      if (prior.payloadHash !== payloadHash) throw new Error('IDEMPOTENCY_MISMATCH');
      return prior.response as { workspaceId: string };
    }
    if (textDriver() !== 'durable') throw new Error('DURABLE_DRIVER_REQUIRED');
    const sqlAdapter = { query: async (sql: string, values: unknown[] = []) => ({ rows: await tx.$queryRawUnsafe(sql, ...values) as Record<string, unknown>[] }) };
    await ensureJourneyStageSchema(sqlAdapter);
    await assertTextJobSchema(sqlAdapter);
    // Methods retain their canonical implementations; nested transaction callbacks share this transaction.
    const scoped = new Proxy(tx, { get(target, property) {
      if (property === '$transaction') return async (work: (client: typeof tx) => unknown) => work(tx);
      return Reflect.get(target, property);
    } }) as typeof prisma;
    const repo = createPostgresInteractionRepository(scoped);
    // Canonical 10-screen journey is enabled by default unless explicitly opted out ('0').
    const journeyEnabled = process.env.INTERACTION_COHORT_JOURNEY_ENABLED !== '0';
    const initial = initialCohort(body.prompt);
    if (!journeyEnabled) delete initial.journey;
    await repo.createWorkspace({ id: workspaceId, ownerId, domainId: 'cohort', domainVersion: 1,
      initialSnapshot: initial });
    if (body.source) {
      await repo.commitAction({ workspaceId, ownerId, expectedRevision: 0, requestId: `${body.requestId}:source`,
        envelope: { actionId: deterministicUuid(`${workspaceId}:source-action`), workspaceId,
          expectedRevision: 0, entityVersions: [], action: { type: 'add_text_source',
            sourceId: deterministicUuid(`${workspaceId}:source`), ...body.source } }, plan: cohortDomain.plan });
    }
    await repo.appendMessage({ id: deterministicUuid(`${workspaceId}:message`), workspaceId, ownerId,
      role: 'user', parts: [{ type: 'text', text: body.prompt }], requestId: `${body.requestId}:message`,
      ...(journeyEnabled ? { scheduleAssistant: false, scheduleRun: false } : {}) });
    if (journeyEnabled) {
      const current = await tx.interactionWorkspace.findUniqueOrThrow({ where: { id: workspaceId } });
      await enqueueJourneyJobPlanInTransaction(
        { query: async (sql, values) => ({ rows: await tx.$queryRawUnsafe(sql, ...values) }) },
        workspaceId, current.snapshot as never);
    }
    const response = { workspaceId };
    await tx.interactionRequest.create({ data: { id: crypto.randomUUID(), ...key, payloadHash, response } });
    return response;
  }, { timeout: 15_000 });
}
