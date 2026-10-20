/** @vitest-environment jsdom */
import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCohortViewer } from '../useCohortViewer';

const mocks = vi.hoisted(() => ({
  session: {
    status: 'authenticated' as 'authenticated' | 'unauthenticated' | 'loading',
    data: { user: { id: 'user-123', name: 'Learner' } } as { user?: { id?: string; name?: string } } | null,
  },
  useQuery: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: mocks.session.status,
    data: mocks.session.data,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mocks.useQuery(options),
}));

describe('useCohortViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = {
      status: 'authenticated',
      data: { user: { id: 'user-123', name: 'Learner' } },
    };
    mocks.useQuery.mockImplementation(() => ({
      data: { enrolled: true },
      isLoading: false,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('configures useQuery with refetchOnWindowFocus: false and refetchOnMount: false', () => {
    renderHook(() => useCohortViewer('cohort-abc'));

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['cohort-viewer', 'cohort-abc', 'user-123'],
        enabled: true,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      }),
    );
  });

  it('disables query and marks as not enrolled when unauthenticated', () => {
    mocks.session = {
      status: 'unauthenticated',
      data: null,
    };
    mocks.useQuery.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));

    const { result } = renderHook(() => useCohortViewer('cohort-abc'));

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['cohort-viewer', 'cohort-abc', undefined],
        enabled: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      }),
    );
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.isEnrolled).toBe(false);
  });

  it('executes queryFn and handles network response', async () => {
    renderHook(() => useCohortViewer('cohort-abc'));
    const queryConfig = mocks.useQuery.mock.calls[0][0];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enrolled: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await queryConfig.queryFn();
    expect(fetchMock).toHaveBeenCalledWith('/api/cohort/cohort-abc/viewer');
    expect(result).toEqual({ enrolled: true });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });
    const errorResult = await queryConfig.queryFn();
    expect(errorResult).toEqual({ enrolled: false });

    vi.unstubAllGlobals();
  });
});
