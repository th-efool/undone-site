import { describe, expect, it } from 'vitest';
import { MemoryInteractionRepository, type DomainDefinition } from 'interaction-builder/runtime';
import { cohortWorkspaceSchema, planCohortAction, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { createCohortAiTools } from '../tools';
import { selectedLessonForLatestTurn } from '../selection';

const ownerId = 'user-1';
const workspaceId = '35c73013-7a2c-4e62-95be-688a15f4f9d1';
const domain: DomainDefinition<CohortWorkspace> = {
  id: 'cohort', version: 1, initialState: input => cohortWorkspaceSchema.parse(input), plan: planCohortAction,
};

async function setup() {
  const repo = new MemoryInteractionRepository();
  await repo.createWorkspace({ id: workspaceId, ownerId, domainId: 'cohort', domainVersion: 1, initialSnapshot: cohortWorkspaceSchema.parse({
    schemaVersion: 1, title: 'Systems', intent: 'Learn systems', audience: 'Engineers', dailyMinutes: 25,
    lessons: [
      { id: 'lesson-a', version: 0, title: 'A', objective: 'First', sourceChunkIds: [], pinned: false },
      { id: 'lesson-b', version: 0, title: 'B', objective: 'Second', sourceChunkIds: [], pinned: false },
    ],
  }) });
  return repo;
}

describe('selected lesson tool boundary', () => {
  it('derives the selected target from the owned latest message and rejects another target', async () => {
    const repo = await setup();
    await repo.appendMessage({ workspaceId, ownerId, id: crypto.randomUUID(), role: 'user', parts: [
      { type: 'text', text: 'Shorten this lesson' },
      { type: 'entity_ref', entity: { kind: 'lesson', id: 'lesson-a', version: 0 }, label: 'A' },
    ] });
    const selectedLesson = await selectedLessonForLatestTurn(repo, ownerId, workspaceId);
    expect(selectedLesson).toEqual({ id: 'lesson-a', version: 0 });
    const tools = createCohortAiTools({ workspaceId, ownerId, repo, domain, selectedLesson });
    await expect(tools.edit_lesson.execute!({ lessonId: 'lesson-b', objective: 'Wrong edit' }, {} as never)).rejects.toThrow('SELECTED_LESSON_MISMATCH');
    const afterWrong = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!;
    expect(afterWrong.revision).toBe(0);
    await tools.edit_lesson.execute!({ lessonId: 'lesson-a', objective: 'Short objective' }, {} as never);
    const afterRight = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!;
    expect(afterRight.snapshot.lessons[0].objective).toBe('Short objective');
    expect(afterRight.snapshot.lessons[1].objective).toBe('Second');
  });

  it('rejects a stale selected entity version even when the workspace revision is current', async () => {
    const repo = await setup();
    await repo.commitAction({ ownerId, workspaceId, expectedRevision: 0,
      envelope: { actionId: crypto.randomUUID(), workspaceId, expectedRevision: 0, entityVersions: [], action: { type: 'edit_lesson', lessonId: 'lesson-a', objective: 'User edit' } },
      plan: planCohortAction,
    });
    const tools = createCohortAiTools({ workspaceId, ownerId, repo, domain, observedRevision: 1, selectedLesson: { id: 'lesson-a', version: 0 } });
    await expect(tools.edit_lesson.execute!({ lessonId: 'lesson-a', objective: 'Stale AI edit' }, {} as never)).rejects.toThrow('STALE_ENTITY');
    await expect(tools.remove_lesson.execute!({ lessonId: 'lesson-a' }, {} as never)).rejects.toThrow('STALE_ENTITY');
    const after = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!;
    expect(after.snapshot.lessons[0].objective).toBe('User edit');
  });

  it('uses the triggering message selection when a newer user turn arrives', async () => {
    const repo = await setup();
    const triggeringMessageId = crypto.randomUUID();
    await repo.appendMessage({ workspaceId, ownerId, id: triggeringMessageId, role: 'user', parts: [
      { type: 'text', text: 'Refine the first lesson' },
      { type: 'entity_ref', entity: { kind: 'lesson', id: 'lesson-a', version: 0 }, label: 'A' },
    ] });
    await repo.appendMessage({ workspaceId, ownerId, id: crypto.randomUUID(), role: 'user', parts: [
      { type: 'text', text: 'Now discuss the second lesson' },
      { type: 'entity_ref', entity: { kind: 'lesson', id: 'lesson-b', version: 0 }, label: 'B' },
    ] });
    expect(await selectedLessonForLatestTurn(repo, ownerId, workspaceId, triggeringMessageId)).toEqual({ id: 'lesson-a', version: 0 });
  });
});
