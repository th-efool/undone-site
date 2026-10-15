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
    workspaceId: 'workspace-test-id',
    revision: 0,
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
import { CohortInteractionScreen } from '../CohortInteractionScreen';

function createRecommendationsWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems',
    intent: 'Master Distributed Consensus',
    audience: 'Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 1,
      sourceFingerprint: null,
      error: null,
    },
    journey: {
      version: 1,
      step: 'recommendations',
      branch: null,
      processingStarted: false,
      intentVersion: 0,
    },
    recommendations: {
      requestId: '00000000-0000-0000-0000-000000000001',
      fingerprint: 'fp-rec-123',
      status: 'ready',
      resultId: '00000000-0000-0000-0000-000000000002',
      generation: 0,
      items: [
        {
          id: 'cohort-101',
          label: 'Distributed Systems In Practice',
          url: 'https://undone.app/cohorts/cohort-101',
          description: 'Consensus, replication, and quorums at scale.',
          coverImage: null,
          creatorName: 'Leslie Lamport Fan',
          difficulty: 'INTERMEDIATE',
          categories: ['Distributed Systems'],
          estimatedCompletionTime: '4 weeks',
          memberCount: 50,
          lessonCount: 12,
          isBestMatch: true,
          reason: 'Exact match for distributed consensus learning goals',
        },
      ],
    },
    ...overrides,
  });
}

function createStartingPointWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems',
    intent: 'Master Distributed Consensus',
    audience: 'Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 1,
      sourceFingerprint: null,
      error: null,
    },
    journey: {
      version: 1,
      step: 'starting_point',
      branch: null,
      processingStarted: false,
      intentVersion: 0,
    },
    ...overrides,
  });
}

