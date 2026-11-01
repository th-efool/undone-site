import { expect, it } from 'vitest';
import { initialCohort } from '@/src/shared/cohort-builder/intake';
import { cohortAssistantPrompt } from '@/src/server/domain/cohort-builder/context';

it('keeps legacy source text and chunk evidence out of planning context', () => {
  const state = initialCohort('Learn venture capital', { mode: 'plan', sources: [{
    id: 'source-one', version: 1, label: 'Attached video title',
    text: 'PRIVATE_TRANSCRIPT_SENTINEL', checksum: null, state: 'ready',
  }] });
  state.chunks.push({ id: 'chunk-one', sourceId: 'source-one', sourceVersion: 1,
    start: 0, end: 10, text: 'PRIVATE_CHUNK_SENTINEL', checksum: 'a'.repeat(64) });
  const prompt = cohortAssistantPrompt(state, 0);
  expect(prompt).toContain('Attached video title');
  expect(prompt).toContain('Learn venture capital');
  expect(prompt).not.toContain('PRIVATE_TRANSCRIPT_SENTINEL');
  expect(prompt).not.toContain('PRIVATE_CHUNK_SENTINEL');
  expect(prompt).not.toContain('then immediately call begin_material_processing');
  state.journey!.processingStarted = true;
  const processingPrompt = cohortAssistantPrompt(state, 0);
  expect(processingPrompt).toContain('PRIVATE_TRANSCRIPT_SENTINEL');
  expect(processingPrompt).toContain('PRIVATE_CHUNK_SENTINEL');
});
