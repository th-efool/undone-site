// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import { ReadyStageView } from '../stages/ReadyStageView';

function createReadyWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Ready Cohort Test',
    intent: 'Master Distributed Systems',
    audience: 'Engineers',
    dailyMinutes: 30,
    lessons: [
      {
        id: 'lesson-1',
        version: 1,
        title: 'Introduction to Consensus',
        objective: 'Understand Paxos and Raft fundamentals',
        sourceChunkIds: [],
        pinned: false,
      },
    ],
    sources: [
      {
        id: 'src-1',
        version: 1,
        label: 'Consensus Video',
        text: 'retained transcript',
        checksum: null,
        state: 'ready',
        input: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', mode: 'video_observation' },
      },
    ],
    chunks: [
      {
        id: 'chk-1',
        sourceId: 'src-1',
        sourceVersion: 1,
        start: 0,
        end: 100,
        text: 'chunk 1 text',
        checksum: 'a'.repeat(64),
      },
    ],
    understanding: [],
    analyses: [],
    processing: {
      status: 'ready',
      stage: 'done',
      generation: 1,
      sourceFingerprint: 'fp-123',
      error: null,
    },
    journey: {
      version: 1,
      step: 'ready',
      branch: 'have_material',
      processingStarted: true,
      intentVersion: 0,
    },
    ...overrides,
  });
}

describe('ReadyStageView (Incident G2 Back repair and Action Gates)', () => {
  let dispatchedActions: any[] = [];
  let actionResults: Record<string, boolean> = {};

  beforeEach(() => {
    dispatchedActions = [];
    actionResults = {};
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockDispatchAction = async (action: any) => {
    dispatchedActions.push(action);
    if (action.type in actionResults) {
      return actionResults[action.type];
    }
    return true;
  };

  it('1. Incomplete build: Back button is actionable and dispatches back_to_starting_point then choose_starting_point', async () => {
    // Incomplete build: processing.status is 'queued' or 'processing', lessons may be empty
    const ws = createReadyWorkspace({
      lessons: [],
      processing: {
        status: 'queued',
        stage: 'acquisition',
        generation: 1,
        sourceFingerprint: null,
        error: null,
      },
    });

    render(<ReadyStageView workspace={ws} dispatchAction={mockDispatchAction} />);

    // Shows "Build not complete"
    expect(screen.getByText('Build not complete')).toBeTruthy();

    // Primary action and review buttons are disabled
    const feedBtn = screen.getByRole('button', { name: /Go to my feed/i });
    const reviewBtn = screen.getByRole('button', { name: /Review cohort/i });
    expect((feedBtn as HTMLButtonElement).disabled).toBe(true);
    expect((reviewBtn as HTMLButtonElement).disabled).toBe(true);

    // Back to material button is NOT disabled
    const backBtn = screen.getByRole('button', { name: /Back to material/i });
    expect((backBtn as HTMLButtonElement).disabled).toBe(false);

    // Clicking Back dispatches both actions sequentially
    await act(async () => {
      fireEvent.click(backBtn);
    });

    expect(dispatchedActions).toEqual([
      { type: 'back_to_starting_point' },
      { type: 'choose_starting_point', choice: 'have_material' },
    ]);
  });

  it('2. Back navigation aborts second transition if back_to_starting_point returns false', async () => {
    actionResults['back_to_starting_point'] = false;

    const ws = createReadyWorkspace({
      lessons: [],
      processing: {
        status: 'queued',
        stage: 'acquisition',
        generation: 1,
        sourceFingerprint: null,
        error: null,
      },
    });

    render(<ReadyStageView workspace={ws} dispatchAction={mockDispatchAction} />);

    const backBtn = screen.getByRole('button', { name: /Back to material/i });
    await act(async () => {
      fireEvent.click(backBtn);
    });

    // First action was dispatched, second was aborted
    expect(dispatchedActions).toEqual([{ type: 'back_to_starting_point' }]);
  });

  it('3. When ready is true, Review and Feed actions are enabled and dispatch expected actions', async () => {
    const ws = createReadyWorkspace();
    render(<ReadyStageView workspace={ws} dispatchAction={mockDispatchAction} />);

    expect(screen.getByText('Processed')).toBeTruthy();

    const feedBtn = screen.getByRole('button', { name: /Go to my feed/i });
    const reviewBtn = screen.getByRole('button', { name: /Review cohort/i });

    expect((feedBtn as HTMLButtonElement).disabled).toBe(false);
    expect((reviewBtn as HTMLButtonElement).disabled).toBe(false);

    // Test Review click
    await act(async () => {
      fireEvent.click(reviewBtn);
    });

    expect(dispatchedActions).toContainEqual({ type: 'open_review' });

    dispatchedActions = [];

    // Test Feed click (prepare_release then open_review)
    await act(async () => {
      fireEvent.click(feedBtn);
    });

    expect(dispatchedActions).toEqual([
      { type: 'prepare_release', mode: 'private_activation' },
      { type: 'open_review' },
    ]);
  });
});
