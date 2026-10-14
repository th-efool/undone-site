import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { acceptPdfUpload } from '@/src/server/infrastructure/db/postgres/cohort-pdf-upload';
import { PDF_SOURCE_BYTES } from '@/src/server/domain/cohort-builder/source-policy';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const reply = (body:unknown,status:number) => Response.json(body,{ status, headers:{ 'Cache-Control':'private, no-store' } });
export async function POST(request:Request,{ params }:{ params:Promise<{workspaceId:string}> }) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ code:'INVALID_ORIGIN' },403);
  const ownerId = await getCreationOwner(); if (!ownerId) return reply({ code:'UNAUTHORIZED' },401);
  if (request.headers.get('x-owner-id') !== ownerId) return reply({ code:'SESSION_CHANGED' },409);
  if (request.headers.get('content-type') !== 'application/pdf') return reply({ code:'INVALID_PDF_UPLOAD' },415);
  if (!/^\d+$/.test(request.headers.get('x-workspace-revision')??'')) return reply({code:'INVALID_PDF_UPLOAD'},400);
  const reader = request.body?.getReader(); if (!reader) return reply({ code:'INVALID_PDF_UPLOAD' },400);
  const chunks:Uint8Array[] = []; let count = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break;
      count += next.value.length; if (count > PDF_SOURCE_BYTES) { await reader.cancel(); return reply({ code:'PDF_SIZE_LIMIT' },413); } chunks.push(next.value); }
    const result = await acceptPdfUpload(ownerId,{ workspaceId:(await params).workspaceId,
      requestId:request.headers.get('idempotency-key'), expectedRevision:Number(request.headers.get('x-workspace-revision')),
      label:decodeURIComponent(request.headers.get('x-source-label') ?? '') },Buffer.concat(chunks));
    return reply(result,202);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'WORKSPACE_NOT_FOUND' || code === 'ARTIFACT_NOT_FOUND') return reply({ code:'NOT_FOUND' },404);
    if (['STALE_WORKSPACE','IDEMPOTENCY_MISMATCH','WORKSPACE_NOT_ACTIVE'].includes(code)) return reply({code},409);
    if (code === 'SOURCE_CAPABILITY_DISABLED') return reply({code},403);
    if (code === 'S4B_SCHEMA_NOT_INSTALLED' || code === 'DURABLE_DRIVER_REQUIRED') return reply({code},503);
    if (code === 'INVALID_PDF_UPLOAD' || error instanceof Error && error.name === 'ZodError') return reply({code:'INVALID_PDF_UPLOAD'},400);
    return reply({code:'UPLOAD_UNAVAILABLE'},503);
  }
}
