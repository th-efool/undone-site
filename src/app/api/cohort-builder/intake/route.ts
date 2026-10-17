import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { acceptCohortIntake } from '@/src/server/infrastructure/db/postgres/cohort-intake';
import { cohortIntakeEnabled } from '@/src/shared/cohort-builder/intake';
import { dispatchInteractionExecution } from '@/src/server/interaction-dispatch.runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET() {
  const ownerId = await getCreationOwner();
  return reply({ ownerId, enabled: ownerId ? cohortIntakeEnabled(ownerId, process.env) : process.env.INTERACTION_COHORT_V2_ENABLED === '1' });
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ code: 'INVALID_ORIGIN' }, 403);
  const ownerId = await getCreationOwner();
  if (!ownerId) return reply({ code: 'UNAUTHORIZED' }, 401);
  if (!cohortIntakeEnabled(ownerId, process.env)) return reply({ code: 'INTAKE_DISABLED' }, 403);
  const reader = request.body?.getReader();
  if (!reader) return reply({ code: 'INVALID_INPUT' }, 400);
  const decoder = new TextDecoder(); let text = ''; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 850_000) { await reader.cancel(); return reply({ code: 'INPUT_TOO_LARGE' }, 413); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    const parsed = JSON.parse(text);
    if (parsed?.expectedOwnerId !== ownerId) return reply({ code: 'SESSION_CHANGED' }, 409);
    const { expectedOwnerId: _expectedOwnerId, ...body } = parsed;
    const accepted = await acceptCohortIntake(ownerId, body);
    await dispatchInteractionExecution();
    return reply(accepted, 202);
  }
  catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'IDEMPOTENCY_MISMATCH') return reply({ code }, 409);
    if (['DURABLE_DRIVER_REQUIRED', 'S3_SCHEMA_NOT_INSTALLED', 'JOURNEY_STAGE_SCHEMA_NOT_INSTALLED', 'S3_HANDLER_VERSION_UNSUPPORTED'].includes(code)) return reply({ code }, 503);
    if (error instanceof Error && (error.name === 'ZodError' || error instanceof SyntaxError)) return reply({ code: 'INVALID_INPUT' }, 400);
    return reply({ code: 'INTAKE_UNAVAILABLE' }, 503);
  }
}
