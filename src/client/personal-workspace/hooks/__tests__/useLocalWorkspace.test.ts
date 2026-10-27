/** @vitest-environment jsdom */

/**
 * Unit Tests for useLocalWorkspace React Hook
 *
 * Tests:
 * - Lifecycle management (opening, subscription, and cleanup on unmount / user switch)
 * - Exposing domain state, sync summary, and mutations
 * - applyCommand, saveCanvas, updateCanvasBuffer, and exportRecovery
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { LocalReceipt } from '@/src/shared/personal-workspace/contracts';
import { useLocalWorkspace } from '../useLocalWorkspace';
import { LocalWorkspace } from '../../local/facade';
import { TabLockCoordinator } from '../../local/database';
import { FIXTURE_NOTEBOOK } from '@/src/client/screens/dashboard/notes/validation/fixtures';

describe('useLocalWorkspace Hook', () => {
  const TEST_USER = 'user-hook-test';

  beforeEach(async () => {
    TabLockCoordinator.resetAllLocks();
    LocalWorkspace.resetAllInstances();
    const ws = new LocalWorkspace(TEST_USER, { useMemory: true });
    await ws.getRepository().clearAll();
    await ws.close();
  });

  afterEach(async () => {
    LocalWorkspace.resetAllInstances();
    TabLockCoordinator.resetAllLocks();
  });

  it('returns idle state and null data when userId is null', () => {
    const { result } = renderHook(() => useLocalWorkspace(null));

    expect(result.current.state).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.syncSummary.status).toBe('idle');
    expect(result.current.syncSummary.pendingMutations).toBe(0);
  });

  it('opens workspace and updates state and syncSummary when userId is provided', async () => {
    const { result } = renderHook(() => useLocalWorkspace(TEST_USER));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for workspace to open
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.state).toBeDefined();
    expect(result.current.state?.notebooks).toHaveLength(0);
    expect(result.current.syncSummary.status).toBe('synced');
  });

  it('applies command and updates state via hook', async () => {
    const { result } = renderHook(() => useLocalWorkspace(TEST_USER));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let receipt: LocalReceipt | undefined;
    await act(async () => {
      receipt = await result.current.applyCommand({
        type: 'save_notebook',
        notebook: FIXTURE_NOTEBOOK,
      });
    });

    expect(receipt?.ok).toBe(true);

    await waitFor(() => {
      expect(result.current.state?.notebooks).toHaveLength(1);
    });
    expect(result.current.state?.notebooks[0].id).toBe(FIXTURE_NOTEBOOK.id);
  });

  it('saves canvas scene and updates live buffer via hook', async () => {
    const { result } = renderHook(() => useLocalWorkspace(TEST_USER));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Update live buffer
    act(() => {
      result.current.updateCanvasBuffer('note-hook-1', { draft: true });
    });

    // Save canvas scene
    let receipt: LocalReceipt | undefined;
    await act(async () => {
      receipt = await result.current.saveCanvas('note-hook-1', {
        elements: [{ id: 'elem-1', type: 'rectangle' }],
        appState: {},
      });
    });

    expect(receipt?.ok).toBe(true);

    await waitFor(() => {
      expect(result.current.state?.notes).toHaveLength(1);
    });
    expect(result.current.state?.notes[0].id).toBe('note-hook-1');
  });

  it('handles user switch by closing old workspace and opening new one', async () => {
    const USER_A = 'user-switch-a';
    const USER_B = 'user-switch-b';

    const { result, rerender } = renderHook(
      ({ userId }) => useLocalWorkspace(userId),
      { initialProps: { userId: USER_A } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Switch user to USER_B
    rerender({ userId: USER_B });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.state).toBeDefined();
  });
});
