import { describe, expect, it, vi } from 'vitest';
import { createCohortAiTools } from '../tools';
import { cohortDomain } from '../domain';
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
    const keys = Object.keys(tools);
    expect(keys).toEqual(['create_own_cohort', 'choose_starting_point', 'set_intent']);
    expect(keys).not.toContain('add_youtube_source');
    expect(keys).not.toContain('edit_lesson');
    expect(keys).not.toContain('commit_release');
  });

  it('filters tools strictly for the material_input stage', () => {
    const tools = createCohortAiTools({ ...baseDeps, stage: 'material_input' });
    const keys = Object.keys(tools);
    expect(keys).toContain('add_youtube_source');
    expect(keys).toContain('add_web_source');
    expect(keys).toContain('add_pdf_source');
    expect(keys).toContain('add_github_source');
    expect(keys).toContain('begin_material_processing');
    expect(keys).not.toContain('edit_lesson');
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
});
