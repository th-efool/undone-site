// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';

const fake = vi.hoisted(() => ({
  state: null as CohortWorkspace | null,
  actions: [] as any[],
  succeeds: true,
  session: {
    status: 'authenticated',
    data: { user: { id: 'owner-alice' } },
  } as { status: string; data: any },
}));

vi.mock('next-auth/react', () => ({
  useSession: () => fake.session,
}));

vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceConnection: () => 'live',
  useInteractionState: () => ({
    workspaceId: 'ws-test-checkpoint5-proc',
    revision: 1,
    view: fake.state,
  }),
  useWorkspaceView: () => fake.state,
  useDispatchAction: () => async (action: any) => {
    fake.actions.push(action);
    return fake.succeeds;
  },
  useWorkspaceMessages: () => [],
  useSendMessage: () => async () => true,
}));

vi.mock('@/src/client/interaction/provider', () => ({
  InteractionProvider: ({ children }: any) => <>{children}</>,
}));

import { CohortWorkspacePane } from '../CohortWorkspacePane';
import { ReadyStageView } from '../stages/ReadyStageView';

function createProcessingWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems Cohort',
    intent: 'Master Distributed Consensus',
    audience: 'Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [
      {
        id: 's1',
        version: 0,
        label: 'Consensus Guide.pdf',
        text: 'Raft quorums intersect and logs replicate entries in order.',
        checksum: 'a'.repeat(64),
        state: 'processing',
      },
    ],
    chunks: [
      {
        id: 'c1',
        sourceId: 's1',
        sourceVersion: 0,
        start: 0,
        end: 50,
        text: 'Raft quorums intersect and logs replicate entries in order.',
        checksum: 'b'.repeat(64),
      },
    ],
    understanding: [
      {
        sourceId: 's1',
        sourceVersion: 0,
        topics: ['Quorum intersection', 'Leader election'],
      },
    ],
    analyses: [
      {
        chunkId: 'c1',
        summary: 'Overview of consensus protocols and quorums.',
        question: 'Why do write and read quorums need to intersect?',
      },
    ],
    processing: {
      status: 'processing',
      stage: 'chunking',
      generation: 1,
      sourceFingerprint: null,
      error: null,
      jobs: [
        {
          id: 'j-und',
          sourceId: 's1',
          stage: 'understanding',
          status: 'accepted',
          attempts: 1,
          error: null,
          retryable: false,
        },
        {
          id: 'j-chk',
          sourceId: 's1',
          stage: 'chunking',
          status: 'running',
          attempts: 1,
          error: null,
          retryable: true,
        },
      ],
    },
    journey: {
      version: 1,
      step: 'processing',
      branch: 'have_material',
      processingStarted: true,
      intentVersion: 0,
    },
    ...overrides,
  });
}

function createReadyWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems Cohort',
    intent: 'Master Distributed Consensus',
    audience: 'Engineers',
    dailyMinutes: 30,
    sources: [
      {
        id: 's1',
        version: 0,
        label: 'Consensus Guide.pdf',
        text: 'Raft quorums intersect and logs replicate entries in order.',
        checksum: 'a'.repeat(64),
        state: 'ready',
      },
    ],
    chunks: [
      {
        id: 'c1',
        sourceId: 's1',
        sourceVersion: 0,
        start: 0,
        end: 50,
        text: 'Raft quorums intersect and logs replicate entries in order.',
        checksum: 'b'.repeat(64),
      },
    ],
    understanding: [
      {
        sourceId: 's1',
        sourceVersion: 0,
        topics: ['Quorum intersection', 'Leader election'],
      },
    ],
    analyses: [
      {
        chunkId: 'c1',
        summary: 'Overview of consensus protocols and quorums.',
        question: 'Why do write and read quorums need to intersect?',
      },
    ],
    lessons: [
      {
        id: 'l1',
        version: 0,
        title: 'Understanding Raft Quorums',
        objective: 'Learn why write and read quorums must overlap.',
        pinned: false,
        sourceChunkIds: ['c1'],
      },
      {
        id: 'l2',
        version: 0,
        title: 'Leader Election & Heartbeats',
        objective: 'Understand term numbers and randomized timeouts.',
        pinned: true,
        sourceChunkIds: ['c1'],
      },
    ],
    processing: {
      status: 'ready',
      stage: 'done',
      generation: 1,
      sourceFingerprint: 'fp-1234',
      error: null,
      jobs: [
        { id: 'j-und', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
        { id: 'j-chk', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
        { id: 'j-ana', sourceId: 's1', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
        { id: 'j-asm', sourceId: null, stage: 'assembly', status: 'accepted', attempts: 1, error: null, retryable: false },
      ],
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

describe('Journey Checkpoint 5: Processing and Ready Stages UI', () => {
  beforeEach(() => {
    fake.state = null;
    fake.actions = [];
    fake.succeeds = true;
  });

  afterEach(() => {
    cleanup();
  });

  describe('Processing Stage: Derivation & Rendering', () => {
    it('renders ChunkingStageView when chunking job is active', () => {
      const ws = createProcessingWorkspace();
      fake.state = ws;

      render(
        <CohortWorkspacePane onSelectLessonForChat={() => {}} />
      );

      // Verify active chunking presentation is mounted
      expect(screen.getByLabelText(/Chunking material/i)).toBeTruthy();
      expect(screen.getByText(/Turning content into learning pieces/i)).toBeTruthy();
      // Verify stepper shows progress
      expect(screen.getAllByText(/Understanding/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Chunking/i).length).toBeGreaterThan(0);
    });

    it('renders UnderstandingStageView when understanding job is running', () => {
      const ws = createProcessingWorkspace({
        processing: {
          status: 'processing',
          stage: 'understanding',
          generation: 1,
          sourceFingerprint: null,
          error: null,
          jobs: [
            {
              id: 'j-und',
              sourceId: 's1',
              stage: 'understanding',
              status: 'running',
              attempts: 1,
              error: null,
              retryable: true,
            },
          ],
        },
      });
      fake.state = ws;

      render(
        <CohortWorkspacePane onSelectLessonForChat={() => {}} />
      );

      expect(screen.getByLabelText(/Understanding material/i)).toBeTruthy();
      expect(screen.getByText(/Understanding your material/i)).toBeTruthy();
    });
  });

  describe('Processing Stage: Stepper Inspection', () => {
    it('allows inspecting completed understanding stage without mutating workspace or dispatching actions', async () => {
      const ws = createProcessingWorkspace();
      fake.state = ws;

      render(
        <CohortWorkspacePane onSelectLessonForChat={() => {}} />
      );

      // Active is chunking
      expect(screen.getByLabelText(/Chunking material/i)).toBeTruthy();

      // Click on completed "Understanding" step in stepper
      const stepItem = screen.getByText('Understanding').closest('li')!;
      await act(async () => {
        fireEvent.click(stepItem);
      });

      // Inspection banner appears
      const banner = screen.getByTestId('stage-inspection-banner');
      expect(banner.textContent).toContain('understanding');
      expect(banner.textContent).toContain('Return to active stage');

      // Understanding view is now rendered in place of chunking
      expect(screen.getByLabelText(/Understanding material/i)).toBeTruthy();

      // No actions were dispatched by inspection
      expect(fake.actions).toHaveLength(0);

      // Click return to active stage
      const returnBtn = screen.getByRole('button', { name: /Reset to active stage/i });
      await act(async () => {
        fireEvent.click(returnBtn);
      });

      // Banner is dismissed and Chunking view returns
      expect(screen.queryByTestId('stage-inspection-banner')).toBeNull();
      expect(screen.getByLabelText(/Chunking material/i)).toBeTruthy();
      expect(fake.actions).toHaveLength(0);
    });
  });

  describe('Ready Stage: ReadyStageView Presentation & Actions', () => {
    it('renders exact Screen 8 presentation matching AFTER specifications', () => {
      const ws = createReadyWorkspace();
      fake.state = ws;

      render(
        <ReadyStageView
          workspace={ws}
          dispatchAction={async (action) => {
            fake.actions.push(action);
            return true;
          }}
        />
      );

      // Header and Rays
      expect(screen.getByText(/Your learning experience is ready/i)).toBeTruthy();
      expect(screen.getByRole('heading', { level: 1, name: /All set/i })).toBeTruthy();
      expect(
        screen.getByText(/I’ve turned your material into a learning experience/i)
      ).toBeTruthy();

      // Material summary card
      expect(screen.getByText('Master Distributed Consensus')).toBeTruthy();
      expect(screen.getByText(/1 source · 1 learning pieces · 2 lessons/i)).toBeTruthy();
      expect(screen.getByText('Processed')).toBeTruthy();

      // 4 Feature cards
      expect(screen.getByText('Learning pieces')).toBeTruthy();
      expect(screen.getByText('Source evidence')).toBeTruthy();
      expect(screen.getByText('Learning objectives')).toBeTruthy();
      expect(screen.getByText('Private by default')).toBeTruthy();

      // Notes row
      expect(screen.getByText('Your material')).toBeTruthy();
      expect(screen.getByText('Your own pace')).toBeTruthy();
      expect(screen.getByText('Review first, if you like')).toBeTruthy();

      // CTAs
      expect(screen.getByRole('button', { name: /Go to my feed/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Review cohort/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Back to material/i })).toBeTruthy();
    });

    it('dispatches open_review when clicking Review cohort', async () => {
      const ws = createReadyWorkspace();
      fake.state = ws;

      render(
        <ReadyStageView
          workspace={ws}
          dispatchAction={async (action) => {
            fake.actions.push(action);
            return true;
          }}
        />
      );

      const reviewBtn = screen.getByRole('button', { name: /Review cohort/i });
      await act(async () => {
        fireEvent.click(reviewBtn);
      });

      expect(fake.actions).toEqual([{ type: 'open_review' }]);
    });

    it('dispatches prepare_release and open_review when clicking Go to my feed', async () => {
      const ws = createReadyWorkspace();
      fake.state = ws;

      render(
        <ReadyStageView
          workspace={ws}
          dispatchAction={async (action) => {
            fake.actions.push(action);
            return true;
          }}
        />
      );

      const activateBtn = screen.getByRole('button', { name: /Go to my feed/i });
      await act(async () => {
        fireEvent.click(activateBtn);
      });

      expect(fake.actions).toEqual([
        { type: 'prepare_release', mode: 'private_activation' },
        { type: 'open_review' },
      ]);
    });

    it('dispatches back_to_starting_point when clicking Back to material', async () => {
      const ws = createReadyWorkspace();
      fake.state = ws;

      render(
        <ReadyStageView
          workspace={ws}
          dispatchAction={async (action) => {
            fake.actions.push(action);
            return true;
          }}
        />
      );

      const backBtn = screen.getByRole('button', { name: /Back to material/i });
      await act(async () => {
        fireEvent.click(backBtn);
      });

      expect(fake.actions).toEqual([{ type: 'back_to_starting_point' }]);
    });
  });
});
