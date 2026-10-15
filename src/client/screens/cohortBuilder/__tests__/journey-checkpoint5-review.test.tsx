// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import { clearAllDraftsForTesting, CohortDraftProvider } from '../draft-context';

const fake = vi.hoisted(() => ({
  state: null as CohortWorkspace | null,
  actions: [] as any[],
  succeeds: true,
  session: {
    status: 'authenticated',
    data: { user: { id: 'owner-alice', name: 'Alice Walker' } },
  } as { status: string; data: any },
}));

vi.mock('next-auth/react', () => ({
  useSession: () => fake.session,
}));

vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceConnection: () => 'live',
  useInteractionState: () => ({
    workspaceId: 'ws-test-checkpoint5-rev',
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
import { CurriculumStageView } from '../stages/CurriculumStageView';
import { PublicationStageView } from '../stages/PublicationStageView';

function createReviewWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems Blueprint',
    intent: 'Master Distributed Consensus and Fault Tolerance',
    audience: 'Senior Engineers',
    dailyMinutes: 45,
    sources: [
      {
        id: 's1',
        version: 0,
        label: 'Consensus Guide.pdf',
        text: 'Raft quorums intersect and logs replicate entries in order.',
        checksum: 'a'.repeat(64),
        state: 'ready',
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'a'.repeat(64),
          scope: 'selected_pages',
          pageCount: 12,
        },
      },
      {
        id: 's2',
        version: 0,
        label: 'Raft Protocol Talk',
        text: 'Leader election happens when heartbeats timeout.',
        input: {
          kind: 'youtube',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          mode: 'video_observation',
        },
        locations: [
          {
            start: 0,
            end: 50,
            startMs: 0,
            endMs: 60000,
          },
        ],
        checksum: 'b'.repeat(64),
        state: 'ready',
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'b'.repeat(64),
          scope: 'video_observation',
          videoId: 'dQw4w9WgXcQ',
          contentOrigin: 'ai',
          limitations: ['Non-exhaustive coverage; timestamps are estimated.'],
          estimatedIntervals: true,
        },
      },
      {
        id: 's3',
        version: 0,
        label: 'AI-Authored Study Guide',
        text: 'Quorum intersection guarantees write visibility across partitions.',
        input: {
          kind: 'generated_guide',
          goal: 'Understand quorums',
          dailyMinutes: 30,
          audience: 'Engineers',
          intentVersion: 0,
        },
        locations: [
          {
            start: 0,
            end: 60,
          },
        ],
        checksum: 'c'.repeat(64),
        state: 'ready',
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'c'.repeat(64),
          scope: 'ai_authored_guide',
          contentOrigin: 'ai',
          limitations: ['AI-authored learning guide, not verified external source material.'],
        },
      },
      {
        id: 's4',
        version: 0,
        label: 'Paxos Lecture Track',
        text: 'Synod algorithm guarantees single-decree consensus.',
        input: {
          kind: 'youtube',
          url: 'https://www.youtube.com/watch?v=y6120QOlsfU',
          mode: 'transcript',
          track: { id: 'track-en', language: 'en', kind: 'automatic', translated: false },
        },
        locations: [
          {
            start: 0,
            end: 50,
            startMs: 12000,
            endMs: 45000,
          },
        ],
        checksum: 'd'.repeat(64),
        state: 'ready',
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'd'.repeat(64),
          scope: 'transcript_only',
          videoId: 'y6120QOlsfU',
        },
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
        checksum: 'a'.repeat(64),
      },
      {
        id: 'c2',
        sourceId: 's2',
        sourceVersion: 0,
        start: 0,
        end: 50,
        text: 'Leader election happens when heartbeats timeout.',
        checksum: 'b'.repeat(64),
      },
      {
        id: 'c3',
        sourceId: 's3',
        sourceVersion: 0,
        start: 0,
        end: 60,
        text: 'Quorum intersection guarantees write visibility across partitions.',
        checksum: 'c'.repeat(64),
      },
      {
        id: 'c4',
        sourceId: 's4',
        sourceVersion: 0,
        start: 0,
        end: 50,
        text: 'Synod algorithm guarantees single-decree consensus.',
        checksum: 'd'.repeat(64),
      },
    ],
    understanding: [
      {
        sourceId: 's1',
        sourceVersion: 0,
        topics: ['Consensus basics', 'Quorum systems'],
      },
    ],
    analyses: [
      {
        chunkId: 'c1',
        summary: 'Overview of consensus protocols.',
        question: 'Why is quorum overlap sufficient?',
      },
    ],
    lessons: [
      {
        id: 'l1',
        version: 0,
        title: 'Consensus Overview',
        objective: 'Learn why write and read quorums must overlap.',
        pinned: false,
        sourceChunkIds: ['c1'],
      },
      {
        id: 'l2',
        version: 0,
        title: 'Raft Leader Election',
        objective: 'Study term numbers and randomized timeout election.',
        pinned: true,
        sourceChunkIds: ['c2'],
      },
      {
        id: 'l3',
        version: 0,
        title: 'AI Guide to Partitions',
        objective: 'Analyze network splits with AI-authored materials.',
        pinned: false,
        sourceChunkIds: ['c3'],
      },
      {
        id: 'l4',
        version: 0,
        title: 'Paxos Transcript Review',
        objective: 'Examine Synod algorithm and round numbers.',
        pinned: false,
        sourceChunkIds: ['c4'],
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
      step: 'review',
      branch: 'have_material',
      processingStarted: true,
      intentVersion: 0,
    },
    ...overrides,
  });
}

