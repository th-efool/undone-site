import { createHttpTransport, TransportError, type InteractionTransport } from 'interaction-builder/client';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

/** Retain a failed send's identity until acknowledgement, even if the store offers a new ID. */
export function createCohortTransport(workspaceId: string, base: InteractionTransport<CohortWorkspace> = createHttpTransport({ workspaceId })) {
  let attempt: { fingerprint: string; message: { id: string; parts: unknown[] }; key: string } | null = null;
  let actionAttempt:{fingerprint:string;envelope:unknown;key:string}|null=null;
  return { ...base, async commit(envelope:unknown,key:string) {
    const input=envelope as {action:unknown;entityVersions:unknown};
    const fingerprint=JSON.stringify([input.action,input.entityVersions]);
    if(!actionAttempt || actionAttempt.fingerprint!==fingerprint) actionAttempt={fingerprint,envelope,key};
    try {const result=await base.commit(actionAttempt.envelope,actionAttempt.key);actionAttempt=null;return result;}
    catch(error){if(error instanceof TransportError && error.status>=400 && error.status<500) actionAttempt=null;throw error;}
  }, async sendMessage(message: { id: string; parts: unknown[] }, key: string) {
    if (!base.sendMessage) throw new Error('MESSAGE_TRANSPORT_UNAVAILABLE');
    const fingerprint = JSON.stringify(message.parts);
    if (!attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, message, key };
    const response = await base.sendMessage(attempt.message, attempt.key);
    attempt = null;
    return response;
  } };
}
