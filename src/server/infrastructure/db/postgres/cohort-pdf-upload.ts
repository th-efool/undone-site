import 'server-only';
import { z } from 'zod';
import { prisma as defaultPrisma } from './client';
import { computePayloadHash, deterministicUuid } from 'interaction-builder/runtime';
import { createPostgresInteractionRepository } from './repositories/interaction.repo';
import { cohortDomain } from '@/src/server/domain/cohort-builder/domain';
import { putTextArtifact } from '@/src/server/domain/cohort-builder/text-artifacts';
import { PDF_SOURCE_BYTES, assertSourceSchema, sourceCapability } from '@/src/server/domain/cohort-builder/source-policy';

const uploadSchema = z.strictObject({ workspaceId:z.uuid(), requestId:z.uuid(), expectedRevision:z.number().int().nonnegative(), label:z.string().trim().min(1).max(300) });
/** Binary input and the ordinary canonical source action commit atomically. No alternate source writer. */
export async function acceptPdfUpload(ownerId: string, input: unknown, bytes: Uint8Array, prisma = defaultPrisma) {
  const body = uploadSchema.parse(input);
  if (!bytes.length || bytes.length > PDF_SOURCE_BYTES || Buffer.from(bytes.subarray(0,5)).toString() !== '%PDF-') throw new Error('INVALID_PDF_UPLOAD');
  const payloadHash = computePayloadHash({ ...body, bytes:computePayloadHash(Buffer.from(bytes).toString('base64')) });
  return prisma.$transaction(async tx => {
    const ws = (await tx.$queryRaw<Array<{ lifecycle:string }>>`SELECT lifecycle FROM interaction_workspaces
      WHERE id=${body.workspaceId} AND "ownerId"=${ownerId} AND "domainId"='cohort' FOR UPDATE`)[0];
    if (!ws) throw new Error('WORKSPACE_NOT_FOUND');
    const key = { workspaceId:body.workspaceId, actorId:ownerId, operation:'pdfUpload', requestId:body.requestId };
    const prior = await tx.interactionRequest.findUnique({ where:{ workspaceId_actorId_operation_requestId:key } });
    if (prior) { if (prior.payloadHash !== payloadHash) throw new Error('IDEMPOTENCY_MISMATCH'); return prior.response as { sourceId:string; uploadId:string }; }
    if (ws.lifecycle !== 'active') throw new Error('WORKSPACE_NOT_ACTIVE');
    if (!sourceCapability('pdf')) throw new Error('SOURCE_CAPABILITY_DISABLED');
    const sql = { query:async (statement:string, values:unknown[]) => ({ rows:await tx.$queryRawUnsafe<Array<Record<string,unknown>>>(statement,...values) }) };
    await assertSourceSchema(sql);
    const retained = await putTextArtifact(sql,{ workspaceId:body.workspaceId, kind:'source_input', inputFingerprint:payloadHash, bytes });
    const scoped = new Proxy(tx,{ get(target,property) {
      return property === '$transaction' ? async (work:(client:typeof tx) => unknown) => work(tx) : Reflect.get(target,property);
    } }) as typeof prisma;
    const repo = createPostgresInteractionRepository(scoped);
    const sourceId = deterministicUuid(`pdf-source:${body.workspaceId}:${body.requestId}`);
    await repo.commitAction({ workspaceId:body.workspaceId, ownerId, expectedRevision:body.expectedRevision,
      requestId:`pdf:${body.requestId}`, plan:cohortDomain.plan, envelope:{ actionId:deterministicUuid(`pdf-action:${body.requestId}`),
        workspaceId:body.workspaceId, expectedRevision:body.expectedRevision, entityVersions:[],
        action:{ type:'add_pdf_source', sourceId, uploadId:retained.id, label:body.label } } });
    const response = { sourceId, uploadId:retained.id };
    await tx.interactionRequest.create({ data:{ id:crypto.randomUUID(), ...key, payloadHash, response } });
    return response;
  },{ timeout:15_000 });
}
