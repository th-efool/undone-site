// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

const fake = vi.hoisted(() => ({
  actions: [] as unknown[],
  fetchResponses: [] as { ok: boolean; status: number; body: unknown }[],
}));

vi.mock('@/src/client/interaction/hooks', () => ({
  useDispatchAction: () => async (action: unknown) => {
    fake.actions.push(action);
    return true;
  },
}));

import { ReleasePanel } from '../components/ReleasePanel';

const baseWorkspace: CohortWorkspace = cohortWorkspaceSchema.parse({
  schemaVersion: 1,
  title: 'Distributed Systems',
  intent: 'Master distributed consensus and fault-tolerance',
  audience: 'Software Engineers',
  dailyMinutes: 30,
  lessons: [
    {
      id: 'lesson-1',
      version: 0,
      title: 'Paxos and Raft',
      objective: 'Understand quorum consensus',
      sourceChunkIds: [],
      pinned: false,
    },
  ],
  sources: [],
  chunks: [],
  understanding: [],
  analyses: [],
  processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
});

describe('ReleasePanel UI Component', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    fake.actions = [];
    fake.fetchResponses = [];
    global.fetch = vi.fn().mockImplementation(async () => {
      const next = fake.fetchResponses.shift() ?? {
        ok: true,
        status: 200,
        body: {
          success: true,
          receipt: {
            cohortId: 'cohort-test-123',
            releasedAt: '2026-10-14T10:00:00.000Z',
            mode: 'private_activation',
            effectKey: 'test-effect',
            contentHash: 'a'.repeat(64),
            destinationUrl: '/play?cohort=cohort-test-123',
          },
          revision: 2,
        },
      };
      return {
        ok: next.ok,
        status: next.status,
        json: async () => next.body,
      } as Response;
    });
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it('renders readiness badge and enabled release button for a valid workspace', () => {
    render(<ReleasePanel workspace={baseWorkspace} workspaceId="ws-1" />);

    expect(screen.getByText('Ready for Release')).toBeDefined();
    const releaseBtn = screen.getByRole('button', { name: /Release & Start Learning/ });
    expect((releaseBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('displays blockers and disables release button when workspace has no lessons', () => {
    const unreadyWorkspace = cohortWorkspaceSchema.parse({
      ...baseWorkspace,
      lessons: [],
    });

    render(<ReleasePanel workspace={unreadyWorkspace} workspaceId="ws-1" />);

    expect(screen.getByText(/1 Blocker/)).toBeDefined();
    expect(screen.getByText('Workspace has no lessons in its curriculum.')).toBeDefined();
    const releaseBtn = screen.getByRole('button', { name: /Release & Start Learning/ });
    expect((releaseBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows mode toggling and validates public release restrictions', () => {
    const restrictedWorkspace = cohortWorkspaceSchema.parse({
      ...baseWorkspace,
      sources: [
        {
          id: 'src-1',
          version: 0,
          label: 'Internal Docs',
          text: 'Private company secrets',
          checksum: 'b'.repeat(64),
          state: 'ready',
          isRestricted: true,
        },
      ],
      chunks: [
        {
          id: 'chunk-1',
          sourceId: 'src-1',
          sourceVersion: 0,
          start: 0,
          end: 20,
          text: 'Private secrets',
          checksum: 'c'.repeat(64),
        },
      ],
      lessons: [
        {
          id: 'lesson-1',
          version: 0,
          title: 'Private Lesson',
          objective: 'Learn secrets',
          sourceChunkIds: ['chunk-1'],
          pinned: false,
        },
      ],
    });

    render(<ReleasePanel workspace={restrictedWorkspace} workspaceId="ws-1" />);

    // Private mode is allowed
    expect(screen.getByText('Ready for Release')).toBeDefined();

    // Switch to public mode
    const publicRadio = screen.getByRole('radio', { name: /Publish to Directory/ });
    fireEvent.click(publicRadio);

    // Now blocked due to restricted source
    expect(screen.getAllByText(/Blocker/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Private, connector, or restricted sources cannot be published publicly/)
    ).toBeDefined();

    const publishBtn = screen.getByRole('button', { name: /Publish Cohort/ });
    expect((publishBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('prevents downgrade from public to private when already published', () => {
    const publishedWorkspace = cohortWorkspaceSchema.parse({
      ...baseWorkspace,
      release: {
        status: 'released',
        mode: 'public_publish',
        cohortId: 'public-cohort-99',
        releasedAt: '2026-10-14T08:00:00.000Z',
        receipt: {
          effectKey: 'e'.repeat(64),
          workspaceId: 'ws-1',
          cohortId: 'public-cohort-99',
          releasedAt: '2026-10-14T08:00:00.000Z',
          mode: 'public_publish',
          contentHash: 'f'.repeat(64),
          destinationUrl: '/cohort/public-cohort-99',
        },
      },
    });

    render(<ReleasePanel workspace={publishedWorkspace} workspaceId="ws-1" />);

    expect(screen.getByText('Published Publicly')).toBeDefined();
    const privateRadio = screen.getByRole('radio', { name: /Start as Learner \(Private\)/ });
    expect(privateRadio.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/Downgrading public cohorts to private activation is not permitted/)).toBeDefined();
  });

  it('triggers release API and calls onNavigateToDestination on success', async () => {
    const onNavigate = vi.fn();
    render(
      <ReleasePanel
        workspace={baseWorkspace}
        workspaceId="ws-123"
        onNavigateToDestination={onNavigate}
      />
    );

    const releaseBtn = screen.getByRole('button', { name: /Release & Start Learning/ });

    await act(async () => {
      fireEvent.click(releaseBtn);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cohort-builder/workspaces/ws-123/release',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ mode: 'private_activation' }),
      })
    );

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('/play?cohort=cohort-test-123');
    });

    expect(fake.actions).toContainEqual(
      expect.objectContaining({
        type: 'commit_release',
        mode: 'private_activation',
      })
    );
  });

  it('displays release error when API call returns an error', async () => {
    fake.fetchResponses = [
      {
        ok: false,
        status: 422,
        body: {
          code: 'COHORT_NOT_READY',
          message: 'Cohort not ready',
          report: { blockers: ['Background processing not done.'] },
        },
      },
    ];

    render(<ReleasePanel workspace={baseWorkspace} workspaceId="ws-1" />);

    const releaseBtn = screen.getByRole('button', { name: /Release & Start Learning/ });

    await act(async () => {
      fireEvent.click(releaseBtn);
    });

    expect(await screen.findByText(/Release blocked: Background processing not done\./)).toBeDefined();
  });
});