function createPublishedWorkspace(): CohortWorkspace {
  const ws = createReviewWorkspace();
  return {
    ...ws,
    journey: {
      version: 1,
      step: 'published',
      branch: 'have_material',
      processingStarted: true,
      intentVersion: 0,
    },
    release: {
      status: 'released',
      mode: 'public_publish',
      cohortId: 'cohort-pub-999',
      releasedAt: '2026-10-16T00:00:00.000Z',
      candidateHash: 'a'.repeat(64),
      receipt: {
        effectKey: 'a'.repeat(64),
        cohortId: 'cohort-pub-999',
        workspaceId: 'ws-test-checkpoint5-rev',
        mode: 'public_publish',
        releasedAt: '2026-10-16T00:00:00.000Z',
        contentHash: 'a'.repeat(64),
        destinationUrl: '/cohort/cohort-pub-999',
      },
    },
  };
}

describe('Journey Checkpoint 5: Review Stage and Publication UI', () => {
  beforeEach(() => {
    clearAllDraftsForTesting();
    fake.state = null;
    fake.actions = [];
    fake.succeeds = true;
  });

  afterEach(() => {
    cleanup();
    clearAllDraftsForTesting();
  });

  describe('Review Stage: Composition and Toolbar', () => {
    it('renders preview hero banner and review toolbar matching AFTER specifications', () => {
      const ws = createReviewWorkspace();
      fake.state = ws;

      render(
        <CohortDraftProvider workspaceId="ws-test-checkpoint5-rev" ownerId="owner-alice">
          <CurriculumStageView
            workspace={ws}
            workspaceId="ws-test-checkpoint5-rev"
            dispatchAction={async (action) => {
              fake.actions.push(action);
              return true;
            }}
            onSelectLessonForChat={() => {}}
          />
        </CohortDraftProvider>
      );

      // Toolbar checks
      expect(screen.getByText('Draft preview')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Save draft/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Publish publicly/i })).toBeTruthy();

      // Hero banner checks
      expect(screen.getByText('Learning Blueprint')).toBeTruthy();
      expect(screen.getByText('Private draft')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Join Cohort/i })).toBeTruthy();

      // Navigation tabs
      expect(screen.getByRole('button', { name: /Overview/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /What you’ll see/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Community/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /About the creator/i })).toBeTruthy();

      // Lessons count
      expect(screen.getByText(/What you’ll see \(4 lessons\)/i)).toBeTruthy();

      // Source form is inside a collapsible details summary and not permanently open
      const sourceSummary = screen.getByText('Add or edit source text');
      expect(sourceSummary).toBeTruthy();
      const detailsEl = sourceSummary.closest('details');
      expect(detailsEl?.open).toBe(false);
    });
  });

  describe('Review Stage: Canonical Lesson Actions & Invariants', () => {
    it('dispatches set_lesson_pin when clicking pin toggle', async () => {
      const ws = createReviewWorkspace();
      fake.state = ws;

      render(
        <CohortDraftProvider workspaceId="ws-test-checkpoint5-rev" ownerId="owner-alice">
          <CurriculumStageView
            workspace={ws}
            workspaceId="ws-test-checkpoint5-rev"
            dispatchAction={async (action) => {
              fake.actions.push(action);
              return true;
            }}
            onSelectLessonForChat={() => {}}
          />
        </CohortDraftProvider>
      );

      // Pin lesson 1 (currently unpinned)
      const pinButtons = screen.getAllByRole('button', { name: 'Pin lesson' });
      await act(async () => {
        fireEvent.click(pinButtons[0]);
      });

      expect(fake.actions).toContainEqual({
        type: 'set_lesson_pin',
        lessonId: 'l1',
        pinned: true,
      });

      // Unpin lesson 2 (currently pinned)
      const unpinBtn = screen.getByRole('button', { name: 'Unpin lesson' });
      await act(async () => {
        fireEvent.click(unpinBtn);
      });

      expect(fake.actions).toContainEqual({
        type: 'set_lesson_pin',
        lessonId: 'l2',
        pinned: false,
      });
    });

    it('enforces that pinned lessons cannot be deleted', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const ws = createReviewWorkspace();
      fake.state = ws;

      render(
        <CohortDraftProvider workspaceId="ws-test-checkpoint5-rev" ownerId="owner-alice">
          <CurriculumStageView
            workspace={ws}
            workspaceId="ws-test-checkpoint5-rev"
            dispatchAction={async (action) => {
              fake.actions.push(action);
              return true;
            }}
            onSelectLessonForChat={() => {}}
          />
        </CohortDraftProvider>
      );

      // Pinned lesson l2 delete button is disabled
      const deleteButtons = screen.getAllByRole('button', { name: 'Delete lesson' });
      // l2 is at index 1
      expect((deleteButtons[1] as HTMLButtonElement).disabled).toBe(true);

      // Unpinned lesson l1 delete button is enabled; clicking it dispatches remove_lesson
      expect((deleteButtons[0] as HTMLButtonElement).disabled).toBe(false);
      await act(async () => {
        fireEvent.click(deleteButtons[0]);
      });

      expect(fake.actions).toContainEqual({
        type: 'remove_lesson',
        lessonId: 'l1',
      });
    });

    it('dispatches reorder_lessons when clicking move buttons', async () => {
      const ws = createReviewWorkspace();
      fake.state = ws;

      render(
        <CohortDraftProvider workspaceId="ws-test-checkpoint5-rev" ownerId="owner-alice">
          <CurriculumStageView
            workspace={ws}
            workspaceId="ws-test-checkpoint5-rev"
            dispatchAction={async (action) => {
              fake.actions.push(action);
              return true;
            }}
            onSelectLessonForChat={() => {}}
          />
        </CohortDraftProvider>
      );

      // Move lesson 1 down
      const moveDownButtons = screen.getAllByRole('button', { name: 'Move down' });
      await act(async () => {
        fireEvent.click(moveDownButtons[0]);
      });

      expect(fake.actions).toContainEqual({
        type: 'reorder_lessons',
        lessonIds: ['l2', 'l1', 'l3', 'l4'],
      });
    });
  });

  describe('Evidence Provenance Truthfulness', () => {
    it('displays truthful provenance disclaimers across video observation, generated guide, and transcript', () => {
      const ws = createReviewWorkspace();
      fake.state = ws;

      render(
        <CohortDraftProvider workspaceId="ws-test-checkpoint5-rev" ownerId="owner-alice">
          <CurriculumStageView
            workspace={ws}
            workspaceId="ws-test-checkpoint5-rev"
            dispatchAction={async (action) => {
              fake.actions.push(action);
              return true;
            }}
            onSelectLessonForChat={() => {}}
          />
        </CohortDraftProvider>
      );

      // YouTube Video Observation (lesson 2 evidence)
      expect(
        screen.getByText(
          /Retained video observations ready · Coverage is non-exhaustive; timestamps are estimated\./i
        )
      ).toBeTruthy();
      expect(screen.getByText(/AI observation/i)).toBeTruthy();

      // Generated Guide (lesson 3 evidence)
      expect(
        screen.getByText(
          /AI-authored learning guide, not verified external source material\. Check factual claims independently\./i
        )
      ).toBeTruthy();
      expect(screen.getByText(/AI-authored guide/i)).toBeTruthy();

      // YouTube Transcript (lesson 4 evidence)
      expect(screen.getByText(/· transcript/i)).toBeTruthy();
    });
  });

  describe('Publication Stage: Success View and Receipt', () => {
    it('renders PublicationStageView with committed receipt and share links', () => {
      const ws = createPublishedWorkspace();
      fake.state = ws;

      render(
        <CohortWorkspacePane onSelectLessonForChat={() => {}} />
      );

      // Headline and release confirmation
      expect(screen.getByText('Your cohort has been released.')).toBeTruthy();
      expect(screen.getByRole('heading', { name: /Your cohort is live!/i })).toBeTruthy();
      expect(screen.getByText(/It’s now public and anyone can discover it\./i)).toBeTruthy();

      // Destination link and Copy CTA
      const linkInput = screen.getByLabelText('Cohort link') as HTMLInputElement;
      expect(linkInput.value).toContain('/cohort/cohort-pub-999');
      expect(screen.getByRole('button', { name: /Copy/i })).toBeTruthy();

      // Next steps tiles
      expect(screen.getByRole('link', { name: /View cohort/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Share/i })).toBeTruthy();
      expect(screen.getByRole('link', { name: /Start learning/i })).toBeTruthy();
    });
  });
});
