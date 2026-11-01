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
  extractYoutubeClient: vi.fn(),
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

vi.mock('@/src/client/lib/sourceExtractors/youtubeClientExtractor', () => ({
  extractYoutubeClient: (...args: unknown[]) => fake.extractYoutubeClient(...args),
}));

import { DiscoveryStageView } from '../stages/DiscoveryStageView';
import { CohortWorkspacePane } from '../CohortWorkspacePane';
import { ChatPane } from '../ChatPane';
import { getActiveStage, getEffectiveStage } from '../stage-selectors';

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
      generation: 0,
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
      generation: 0,
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

describe('Checkpoint 4: Journey Branch UI Suite (Discovery YouTube +/-, WorkspacePane, ChatPane)', () => {
  beforeEach(() => {
    fake.actions = [];
    fake.succeeds = true;
    fake.extractYoutubeClient.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'dQw4w9WgXcQ',
              kind: 'video',
              title: 'Raft Consensus Explained',
              channelTitle: 'Distributed Systems Channel',
              description: 'Deep dive into Raft.',
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            },
            {
              id: 'pl-1',
              kind: 'playlist',
              title: 'MIT 6.824 Distributed Systems Playlist',
              channelTitle: 'MIT OpenCourseWare',
              description: 'Full lecture series.',
              url: 'https://www.youtube.com/playlist?list=pl-1',
            },
          ],
        }),
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('DiscoveryStageView (YouTube lookup + include/exclude +/-)', () => {
    it('1. Automatically looks up YouTube videos and playlists for saved intent and renders + include buttons', async () => {
      const ws = createDiscoveryWorkspace();
      await act(async () => {
        render(
          <DiscoveryStageView
            workspace={ws}
            dispatchAction={async (a) => {
              fake.actions.push(a);
              return true;
            }}
          />
        );
      });

      expect(screen.getByRole('heading', { level: 1, name: /Start with a goal/i })).toBeTruthy();
      expect(screen.getByText('Raft Consensus Explained')).toBeTruthy();
      expect(screen.getByText('MIT 6.824 Distributed Systems Playlist')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Include Raft Consensus Explained' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Include MIT 6.824 Distributed Systems Playlist' })
      ).toBeTruthy();
    });

    it('2. Includes a YouTube video with +, excludes it with -, and continues with begin_material_processing', async () => {
      fake.extractYoutubeClient.mockResolvedValue(null);
      const ws = createDiscoveryWorkspace();
      const { rerender } = await act(async () =>
        render(
          <DiscoveryStageView
            workspace={ws}
            dispatchAction={async (a) => {
              fake.actions.push(a);
              return true;
            }}
          />
        )
      );

      const includeBtn = screen.getByRole('button', { name: 'Include Raft Consensus Explained' });
      await act(async () => {
        fireEvent.click(includeBtn);
      });

      expect(fake.actions).toContainEqual({
        type: 'add_youtube_source',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        label: 'Raft Consensus Explained',
        mode: 'video_observation',
      });

      // Rerender with the added source in workspace.sources
      const wsWithSource = createDiscoveryWorkspace({
        sources: [
          {
            id: 'src-yt-1',
            version: 0,
            label: 'Raft Consensus Explained',
            text: '',
            checksum: null,
            state: 'queued',
            input: {
              kind: 'youtube',
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              mode: 'video_observation',
            },
          },
        ],
      });

      await act(async () => {
        rerender(
          <DiscoveryStageView
            workspace={wsWithSource}
            dispatchAction={async (a) => {
              fake.actions.push(a);
              return true;
            }}
          />
        );
      });

      // Now shows - Exclude button and enables Continue to curriculum ->
      const excludeBtn = screen.getByRole('button', { name: 'Exclude Raft Consensus Explained' });
      expect(excludeBtn).toBeTruthy();

      const continueBtn = screen.getByRole('button', {
        name: /Continue to curriculum/i,
      }) as HTMLButtonElement;
      expect(continueBtn.disabled).toBe(false);

      await act(async () => {
        fireEvent.click(continueBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'begin_material_processing' });

      // Clicking - Exclude dispatches remove_source
      await act(async () => {
        fireEvent.click(excludeBtn);
      });
      expect(fake.actions).toContainEqual({
        type: 'remove_source',
        sourceId: 'src-yt-1',
      });
    });

    it('3. Updates intent with set_intent when searching a modified goal and stops if set_intent fails', async () => {
      const ws = createDiscoveryWorkspace();
      await act(async () => {
        render(
          <DiscoveryStageView
            workspace={ws}
            dispatchAction={async (a) => {
              fake.actions.push(a);
              if (a.type === 'set_intent') return false;
              return true;
            }}
          />
        );
      });

      const input = screen.getByLabelText(/Your learning goal/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Learn Rust Async' } });
      });

      const findBtn = screen.getByRole('button', { name: /Find resources/i });
      await act(async () => {
        fireEvent.click(findBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'set_intent', intent: 'Learn Rust Async' });
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  describe('CohortWorkspacePane integration', () => {
    it('4. Renders DiscoveryStageView and top Starting point nav when journey.step is discovery', async () => {
      fake.state = createDiscoveryWorkspace();
      await act(async () => {
        render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
      });

      expect(screen.getByRole('heading', { level: 1, name: /Start with a goal/i })).toBeTruthy();
      expect(screen.getByRole('navigation', { name: 'Starting point' })).toBeTruthy();
      expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();
    });

    it('5. Renders DiscoveryStageView when journey.step is goal_setup and suppresses stepper nav', async () => {
      fake.state = createGoalWorkspace();
      await act(async () => {
        render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
      });

      expect(screen.getByRole('heading', { level: 1, name: /Start with a goal/i })).toBeTruthy();
      expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();
    });
  });

  describe('ChatPane suggestion chips & stage-selectors', () => {
    it('6. Renders discovery suggestion chips during discovery stage', () => {
      fake.state = createDiscoveryWorkspace();
      render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => undefined} />);

      expect(screen.getByRole('button', { name: 'Search again' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Provide my sources' })).toBeTruthy();
    });

    it('7. getActiveStage and getEffectiveStage accurately identify discovery and goal_setup stages', () => {
      const discWs = createDiscoveryWorkspace();
      expect(getActiveStage(discWs)).toBe('discovery');
      expect(getEffectiveStage(discWs, 'chunking')).toBe('discovery');

      const goalWs = createGoalWorkspace();
      expect(getActiveStage(goalWs)).toBe('goal_setup');
      expect(getEffectiveStage(goalWs, 'analysis')).toBe('goal_setup');
    });
  });
});
