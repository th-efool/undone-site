import { describe, expect, it, vi } from 'vitest';
import { createCohortAiTools } from '../tools';
import { cohortAssistantPrompt } from '../context';
import { cohortDomain } from '../domain';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import type { InteractionRepository } from 'interaction-builder/runtime';

describe('AI Tools Optimization & Stage Filtering', () => {
  const dummyRepo = {} as InteractionRepository;
  const baseDeps = {
    workspaceId: 'ws-1',
    ownerId: 'user-1',
    repo: dummyRepo,
    domain: cohortDomain,
  };

  it('filters tools strictly for the recommendations stage', () => {
    const tools = createCohortAiTools({ ...baseDeps, stage: 'recommendations' });
    const keys = Object.keys(tools).sort();
    expect(keys).toEqual(['start_search', 'set_intent', 'create_own_cohort', 'choose_starting_point'].sort());
    expect(keys).not.toContain('add_youtube_source');
    expect(keys).not.toContain('edit_lesson');
    expect(keys).not.toContain('commit_release');
  });

  it('filters tools strictly for the chat stage and includes owned PDF attachment', () => {
    const tools = createCohortAiTools({ ...baseDeps, stage: 'chat' });
    const keys = Object.keys(tools);
    expect(keys).toContain('start_search');
    expect(keys).toContain('set_intent');
    expect(keys).toContain('add_web_source');
    expect(keys).toContain('add_youtube_source');
    expect(keys).toContain('add_pdf_source');
  });

  it('filters tools strictly for the material_input stage', () => {
    const tools = createCohortAiTools({ ...baseDeps, stage: 'material_input' });
    const keys = Object.keys(tools);
    expect(keys).toContain('add_youtube_source');
    expect(keys).toContain('add_web_source');
    expect(keys).toContain('add_pdf_source');
    expect(keys).toContain('add_github_source');
    expect(keys).toContain('begin_material_processing');
    expect(keys).toContain('edit_lesson');
    expect(keys).not.toContain('commit_release');
  });

  it('filters tools strictly for the processing stage', () => {
    const tools = createCohortAiTools({ ...baseDeps, stage: 'processing' });
    const keys = Object.keys(tools).sort();
    expect(keys).toEqual(['cancel_source_processing', 'cancel_text_processing', 'retry_text_job'].sort());
    expect(keys).not.toContain('add_youtube_source');
    expect(keys).not.toContain('edit_lesson');
  });

  it('filters tools strictly for the ready stage', () => {
    const tools = createCohortAiTools({ ...baseDeps, stage: 'ready' });
    const keys = Object.keys(tools);
    expect(keys).toContain('edit_lesson');
    expect(keys).toContain('reorder_lessons');
    expect(keys).toContain('set_lesson_pin');
    expect(keys).toContain('add_lesson');
    expect(keys).toContain('remove_lesson');
    expect(keys).toContain('prepare_release');
    expect(keys).toContain('commit_release');
    expect(keys).not.toContain('add_youtube_source');
    expect(keys).not.toContain('begin_material_processing');
  });

  it('returns all tools when stage is undefined or unknown (backwards compatibility)', () => {
    const tools = createCohortAiTools(baseDeps);
    const keys = Object.keys(tools);
    expect(keys.length).toBeGreaterThanOrEqual(25);
    expect(keys).toContain('add_youtube_source');
    expect(keys).toContain('edit_lesson');
    expect(keys).toContain('commit_release');
  });

  it('limits source excerpt budget to 2000 chars in early stages and 240 chars after lessons are created', () => {
    const longText = 'A'.repeat(3000);
    const earlyWorkspace = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'ML Cohort',
      intent: 'Learn ML',
      audience: 'Engineers',
      dailyMinutes: 30,
      journey: {
        version: 1,
        step: 'chat',
        branch: 'have_material',
        processingStarted: false,
        intentVersion: 1,
      },
      sources: [
        {
          id: 'src-1',
          version: 1,
          label: 'Long Source',
          checksum: 'a'.repeat(64),
          state: 'ready',
          text: longText,
          input: { kind: 'web', url: 'https://example.com' },
        },
      ],
      lessons: [],
    });

    const earlyPrompt = cohortAssistantPrompt(earlyWorkspace, 1);
    expect(earlyPrompt).toContain('"excerpt":"' + 'A'.repeat(2000) + '"');
    expect(earlyPrompt).not.toContain('A'.repeat(2001));

    const readyWorkspace = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'ML Cohort',
      intent: 'Learn ML',
      audience: 'Engineers',
      dailyMinutes: 30,
      journey: {
        version: 1,
        step: 'ready',
        branch: 'have_material',
        processingStarted: true,
        intentVersion: 1,
      },
      sources: [
        {
          id: 'src-1',
          version: 1,
          label: 'Long Source',
          checksum: 'a'.repeat(64),
          state: 'ready',
          text: longText,
          input: { kind: 'web', url: 'https://example.com' },
        },
      ],
      lessons: [
        {
          id: 'lesson-1',
          version: 1,
          title: 'Lesson 1',
          objective: 'Objective 1',
          pinned: false,
          sourceChunkIds: [],
        },
      ],
    });

    const readyPrompt = cohortAssistantPrompt(readyWorkspace, 2);
    expect(readyPrompt).toContain('"excerpt":"' + 'A'.repeat(240) + '"');
    expect(readyPrompt).not.toContain('A'.repeat(241));
  });
});
