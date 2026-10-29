// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { getActiveStage, getEffectiveStage } from '../stage-selectors';
import { RecommendationsStageView } from '../stages/RecommendationsStageView';
import { StartingPointStageView } from '../stages/StartingPointStageView';
import { CohortWorkspacePane } from '../CohortWorkspacePane';
import { ChatPane } from '../ChatPane';

const fake = vi.hoisted(() => ({
  state: null as any,
  actions: [] as unknown[],
  messages: [] as any[],
  sendMessage: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'owner' } } }),
}));

vi.mock('@/src/client/interaction/hooks', () => ({
  useInteractionState: () => ({ workspaceId: 'ws-123', revision: 1, view: fake.state, pending: {} }),
  useWorkspaceView: () => fake.state,
  useDispatchAction: () => async (action: unknown) => {
    fake.actions.push(action);
    return true;
  },
  useWorkspaceMessages: () => fake.messages,
  useSendMessage: () => fake.sendMessage,
}));

vi.mock('../useAssistantActivity', () => ({
  useAssistantActivity: () => ({ turns: [] }),
}));

vi.mock('@/src/client/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', isDark: false }),
}));

afterEach(() => {
  cleanup();
  fake.actions = [];
  fake.messages = [];
  vi.clearAllMocks();
});

function createWorkspace(overrides: Partial<CohortWorkspace> = {}): CohortWorkspace {
  return {
    schemaVersion: 1,
    title: 'Test Journey Workspace',
    intent: 'Master Distributed Systems',
    audience: 'Software Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 0,
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
    ...overrides,
  };
}

