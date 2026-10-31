import { expect, it } from 'vitest';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { cohortAssistantPrompt } from '@/src/server/domain/cohort-builder/context';
it('responds to an initial topic without mandatory metadata tool calls', () => {
  const state = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Draft', intent: 'Data science', audience: '', dailyMinutes: 20, lessons: [] });
  const prompt = cohortAssistantPrompt(state, 0);
  expect(prompt).toContain('The initial intent is already saved');
  expect(prompt).not.toContain('Update set_intent and edit_presentation immediately');
  expect(prompt).toContain('YOU MUST EXECUTE THE APPROPRIATE TOOL CALL');
});
