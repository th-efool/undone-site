import { createHttpTransport, TransportError, type InteractionTransport } from 'interaction-builder/client';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { devLogger } from '@/src/shared/lib/dev-logger';

/** Retain a failed send's identity until acknowledgement, even if the store offers a new ID. */
export function createCohortTransport(
  workspaceId: string,
  base: InteractionTransport<CohortWorkspace> = createHttpTransport({ workspaceId })
): InteractionTransport<CohortWorkspace> {
  const logger = devLogger.scoped('CohortTransport');
  let attempt: { fingerprint: string; message: { id: string; parts: unknown[] }; key: string } | null = null;
  let actionAttempt: { fingerprint: string; envelope: unknown; key: string } | null = null;

  return {
    ...base,

    async getWorkspace() {
      logger.debug(`Fetching workspace snapshot for ${workspaceId}`);
      logger.time(`getWorkspace:${workspaceId}`);
      try {
        const ws = await base.getWorkspace();
        logger.timeEnd(`getWorkspace:${workspaceId}`, 1000);
        logger.info(`Fetched workspace snapshot. Revision: ${ws.revision}, Cursor: ${ws.cursor}`);
        return ws;
      } catch (err) {
        logger.timeEnd(`getWorkspace:${workspaceId}`);
        logger.error(`Failed to fetch workspace snapshot:`, err);
        logger.recordIssue({
          severity: 'ERROR',
          title: 'Failed to fetch workspace snapshot',
          details: err instanceof Error ? err.message : String(err),
          error: String(err),
        });
        throw err;
      }
    },

    async commit(envelope: unknown, key: string) {
      const input = envelope as { action: unknown; entityVersions: unknown; expectedRevision?: number };
      const actionType = (input.action as { type?: string })?.type || 'unknown_action';
      const fingerprint = JSON.stringify([input.action, input.entityVersions]);
      if (!actionAttempt || actionAttempt.fingerprint !== fingerprint) {
        actionAttempt = { fingerprint, envelope, key };
      }

      logger.debug(`Committing action "${actionType}" with expectedRevision=${input.expectedRevision}`, input.action);
      logger.time(`commit:${actionType}`);

      try {
        const result = await base.commit(actionAttempt.envelope, actionAttempt.key);
        const duration = logger.timeEnd(`commit:${actionType}`, 1200);
        logger.info(`Action "${actionType}" committed successfully in ${duration.toFixed(0)}ms. New Revision: ${result.revision}`);
        actionAttempt = null;
        return result;
      } catch (error: any) {
        logger.timeEnd(`commit:${actionType}`);

        if (error instanceof TransportError && error.status === 409) {
          logger.warn(`Action "${actionType}" hit 409 CONFLICT (stale expectedRevision: ${input.expectedRevision}). Auto-resyncing...`);
          logger.recordIssue({
            severity: 'WARN',
            title: `Optimistic revision conflict on action "${actionType}"`,
            details: `Server rejected expectedRevision=${input.expectedRevision} with 409 STALE_WORKSPACE. Attempting auto-rebase.`,
            error: error.message,
            context: { actionType, expectedRevision: input.expectedRevision },
          });

          try {
            // Fetch latest snapshot to obtain current database revision
            const latest = await base.getWorkspace();
            logger.info(`Re-synced workspace to Revision #${latest.revision}. Retrying action "${actionType}"...`);
            const rebasedEnvelope = {
              ...input,
              expectedRevision: latest.revision,
            };
            const retryKey = `${key}-rebase-${Date.now()}`;
            const retryResult = await base.commit(rebasedEnvelope, retryKey);
            logger.info(`Auto-rebased action "${actionType}" succeeded! New Revision: ${retryResult.revision}`);
            actionAttempt = null;
            return retryResult;
          } catch (rebaseError: any) {
            logger.error(`Auto-rebase retry failed for "${actionType}":`, rebaseError);
            actionAttempt = null;
            throw rebaseError;
          }
        }

        if (error instanceof TransportError && error.status >= 400 && error.status < 500) {
          actionAttempt = null;
        }

        logger.error(`Action "${actionType}" commit failed:`, error);
        logger.recordIssue({
          severity: 'ERROR',
          title: `Action commit failed for "${actionType}"`,
          details: error instanceof Error ? error.message : String(error),
          error: String(error),
          context: { actionType, status: error?.status, code: error?.code },
        });

        throw error;
      }
    },

    async sendMessage(message: { id: string; parts: unknown[] }, key: string) {
      if (!base.sendMessage) throw new Error('MESSAGE_TRANSPORT_UNAVAILABLE');
      const fingerprint = JSON.stringify(message.parts);
      if (!attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, message, key };
      logger.debug(`Sending assistant message`, message);
      logger.time(`sendMessage:${message.id}`);
      try {
        const response = await base.sendMessage(attempt.message, attempt.key);
        logger.timeEnd(`sendMessage:${message.id}`, 1000);
        logger.info(`Message sent successfully. Cursor: ${response.cursor}`);
        attempt = null;
        return response;
      } catch (err: any) {
        logger.timeEnd(`sendMessage:${message.id}`);
        logger.error(`Failed to send message:`, err);
        logger.recordIssue({
          severity: 'ERROR',
          title: 'Failed to send assistant message',
          details: err instanceof Error ? err.message : String(err),
          error: String(err),
        });
        throw err;
      }
    },

    openEvents(cursor, onEvent, onClose) {
      logger.info(`Opening SSE event stream from cursor #${cursor}`);
      return base.openEvents(
        cursor,
        (event: any) => {
          logger.debug(`SSE Event received: ${event?.type} (seq #${event?.sequence}, rev ${event?.revision ?? 'N/A'})`, event);
          onEvent(event);
        },
        () => {
          logger.warn(`SSE stream closed. Reconnection will follow.`);
          onClose();
        }
      );
    },
  };
}
