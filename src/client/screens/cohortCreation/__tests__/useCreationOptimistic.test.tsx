// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import type { CreationSnapshot, MaterialSource } from '@/src/shared/cohort-creation/contracts';

const { api, observer } = vi.hoisted(() => ({
  api: { create: vi.fn(), load: vi.fn(), command: vi.fn() },
  observer: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../services/draftApi', async (original) => ({
  ...(await original<typeof import('../services/draftApi')>()),
  draftApi: api,
}));
vi.mock('../services/draftEvents', async (original) => ({
  ...(await original<typeof import('../services/draftEvents')>()),
  observeDraftEvents: observer,
}));

import { useCreation } from '../hooks/useCreation';

let saved: CreationSnapshot;

const validMaterialId = '11111111-1111-4111-8111-111111111111';
const validUnitId1 = 'dQw4w9WgXcQ';
const validUnitId2 = 'oHg5SJYRHA0';

const sampleMaterial: MaterialSource = {
  id: validMaterialId,
  kind: 'web',
  status: 'ready',
  selectedUnitIds: [validUnitId1],
  input: { kind: 'url', url: 'https://example.com' },
};

beforeEach(() => {
  saved = {
    ...initialSnapshot(draftId),
    stage: 'starting_point',
    startingPoint: 'have_material',
    materials: [sampleMaterial],
  };
  Object.values(api).forEach((mock) => mock.mockReset());
  observer.mockReset();
  api.load.mockImplementation(async () => saved);
  api.create.mockImplementation(async () => saved);
});

afterEach(() => {
  cleanup();
});

describe('useCreation optimistic actions', () => {
  it('optimistically removes material before server command resolves', async () => {
    let resolveCommand!: (snapshot: CreationSnapshot) => void;
    api.command.mockImplementation(
      () =>
        new Promise<CreationSnapshot>((resolve) => {
          resolveCommand = resolve;
        }),
    );

    const { result } = renderHook(() => useCreation(draftId, '', true));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    expect(result.current.snapshot.materials).toHaveLength(1);

    // Trigger removeMaterial without awaiting resolution
    let removePromise: Promise<boolean>;
    act(() => {
      removePromise = result.current.removeMaterial(validMaterialId);
    });

    // Material should be gone immediately (<16ms) in optimistic state
    expect(result.current.snapshot.materials).toHaveLength(0);

    // Resolve server command
    await act(async () => {
      const serverUpdated: CreationSnapshot = {
        ...saved,
        revision: saved.revision + 1,
        materials: [],
      };
      resolveCommand(serverUpdated);
      await removePromise;
    });

    expect(result.current.snapshot.materials).toHaveLength(0);
    expect(result.current.saved).toBe(true);
  });

  it('rolls back removed material if server command fails', async () => {
    let rejectCommand!: (err: Error) => void;
    api.command.mockImplementation(
      () =>
        new Promise<CreationSnapshot>((_, reject) => {
          rejectCommand = reject;
        }),
    );

    const { result } = renderHook(() => useCreation(draftId, '', true));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    expect(result.current.snapshot.materials).toHaveLength(1);

    let removePromise: Promise<boolean>;
    act(() => {
      removePromise = result.current.removeMaterial(validMaterialId);
    });

    // Optimistically removed
    expect(result.current.snapshot.materials).toHaveLength(0);

    // Server fails
    await act(async () => {
      rejectCommand(new Error('Network drop'));
      await removePromise;
    });

    // Rolled back to original snapshot
    expect(result.current.snapshot.materials).toHaveLength(1);
    expect(result.current.snapshot.materials[0].id).toBe(validMaterialId);
  });

  it('optimistically updates youtube units selection before server resolves', async () => {
    let resolveCommand!: (snapshot: CreationSnapshot) => void;
    api.command.mockImplementation(
      () =>
        new Promise<CreationSnapshot>((resolve) => {
          resolveCommand = resolve;
        }),
    );

    const { result } = renderHook(() => useCreation(draftId, '', true));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    let selectPromise: Promise<boolean>;
    act(() => {
      selectPromise = result.current.selectYoutubeUnits(validMaterialId, [validUnitId1, validUnitId2]);
    });

    // Optimistically updated
    expect(result.current.snapshot.materials[0].selectedUnitIds).toEqual([validUnitId1, validUnitId2]);

    // Server resolves
    await act(async () => {
      const serverUpdated: CreationSnapshot = {
        ...saved,
        revision: saved.revision + 1,
        materials: [{ ...sampleMaterial, selectedUnitIds: [validUnitId1, validUnitId2] }],
      };
      resolveCommand(serverUpdated);
      await selectPromise;
    });

    expect(result.current.snapshot.materials[0].selectedUnitIds).toEqual([validUnitId1, validUnitId2]);
  });

  it('optimistically transitions starting point before server resolves', async () => {
    saved = { ...initialSnapshot(draftId), stage: 'starting_point', startingPoint: null };
    let resolveCommand!: (snapshot: CreationSnapshot) => void;
    api.command.mockImplementation(
      () =>
        new Promise<CreationSnapshot>((resolve) => {
          resolveCommand = resolve;
        }),
    );

    const { result } = renderHook(() => useCreation(draftId, '', true));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    expect(result.current.snapshot.startingPoint).toBeNull();

    let choosePromise: Promise<boolean>;
    act(() => {
      choosePromise = result.current.chooseStartingPoint('have_material');
    });

    // Optimistically updated
    expect(result.current.snapshot.startingPoint).toBe('have_material');

    await act(async () => {
      const serverUpdated: CreationSnapshot = {
        ...saved,
        revision: saved.revision + 1,
        startingPoint: 'have_material',
      };
      resolveCommand(serverUpdated);
      await choosePromise;
    });

    expect(result.current.snapshot.startingPoint).toBe('have_material');
  });
});
