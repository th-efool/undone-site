import { createHttpTransport, type InteractionTransport } from 'interaction-builder/client';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

/** Retain a failed send's identity until acknowledgement, even if the store offers a new ID. */
export function createCohortTransport(workspaceId: string, base: InteractionTransport<CohortWorkspace> = createHttpTransport({ workspaceId })) {
  let attempt: { fingerprint: string; message: { id: string; parts: unknown[] }; key: string } | null = null;
  return { ...base, async sendMessage(message: { id: string; parts: unknown[] }, key: string) {
    if (!base.sendMessage) throw new Error('MESSAGE_TRANSPORT_UNAVAILABLE');
    const fingerprint = JSON.stringify(message.parts);
    if (!attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, message, key };
    const response = await base.sendMessage(attempt.message, attempt.key);
    attempt = null;
    return response;
  } };
}