describe('Checkpoint 2 Client Navigation: Recommendations and StartingPoint Views', () => {
  beforeEach(() => {
    fake.actions = [];
    fake.succeeds = true;
    fake.session = {
      status: 'authenticated',
      data: { user: { id: 'owner-alice' } },
    };
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Recommendations View', () => {
    it('1. Renders RecommendationResults when recommendations status is ready', async () => {
      fake.state = createRecommendationsWorkspace();
      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      // Verify recommendation heading/topic:
      expect(screen.getByText('Master Distributed Consensus')).toBeTruthy();

      // Verify recommendation cohort card is rendered:
      expect(screen.getByText('Distributed Systems In Practice')).toBeTruthy();
      expect(screen.getByText('Consensus, replication, and quorums at scale.')).toBeTruthy();

      // Verify "Create my own cohort" button is rendered:
      const createOwnButtons = screen.getAllByRole('button', { name: /Create my own cohort/i });
      expect(createOwnButtons.length).toBeGreaterThanOrEqual(1);

      // Clicking "Create my own cohort" dispatches create_own_cohort action:
      await act(async () => {
        fireEvent.click(createOwnButtons[0]);
      });
      expect(fake.actions).toContainEqual({ type: 'create_own_cohort' });
    });

    it('2. Renders pending state when recommendations status is queued or pending', async () => {
      const ws = createRecommendationsWorkspace();
      delete ws.recommendations;
      fake.state = ws;

      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      // Verify loading state is displayed:
      expect(screen.getByText(/Finding your people…|Preparing recommendations/i)).toBeTruthy();

      // Verify skip button "Create my own cohort" is available while pending:
      const createOwnButton = screen.getByRole('button', { name: /Create my own cohort/i });
      expect(createOwnButton).toBeTruthy();

      await act(async () => {
        fireEvent.click(createOwnButton);
      });
      expect(fake.actions).toContainEqual({ type: 'create_own_cohort' });
    });

    it('3. Renders failed state with retry and create options when recommendations failed', async () => {
      fake.state = createRecommendationsWorkspace({
        recommendations: {
          requestId: '00000000-0000-0000-0000-000000000001',
          fingerprint: 'fp-rec-failed',
          status: 'failed',
          generation: 0,
          items: [],
        },
      });

      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      // Verify failure messaging:
      expect(screen.getByText(/Unable to load recommendations/i)).toBeTruthy();

      // Verify retry button:
      const retryButton = screen.getByRole('button', { name: /Retry recommendation search/i });
      expect(retryButton).toBeTruthy();

      await act(async () => {
        fireEvent.click(retryButton);
      });
      expect(fake.actions).toContainEqual({
        type: 'set_intent',
        intent: 'Master Distributed Consensus',
      });

      // Verify create my own button is also available:
      const createOwnButton = screen.getByRole('button', { name: /Create my own cohort/i });
      await act(async () => {
        fireEvent.click(createOwnButton);
      });
      expect(fake.actions).toContainEqual({ type: 'create_own_cohort' });
    });
  });

  describe('StartingPoint View', () => {
    it('4. Renders StartingPoint with 3 choices and dispatches choose_starting_point', async () => {
      fake.state = createStartingPointWorkspace();
      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      // Verify StartingPoint header / options:
      expect(screen.getByRole('region', { name: 'Starting point' })).toBeTruthy();

      const choice1 = screen.getByRole('button', { name: /I already have material/i });
      const choice2 = screen.getByRole('button', { name: /Find material for me/i });
      const choice3 = screen.getByRole('button', { name: /I just have a goal/i });

      expect(choice1).toBeTruthy();
      expect(choice2).toBeTruthy();
      expect(choice3).toBeTruthy();

      // Click choice 1: have_material
      await act(async () => {
        fireEvent.click(choice1);
      });
      expect(fake.actions).toContainEqual({
        type: 'choose_starting_point',
        choice: 'have_material',
      });

      // Click choice 2: find_material
      await act(async () => {
        fireEvent.click(choice2);
      });
      expect(fake.actions).toContainEqual({
        type: 'choose_starting_point',
        choice: 'find_material',
      });

      // Click choice 3: have_goal
      await act(async () => {
        fireEvent.click(choice3);
      });
      expect(fake.actions).toContainEqual({
        type: 'choose_starting_point',
        choice: 'have_goal',
      });
    });

    it('5. Dispatches back_to_recommendations when Back to recommendations is clicked', async () => {
      fake.state = createStartingPointWorkspace();
      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      const backButton = screen.getByRole('button', { name: /Back to recommendations/i });
      expect(backButton).toBeTruthy();

      await act(async () => {
        fireEvent.click(backButton);
      });
      expect(fake.actions).toContainEqual({ type: 'back_to_recommendations' });
    });
  });

  describe('Stepper Navigation Suppression', () => {
    it('6. Suppresses curriculum stepper navigation during recommendations and starting_point stages', () => {
      // In recommendations stage:
      fake.state = createRecommendationsWorkspace();
      const { rerender } = render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
      expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();

      // In starting_point stage:
      fake.state = createStartingPointWorkspace();
      rerender(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
      expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();
    });
  });

  describe('Reload / Authentication Return & Identity Protection', () => {
    it('7. Renders active journey on reload when authenticated as owner', () => {
      const initialView = createRecommendationsWorkspace();
      fake.state = initialView;
      fake.session = {
        status: 'authenticated',
        data: { user: { id: 'owner-alice' } },
      };

      render(
        <CohortInteractionScreen
          workspaceId="workspace-test-id"
          ownerId="owner-alice"
          initialView={initialView}
        />
      );

      // Successfully renders workspace canvas and recommendations stage:
      expect(screen.getByRole('heading', { name: /Master Distributed Consensus/i })).toBeTruthy();
      expect(screen.getByText('Distributed Systems In Practice')).toBeTruthy();
    });

    it('8. Shows session changed and clears intake storage if session is unauthenticated', () => {
      sessionStorage.setItem('undone:cohort-intake', JSON.stringify({ prompt: 'Learn Rust' }));
      fake.session = {
        status: 'unauthenticated',
        data: null,
      };

      render(
        <CohortInteractionScreen
          workspaceId="workspace-test-id"
          ownerId="owner-alice"
          initialView={createRecommendationsWorkspace()}
        />
      );

      expect(screen.getByText('Session changed. Sign in again to resume this workspace.')).toBeTruthy();
      expect(sessionStorage.getItem('undone:cohort-intake')).toBeNull();
    });

    it('9. Shows session changed and clears intake storage if authenticated user id does not match ownerId', () => {
      sessionStorage.setItem('undone:cohort-intake', JSON.stringify({ prompt: 'Learn Rust' }));
      fake.session = {
        status: 'authenticated',
        data: { user: { id: 'different-intruder-id' } },
      };

      render(
        <CohortInteractionScreen
          workspaceId="workspace-test-id"
          ownerId="owner-alice"
          initialView={createRecommendationsWorkspace()}
        />
      );

      expect(screen.getByText('Session changed. Sign in again to resume this workspace.')).toBeTruthy();
      expect(sessionStorage.getItem('undone:cohort-intake')).toBeNull();
    });
  });
});