describe('Checkpoint 2: Journey Stages & Selectors', () => {
  describe('stage-selectors', () => {
    it('returns "recommendations" when workspace.journey.step is "recommendations"', () => {
      const ws = createWorkspace({
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });
      expect(getActiveStage(ws)).toBe('recommendations');
    });

    it('returns "starting_point" when workspace.journey.step is "starting_point"', () => {
      const ws = createWorkspace({
        journey: {
          version: 1,
          step: 'starting_point',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });
      expect(getActiveStage(ws)).toBe('starting_point');
    });

    it('preserves legacy logic when workspace.journey is undefined', () => {
      const ws = createWorkspace({ journey: undefined });
      expect(getActiveStage(ws)).toBe('intake');
    });

    it('getEffectiveStage returns journey step even if draft is open or stage is inspected', () => {
      const ws = createWorkspace({
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });
      expect(getEffectiveStage(ws, 'chunking')).toBe('recommendations');
    });
  });

  describe('RecommendationsStageView', () => {
    it('renders RecommendationResults with items when status is "ready"', () => {
      const dispatchAction = vi.fn().mockResolvedValue(true);
      const ws = createWorkspace({
        recommendations: {
          requestId: '11111111-1111-1111-1111-111111111111',
          fingerprint: 'fp-1',
          status: 'ready',
          generation: 1,
          items: [
            {
              id: 'cohort-1',
              label: 'Distributed Systems 101',
              url: 'https://example.com/cohort-1',
              description: 'Learn consensus and replication.',
              coverImage: null,
              creatorName: 'Alice',
              difficulty: 'INTERMEDIATE',
              categories: ['Systems', 'Backend'],
              estimatedCompletionTime: '4 weeks',
              memberCount: 42,
              lessonCount: 8,
              reason: 'Matches distributed systems',
              isBestMatch: true,
            },
          ],
        },
      });

      render(<RecommendationsStageView workspace={ws} dispatchAction={dispatchAction} />);

      expect(screen.getByText('Distributed Systems 101')).toBeDefined();
      expect(screen.getByText('Learn consensus and replication.')).toBeDefined();

      const createOwnBtn = screen.getByRole('button', { name: /Create my own cohort/i });
      fireEvent.click(createOwnBtn);
      expect(dispatchAction).toHaveBeenCalledWith({ type: 'create_own_cohort' });
    });

    it('renders designed empty state when status is "ready" but items is empty', () => {
      const dispatchAction = vi.fn().mockResolvedValue(true);
      const ws = createWorkspace({
        recommendations: {
          requestId: '11111111-1111-1111-1111-111111111111',
          fingerprint: 'fp-1',
          status: 'ready',
          generation: 1,
          items: [],
        },
      });

      render(<RecommendationsStageView workspace={ws} dispatchAction={dispatchAction} />);

      expect(screen.getByText('A new path starts here.')).toBeDefined();
      expect(
        screen.getByText('No matching public cohorts were found. You can start your own from this intent.')
      ).toBeDefined();

      const createOwnBtn = screen.getByRole('button', { name: /Create my own cohort/i });
      fireEvent.click(createOwnBtn);
      expect(dispatchAction).toHaveBeenCalledWith({ type: 'create_own_cohort' });
    });

    it('renders RecommendationPending when status is "running" or "queued"', () => {
      const dispatchAction = vi.fn().mockResolvedValue(true);
      const ws = createWorkspace({
        recommendations: {
          requestId: '11111111-1111-1111-1111-111111111111',
          fingerprint: 'fp-1',
          status: 'running',
          generation: 1,
          items: [],
        },
      });

      render(<RecommendationsStageView workspace={ws} dispatchAction={dispatchAction} />);

      expect(screen.getByText('Finding your people…')).toBeDefined();
      expect(
        screen.getByText('Searching for matching cohorts and creators right now…')
      ).toBeDefined();

      // Cancel button in pending view dispatches create_own_cohort
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);
      expect(dispatchAction).toHaveBeenCalledWith({ type: 'create_own_cohort' });

      // Bottom CTA also dispatches create_own_cohort
      const createOwnBtn = screen.getByRole('button', { name: /Create my own cohort/i });
      fireEvent.click(createOwnBtn);
      expect(dispatchAction).toHaveBeenCalledWith({ type: 'create_own_cohort' });
    });

    it('renders designed empty state with retry and create own when status is "failed"', () => {
      const dispatchAction = vi.fn().mockResolvedValue(true);
      const ws = createWorkspace({
        recommendations: {
          requestId: '11111111-1111-1111-1111-111111111111',
          fingerprint: 'fp-1',
          status: 'failed',
          generation: 1,
          items: [],
        },
      });

      render(<RecommendationsStageView workspace={ws} dispatchAction={dispatchAction} />);

      expect(screen.getByText('Unable to load recommendations')).toBeDefined();

      const retryBtn = screen.getByRole('button', { name: /Retry recommendation search/i });
      fireEvent.click(retryBtn);
      expect(dispatchAction).toHaveBeenCalledWith({
        type: 'retry_recommendations',
      });

      const createOwnBtn = screen.getByRole('button', { name: /Create my own cohort/i });
      fireEvent.click(createOwnBtn);
      expect(dispatchAction).toHaveBeenCalledWith({ type: 'create_own_cohort' });
    });
  });

  describe('StartingPointStageView', () => {
    it('renders the 3 illustrated choices and dispatches choose_starting_point', () => {
      const dispatchAction = vi.fn().mockResolvedValue(true);
      const ws = createWorkspace({
        journey: {
          version: 1,
          step: 'starting_point',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });

      render(<StartingPointStageView workspace={ws} dispatchAction={dispatchAction} />);

      const choice1 = screen.getByRole('button', { name: /I already have material/i });
      const choice2 = screen.getByRole('button', { name: /Find material for me/i });
      const choice3 = screen.getByRole('button', { name: /I just have a goal/i });

      expect(choice1).toBeDefined();
      expect(choice2).toBeDefined();
      expect(choice3).toBeDefined();

      fireEvent.click(choice1);
      expect(dispatchAction).toHaveBeenCalledWith({
        type: 'choose_starting_point',
        choice: 'have_material',
      });

      fireEvent.click(choice2);
      expect(dispatchAction).toHaveBeenCalledWith({
        type: 'choose_starting_point',
        choice: 'find_material',
      });

      fireEvent.click(choice3);
      expect(dispatchAction).toHaveBeenCalledWith({
        type: 'choose_starting_point',
        choice: 'have_goal',
      });

      const backBtn = screen.getByRole('button', { name: /Back to recommendations/i });
      fireEvent.click(backBtn);
      expect(dispatchAction).toHaveBeenCalledWith({ type: 'back_to_recommendations' });
    });
  });

  describe('CohortWorkspacePane integration with journey', () => {
    it('hides stepper navigation and renders recommendations stage view when step is recommendations', () => {
      fake.state = createWorkspace({
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
        recommendations: {
          requestId: '11111111-1111-1111-1111-111111111111',
          fingerprint: 'fp-1',
          status: 'ready',
          generation: 1,
          items: [],
        },
      });

      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      // Stepper navigation is hidden
      expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();
      // Recommendations empty state is rendered
      expect(screen.getByText('A new path starts here.')).toBeDefined();
    });

    it('hides stepper navigation and renders starting point stage view when step is starting_point', () => {
      fake.state = createWorkspace({
        journey: {
          version: 1,
          step: 'starting_point',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });

      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      // Stepper navigation is hidden
      expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();
      // Starting point buttons rendered
      expect(screen.getByRole('button', { name: /I already have material/i })).toBeDefined();
    });

    it('shows stepper navigation for legacy workspaces without journey', () => {
      fake.state = createWorkspace({ journey: undefined });

      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      // Stepper navigation IS rendered for legacy workspace
      expect(screen.getByRole('list', { name: 'Creation journey progress' })).toBeDefined();
    });
  });

  describe('ChatPane suggestion chips', () => {
    it('displays recommendations suggestions when in recommendations step', () => {
      fake.state = createWorkspace({
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });

      render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);

      expect(screen.getByRole('button', { name: 'Show more advanced ones' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'I want something more practical' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'I’ll create my own instead' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Show more advanced ones' }));
      expect(fake.sendMessage).toHaveBeenCalledWith('Show more advanced ones', []);
    });

    it('displays starting_point suggestions when in starting_point step', () => {
      fake.state = createWorkspace({
        journey: {
          version: 1,
          step: 'starting_point',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });

      render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);

      expect(screen.getByRole('button', { name: 'I have a YouTube playlist' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Find material for me' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'I just have a goal' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'I have a YouTube playlist' }));
      expect(fake.sendMessage).toHaveBeenCalledWith('I have a YouTube playlist', []);
    });

    it('chat rail textarea remains fully writable', () => {
      fake.state = createWorkspace({
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });

      render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);

      const textarea = screen.getByLabelText('Message the cohort assistant');
      expect((textarea as HTMLTextAreaElement).disabled).toBe(false);

      fireEvent.change(textarea, { target: { value: 'Can you show me courses on Raft consensus?' } });
      expect((textarea as HTMLTextAreaElement).value).toBe('Can you show me courses on Raft consensus?');

      const sendBtn = screen.getByRole('button', { name: 'Send message' });
      fireEvent.click(sendBtn);

      expect(fake.sendMessage).toHaveBeenCalledWith('Can you show me courses on Raft consensus?', []);
    });
  });
});
