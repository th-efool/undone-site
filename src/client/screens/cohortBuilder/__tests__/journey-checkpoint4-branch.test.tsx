// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import { getActiveStage, getEffectiveStage } from '../stage-selectors';

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
    workspaceId: 'ws-test-checkpoint4',
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

import { DiscoveryStageView } from '../stages/DiscoveryStageView';
import { GoalStageView } from '../stages/GoalStageView';
import { CohortWorkspacePane } from '../CohortWorkspacePane';
import { ChatPane } from '../ChatPane';

function createDiscoveryWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems Cohort',
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
      step: 'discovery',
      branch: 'find_material',
      processingStarted: false,
      intentVersion: 0,
    },
    ...overrides,
  });
}

function createGoalWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems Guide',
    intent: 'Master Distributed Consensus in Go',
    audience: 'Intermediate engineers',
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
      step: 'goal_setup',
      branch: 'have_goal',
      processingStarted: false,
      intentVersion: 0,
    },
    ...overrides,
  });
}

describe('Checkpoint 4: Journey Branch UI Suite (Discovery, Goal, WorkspacePane, ChatPane)', () => {
  beforeEach(() => {
    fake.actions = [];
    fake.succeeds = true;
    fake.session = {
      status: 'authenticated',
      data: { user: { id: 'owner-alice' } },
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. DiscoveryStageView Tests
  // -------------------------------------------------------------------------
  describe('DiscoveryStageView', () => {
    it('1. Renders initial search prompt with saved intent and dispatches start_discovery', async () => {
      const ws = createDiscoveryWorkspace({ discovery: undefined });
      render(
        <DiscoveryStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      expect(screen.getByText('FIND LEARNING MATERIAL')).toBeTruthy();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
        'Discover grounded sources for your'
      );
      expect(screen.getByText('Master Distributed Consensus')).toBeTruthy();

      const findBtn = screen.getByRole('button', { name: /Find sources/i });
      expect(findBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(findBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'start_discovery' });
    });

    it('2. Renders loading state and dispatches cancel_text_processing', async () => {
      const ws = createDiscoveryWorkspace({
        discovery: {
          requestId: 'req-loading-1',
          fingerprint: 'fp-1',
          status: 'running',
          generation: 0,
          items: [],
        },
      });

      render(
        <DiscoveryStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      expect(screen.getByText('Searching for grounded sources...')).toBeTruthy();
      const cancelBtn = screen.getByRole('button', { name: /Cancel search/i });
      expect(cancelBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'cancel_text_processing' });
    });

    it('3. Renders failed state and dispatches start_discovery on retry', async () => {
      const ws = createDiscoveryWorkspace({
        discovery: {
          requestId: 'req-fail-1',
          fingerprint: 'fp-1',
          status: 'failed',
          generation: 0,
          items: [],
        },
      });

      render(
        <DiscoveryStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      expect(
        screen.getByText(
          'Source discovery could not be completed. Your goal remains saved.'
        )
      ).toBeTruthy();

      const retryBtn = screen.getByRole('button', { name: /Retry search/i });
      expect(retryBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(retryBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'start_discovery' });
    });

    it('4. Renders honest empty discovery state when no sources observed', async () => {
      const ws = createDiscoveryWorkspace({
        discovery: {
          requestId: 'req-empty-1',
          fingerprint: 'fp-1',
          status: 'ready',
          generation: 0,
          items: [],
        },
      });

      render(
        <DiscoveryStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      expect(
        screen.getByText(
          /No usable public sources were observed for this intent/i
        )
      ).toBeTruthy();

      const searchAgainBtn = screen.getByRole('button', { name: /Search again/i });
      const provideOwnBtn = screen.getByRole('button', {
        name: /Provide my own material/i,
      });

      expect(searchAgainBtn).toBeTruthy();
      expect(provideOwnBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(searchAgainBtn);
      });
      expect(fake.actions).toContainEqual({ type: 'start_discovery' });

      await act(async () => {
        fireEvent.click(provideOwnBtn);
      });
      expect(fake.actions).toContainEqual({
        type: 'choose_starting_point',
        choice: 'have_material',
      });
    });

    it('5. Renders candidate items, handles selection toggles, and dispatches select_discovery_resources', async () => {
      const ws = createDiscoveryWorkspace({
        discovery: {
          requestId: 'req-ready-1',
          fingerprint: 'fp-disc-123',
          status: 'ready',
          resultId: 'res-disc-789',
          generation: 0,
          items: [
            {
              id: 'cand-1',
              label: 'Raft Consensus Summary',
              kind: 'web',
              url: 'https://raft.github.io',
            },
            {
              id: 'cand-2',
              label: 'Paxos Made Simple',
              kind: 'web',
              url: 'https://lamport.azurewebsites.net/pubs/paxos-simple.pdf',
            },
          ],
        },
      });

      render(
        <DiscoveryStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      expect(screen.getByText('Raft Consensus Summary')).toBeTruthy();
      expect(screen.getByText('Paxos Made Simple')).toBeTruthy();
      expect(screen.getByText('2 of 2 selected')).toBeTruthy();

      const acquireBtn = screen.getByRole('button', {
        name: /Acquire selected sources \(2\)/i,
      });
      expect(acquireBtn).toBeTruthy();
      expect((acquireBtn as HTMLButtonElement).disabled).toBe(false);

      // Deselect all
      const deselectAllBtn = screen.getByRole('button', { name: 'Deselect all' });
      await act(async () => {
        fireEvent.click(deselectAllBtn);
      });

      expect(screen.getByText('0 of 2 selected')).toBeTruthy();
      expect((acquireBtn as HTMLButtonElement).disabled).toBe(true);

      // Select all
      const selectAllBtn = screen.getByRole('button', { name: 'Select all' });
      await act(async () => {
        fireEvent.click(selectAllBtn);
      });

      expect(screen.getByText('2 of 2 selected')).toBeTruthy();

      // Toggle candidate 1 off
      const cb1 = screen.getByLabelText('Raft Consensus Summary');
      await act(async () => {
        fireEvent.click(cb1);
      });

      expect(screen.getByText('1 of 2 selected')).toBeTruthy();
      const acquire1Btn = screen.getByRole('button', {
        name: /Acquire selected sources \(1\)/i,
      });

      await act(async () => {
        fireEvent.click(acquire1Btn);
      });

      expect(fake.actions).toContainEqual({
        type: 'select_discovery_resources',
        resultId: 'res-disc-789',
        candidateIds: ['cand-2'],
      });
    });

    it('6. Top starting point switching and back navigation in DiscoveryStageView', async () => {
      const ws = createDiscoveryWorkspace();
      render(
        <DiscoveryStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      const tabFind = screen.getByRole('button', { name: /Find material for me/i });
      expect(tabFind.getAttribute('aria-pressed')).toBe('true');

      // Click Back button
      const backBtn = screen.getByRole('button', { name: /Back to starting point/i });
      await act(async () => {
        fireEvent.click(backBtn);
      });
      expect(fake.actions).toContainEqual({ type: 'back_to_starting_point' });

      // Click "I already have material" tab
      const tabMat = screen.getByRole('button', { name: /I already have material/i });
      await act(async () => {
        fireEvent.click(tabMat);
      });
      expect(fake.actions).toContainEqual({
        type: 'choose_starting_point',
        choice: 'have_material',
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. GoalStageView Tests
  // -------------------------------------------------------------------------
  describe('GoalStageView', () => {
    it('7. Renders intent, audience, and pacing controls, dispatching set actions', async () => {
      const ws = createGoalWorkspace();
      render(
        <GoalStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      expect(screen.getByText('CREATE AI-AUTHORED GUIDE')).toBeTruthy();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
        'Shape your goal and pacing.'
      );

      // Edit Intent and blur
      const intentTextarea = screen.getByLabelText(/Learning goal/i);
      expect((intentTextarea as HTMLTextAreaElement).value).toBe(
        'Master Distributed Consensus in Go'
      );
      await act(async () => {
        fireEvent.change(intentTextarea, {
          target: { value: 'Deep dive into Raft consensus protocol' },
        });
        fireEvent.blur(intentTextarea);
      });
      expect(fake.actions).toContainEqual({
        type: 'set_intent',
        intent: 'Deep dive into Raft consensus protocol',
      });

      // Edit Audience and blur
      const audienceInput = screen.getByLabelText(/Target audience/i);
      expect((audienceInput as HTMLInputElement).value).toBe(
        'Intermediate engineers'
      );
      await act(async () => {
        fireEvent.change(audienceInput, {
          target: { value: 'Senior Backend Engineers' },
        });
        fireEvent.blur(audienceInput);
      });
      expect(fake.actions).toContainEqual({
        type: 'set_audience',
        audience: 'Senior Backend Engineers',
      });

      // Change pacing to 45 min
      const pill45 = screen.getByRole('button', { name: /45 min/i });
      await act(async () => {
        fireEvent.click(pill45);
      });
      expect(fake.actions).toContainEqual({
        type: 'set_daily_minutes',
        dailyMinutes: 45,
      });
    });

    it('8. Enforces AI disclosure confirmation checkbox before allowing guide generation', async () => {
      const ws = createGoalWorkspace();
      render(
        <GoalStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      const generateBtn = screen.getByRole('button', {
        name: /Generate learning guide/i,
      }) as HTMLButtonElement;

      // CTA initially disabled
      expect(generateBtn.disabled).toBe(true);

      // Check disclosure checkbox
      const disclosureCheckbox = screen.getByLabelText(
        /Use AI-authored material for my saved goal/i
      );
      expect(disclosureCheckbox).toBeTruthy();

      await act(async () => {
        fireEvent.click(disclosureCheckbox);
      });

      // CTA becomes enabled
      expect(generateBtn.disabled).toBe(false);

      // Clicking dispatches start_goal_generation
      await act(async () => {
        fireEvent.click(generateBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'start_goal_generation' });
    });

    it('9. Back navigation and starting point switching in GoalStageView', async () => {
      const ws = createGoalWorkspace();
      render(
        <GoalStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      const tabGoal = screen.getByRole('button', { name: /I just have a goal/i });
      expect(tabGoal.getAttribute('aria-pressed')).toBe('true');

      // Click Back button
      const backBtn = screen.getByRole('button', { name: /Back to starting point/i });
      await act(async () => {
        fireEvent.click(backBtn);
      });
      expect(fake.actions).toContainEqual({ type: 'back_to_starting_point' });

      // Click "Find material for me"
      const tabFind = screen.getByRole('button', { name: /Find material for me/i });
      await act(async () => {
        fireEvent.click(tabFind);
      });
      expect(fake.actions).toContainEqual({
        type: 'choose_starting_point',
        choice: 'find_material',
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. CohortWorkspacePane Integration Tests
  // -------------------------------------------------------------------------
  describe('CohortWorkspacePane integration', () => {
    it('10. Renders DiscoveryStageView when journey.step is discovery and suppresses stepper nav', () => {
      fake.state = createDiscoveryWorkspace();
      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      expect(screen.getByText('FIND LEARNING MATERIAL')).toBeTruthy();
      expect(
        screen.queryByRole('list', { name: 'Creation journey progress' })
      ).toBeNull();
    });

    it('11. Renders GoalStageView when journey.step is goal_setup and suppresses stepper nav', () => {
      fake.state = createGoalWorkspace();
      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      expect(screen.getByText('CREATE AI-AUTHORED GUIDE')).toBeTruthy();
      expect(
        screen.queryByRole('list', { name: 'Creation journey progress' })
      ).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 4. ChatPane Contextual Suggestions Tests
  // -------------------------------------------------------------------------
  describe('ChatPane suggestion chips', () => {
    it('12. Renders discovery suggestion chips during discovery stage', () => {
      fake.state = createDiscoveryWorkspace();
      render(
        <ChatPane attachedEntity={null} onClearAttachedEntity={() => undefined} />
      );

      expect(screen.getByRole('button', { name: 'Search again' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'I’ll provide my own sources instead' })
      ).toBeTruthy();
    });

    it('13. Renders goal_setup suggestion chips during goal_setup stage', () => {
      fake.state = createGoalWorkspace();
      render(
        <ChatPane attachedEntity={null} onClearAttachedEntity={() => undefined} />
      );

      expect(
        screen.getByRole('button', { name: '30 minutes per day' })
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'For intermediate developers' })
      ).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // 5. stage-selectors Tests
  // -------------------------------------------------------------------------
  describe('stage-selectors', () => {
    it('14. getActiveStage and getEffectiveStage accurately identify discovery and goal_setup stages', () => {
      const discWs = createDiscoveryWorkspace();
      expect(getActiveStage(discWs)).toBe('discovery');
      expect(getEffectiveStage(discWs, 'chunking')).toBe('discovery');

      const goalWs = createGoalWorkspace();
      expect(getActiveStage(goalWs)).toBe('goal_setup');
      expect(getEffectiveStage(goalWs, 'analysis')).toBe('goal_setup');
    });
  });
});
