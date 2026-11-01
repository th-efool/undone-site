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

      expect(screen.getByRole('heading', { level: 1, name: 'Start with a goal' })).toBeTruthy();
      expect(screen.getByText(/Tell us what you want to learn\. Choose resources before adding them to your material\./i)).toBeTruthy();

      const input = screen.getByLabelText(/Your learning goal/i) as HTMLInputElement;
      expect(input.value).toBe('Master Distributed Consensus');

      const findBtn = screen.getByRole('button', { name: /Find resources/i });
      expect(findBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(findBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'start_discovery' });
    });

    it('2. Renders loading state and dispatches cancel_discovery', async () => {
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

      expect(screen.getByText(/Finding resources…/i)).toBeTruthy();
      const cancelBtn = screen.getByRole('button', { name: /Cancel search/i });
      expect(cancelBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'cancel_discovery' });
    });

    it('3. Renders failed state and retains input on retry', async () => {
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

      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/Search could not finish\. Your goal is saved\. Try again\./i)).toBeTruthy();

      const input = screen.getByLabelText(/Your learning goal/i) as HTMLInputElement;
      expect(input.value).toBe('Master Distributed Consensus');

      const findBtn = screen.getByRole('button', { name: /Find resources/i });
      await act(async () => {
        fireEvent.click(findBtn);
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
        screen.getByText(/No resources found\. Refine your goal or add your own link\./i)
      ).toBeTruthy();

      const haveMaterialBtn = screen.getByRole('button', {
        name: /I already have material/i,
      });
      expect(haveMaterialBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(haveMaterialBtn);
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

      // Checkbox 1 toggle
      const cb1 = screen.getByLabelText(/Raft Consensus Summary/i);
      expect((cb1 as HTMLInputElement).checked).toBe(false);

      await act(async () => {
        fireEvent.click(cb1);
      });
      expect((cb1 as HTMLInputElement).checked).toBe(true);

      const acquireBtn = screen.getByRole('button', {
        name: /Add selected material \(1\)/i,
      });
      expect((acquireBtn as HTMLButtonElement).disabled).toBe(false);

      await act(async () => {
        fireEvent.click(acquireBtn);
      });

      expect(fake.actions).toContainEqual({
        type: 'select_discovery_resources',
        resultId: 'res-disc-789',
        candidateIds: ['cand-1'],
      });
    });

    it('6. Enforces goal save false prevents search, new result ID resets selection, and selection commit false preserves checks', async () => {
      // 1. Goal save false prevents search
      const ws = createDiscoveryWorkspace({ discovery: undefined });
      const { rerender } = render(
        <DiscoveryStageView
          workspace={ws}
          dispatchAction={async a => {
            fake.actions.push(a);
            if (a.type === 'set_intent') return false; // simulated failure
            return true;
          }}
        />
      );

      const input = screen.getByLabelText(/Your learning goal/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Brand new goal' } });
      });

      const findBtn = screen.getByRole('button', { name: /Find resources/i });
      await act(async () => {
        fireEvent.click(findBtn);
      });

      // set_intent failed, start_discovery was NOT called
      expect(fake.actions).toContainEqual({ type: 'set_intent', intent: 'Brand new goal' });
      expect(fake.actions).not.toContainEqual({ type: 'start_discovery' });
      expect(screen.getByRole('alert')).toBeTruthy();

      // 2. Selection commit false preserves checks
      fake.actions = [];
      const readyWs = createDiscoveryWorkspace({
        discovery: {
          requestId: 'req-ready-2',
          fingerprint: 'fp-disc-456',
          status: 'ready',
          resultId: 'res-disc-1',
          generation: 0,
          items: [
            {
              id: 'cand-1',
              label: 'Raft Consensus Summary',
              kind: 'web',
              url: 'https://raft.github.io',
            },
          ],
        },
      });

      rerender(
        <DiscoveryStageView
          workspace={readyWs}
          dispatchAction={async a => {
            fake.actions.push(a);
            if (a.type === 'select_discovery_resources') return false; // simulated failure
            return true;
          }}
        />
      );

      const cb = screen.getByLabelText(/Raft Consensus Summary/i) as HTMLInputElement;
      await act(async () => {
        fireEvent.click(cb);
      });
      expect(cb.checked).toBe(true);

      const addBtn = screen.getByRole('button', { name: /Add selected material \(1\)/i });
      await act(async () => {
        fireEvent.click(addBtn);
      });

      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/Could not save this action\. Your choices are retained\./i)).toBeTruthy();
      expect(cb.checked).toBe(true); // Checkbox remains preserved!

      // 3. New result ID resets selection
      const newResultWs = createDiscoveryWorkspace({
        discovery: {
          requestId: 'req-ready-3',
          fingerprint: 'fp-disc-789',
          status: 'ready',
          resultId: 'res-disc-NEW',
          generation: 1,
          items: [
            {
              id: 'cand-1',
              label: 'Raft Consensus Summary',
              kind: 'web',
              url: 'https://raft.github.io',
            },
          ],
        },
      });

      rerender(
        <DiscoveryStageView
          workspace={newResultWs}
          dispatchAction={async a => {
            fake.actions.push(a);
            return true;
          }}
        />
      );

      const cbNew = screen.getByLabelText(/Raft Consensus Summary/i) as HTMLInputElement;
      expect(cbNew.checked).toBe(false); // Reset because resultId changed!
    });
  });

  // -------------------------------------------------------------------------
  // 3. CohortWorkspacePane Integration Tests
  // -------------------------------------------------------------------------
  describe('CohortWorkspacePane integration', () => {
    it('10. Renders DiscoveryStageView when journey.step is discovery and suppresses stepper nav', () => {
      fake.state = createDiscoveryWorkspace();
      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      expect(screen.getByRole('heading', { level: 1, name: 'Start with a goal' })).toBeTruthy();
      expect(
        screen.queryByRole('list', { name: 'Creation journey progress' })
      ).toBeNull();
    });

    it('11. Renders DiscoveryStageView when journey.step is goal_setup (old draft can enter search) and suppresses stepper nav', () => {
      fake.state = createGoalWorkspace();
      render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

      // In revised intake, goal_setup routes to DiscoveryStageView so old drafts can enter search
      expect(screen.getByRole('heading', { level: 1, name: 'Start with a goal' })).toBeTruthy();
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
        screen.getByRole('button', { name: 'Provide my sources' })
      ).toBeTruthy();
    });

    it('13. Renders goal_setup suggestion chips during goal_setup stage', () => {
      fake.state = createGoalWorkspace();
      render(
        <ChatPane attachedEntity={null} onClearAttachedEntity={() => undefined} />
      );

      expect(
        screen.getByRole('button', { name: 'Set daily time' })
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Set experience' })
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
