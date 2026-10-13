import { z } from 'zod';
import { tool } from 'ai';
import { deterministicUuid, type InteractionRepository, type DomainDefinition } from 'interaction-builder/runtime';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

export interface CohortAiToolsDeps {
  workspaceId: string;
  ownerId: string;
  repo: InteractionRepository;
  domain: DomainDefinition<CohortWorkspace>;
  observedRevision?: number;
  runFence?: { runId: string; leaseToken: string };
  onToolStep?: (
    toolName: string,
    inputPayload: unknown,
    actionFn: (meta?: { ordinal: number; requestId: string }) => Promise<unknown>
  ) => Promise<unknown>;
}

export function createCohortAiTools(deps: CohortAiToolsDeps) {
  const { workspaceId, ownerId, repo, domain } = deps;

  let currentRevision: number | undefined = deps.observedRevision;
  let commitQueue: Promise<unknown> = Promise.resolve();

  async function executeAction(toolName: string, inputPayload: unknown, action: any) {
    const currentTask = commitQueue.then(async () => {
      const runCommit = async (meta?: { ordinal: number; requestId: string }) => {
        if (currentRevision === undefined) {
          const ws = await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId });
          if (!ws) throw new Error('WORKSPACE_NOT_FOUND');
          currentRevision = ws.revision;
        }

        // Derive deterministic actionId when retrying with a stable requestId
        const actionId = meta?.requestId ? deterministicUuid('action:' + meta.requestId) : crypto.randomUUID();

        // Normalize action with deterministic entity ID for add_lesson if not supplied
        let normalizedAction = action;
        if (action && typeof action === 'object' && action.type === 'add_lesson') {
          const lessonId = action.lessonId ?? (meta?.requestId ? deterministicUuid('lesson:' + meta.requestId) : crypto.randomUUID());
          normalizedAction = { ...action, lessonId };
        }

        const expectedRevision = currentRevision;
        const envelope = {
          actionId,
          workspaceId,
          expectedRevision,
          entityVersions: [],
          action: normalizedAction,
        };

        const res = await repo.commitAction({
          workspaceId,
          ownerId,
          expectedRevision,
          envelope,
          plan: domain.plan,
          runFence: deps.runFence,
          requestId: meta?.requestId,
        });

        // Advance this run's tracked revision strictly from the successful commit receipt
        currentRevision = res.revision;

        return {
          success: true,
          revision: res.revision,
          summary: res.receipt.summary,
          changed: res.receipt.changed,
        };
      };

      let stepRes: any;
      if (deps.onToolStep) {
        stepRes = await deps.onToolStep(toolName, inputPayload, runCommit);
      } else {
        stepRes = await runCommit();
      }

      // If onToolStep returned a recovered/journaled step without running runCommit,
      // advance currentRevision from the recovered result
      if (stepRes && typeof stepRes.revision === 'number') {
        currentRevision = Math.max(currentRevision ?? 0, stepRes.revision);
      }

      return stepRes;
    });

    commitQueue = currentTask.catch(() => {});
    return currentTask;
  }

  return {
    set_intent: tool({
      description: 'Update the overall learning goal or intent of the cohort.',
      inputSchema: z.object({
        intent: z.string().describe('Clear, focused learning intent or topic.'),
      }),
      execute: async ({ intent }) => executeAction('set_intent', { intent }, { type: 'set_intent', intent }),
    }),

    set_audience: tool({
      description: 'Update the target audience profile for the cohort.',
      inputSchema: z.object({
        audience: z.string().describe('Target learner persona, background, or skill level.'),
      }),
      execute: async ({ audience }) => executeAction('set_audience', { audience }, { type: 'set_audience', audience }),
    }),

    set_daily_minutes: tool({
      description: 'Update the expected daily learning commitment in minutes.',
      inputSchema: z.object({
        dailyMinutes: z.number().int().min(1).max(1440).describe('Target daily learning time in minutes.'),
      }),
      execute: async ({ dailyMinutes }) => executeAction('set_daily_minutes', { dailyMinutes }, { type: 'set_daily_minutes', dailyMinutes }),
    }),

    edit_lesson: tool({
      description: 'Edit a specific lesson title or objective.',
      inputSchema: z.object({
        lessonId: z.string().describe('ID of the lesson to edit.'),
        title: z.string().optional().describe('New lesson title.'),
        objective: z.string().optional().describe('New learning objective.'),
      }),
      execute: async ({ lessonId, title, objective }) => executeAction('edit_lesson', { lessonId, title, objective }, { type: 'edit_lesson', lessonId, title, objective }),
    }),

    reorder_lessons: tool({
      description: 'Reorder the complete sequence of lessons by their IDs.',
      inputSchema: z.object({
        lessonIds: z.array(z.string()).describe('Exhaustive list of all lesson IDs in the new order.'),
      }),
      execute: async ({ lessonIds }) => executeAction('reorder_lessons', { lessonIds }, { type: 'reorder_lessons', lessonIds }),
    }),

    set_lesson_pin: tool({
      description: 'Pin or unpin a lesson to protect it from automated overwrite.',
      inputSchema: z.object({
        lessonId: z.string().describe('ID of the lesson.'),
        pinned: z.boolean().describe('True to pin, false to unpin.'),
      }),
      execute: async ({ lessonId, pinned }) => executeAction('set_lesson_pin', { lessonId, pinned }, { type: 'set_lesson_pin', lessonId, pinned }),
    }),

    add_lesson: tool({
      description: 'Add a new lesson to the cohort curriculum.',
      inputSchema: z.object({
        title: z.string().describe('Title of the lesson.'),
        objective: z.string().describe('Clear learning objective of the lesson.'),
      }),
      execute: async ({ title, objective }) => executeAction('add_lesson', { title, objective }, { type: 'add_lesson', title, objective }),
    }),

    remove_lesson: tool({
      description: 'Remove an unpinned lesson from the cohort curriculum.',
      inputSchema: z.object({
        lessonId: z.string().describe('ID of the lesson to remove.'),
      }),
      execute: async ({ lessonId }) => executeAction('remove_lesson', { lessonId }, { type: 'remove_lesson', lessonId }),
    }),
  };
}
