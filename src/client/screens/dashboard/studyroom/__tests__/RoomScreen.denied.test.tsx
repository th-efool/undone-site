/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomScreen } from '../room/RoomScreen';

const pushSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: 'test-user', name: 'Test User' },
    },
    status: 'authenticated',
  }),
}));

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: 'suspended' | 'running' = 'running';
  destination = { connect: vi.fn(), disconnect: vi.fn() };
  createGain() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
    };
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return { numberOfChannels: channels, length, sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null, loop: false };
  }
  createBiquadFilter() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      type: 'lowpass',
      frequency: { value: 350 },
      Q: { value: 1 },
    };
  }
  createOscillator() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  close() {
    return Promise.resolve();
  }
}

describe('RoomScreen Honest Denied Stages (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).AudioContext = MockAudioContext;
    (window as any).webkitAudioContext = MockAudioContext;
  });

  afterEach(() => {
    cleanup();
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;
    vi.restoreAllMocks();
  });

  it('renders honest room full card when eligibilityReason is ROOM_FULL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        room: {
          id: 'room-1',
          slug: 'library',
          title: 'Library',
          status: 'OPEN',
          capacity: 25,
          onlineCount: 25,
        },
        viewer: {
          userId: 'test-user',
          isJoined: false,
        },
        capabilities: {
          canJoin: false,
          eligibilityReason: 'ROOM_FULL',
        },
      }),
    } as any);

    render(<RoomScreen roomSlug="library" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('room-denied-stage')).toBeTruthy();
    expect(screen.getByText('Study Room is Full')).toBeTruthy();
    expect(
      screen.getByText(/This room has reached its maximum seat capacity/i)
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Browse Study Rooms/i })).toBeTruthy();
  });

  it('renders honest closed card when eligibilityReason is ROOM_CLOSED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        room: {
          id: 'room-2',
          slug: 'fireplace',
          title: 'Fireplace',
          status: 'CLOSED',
          capacity: 25,
          onlineCount: 0,
        },
        viewer: {
          userId: 'test-user',
          isJoined: false,
        },
        capabilities: {
          canJoin: false,
          eligibilityReason: 'ROOM_CLOSED',
        },
      }),
    } as any);

    render(<RoomScreen roomSlug="fireplace" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('room-denied-stage')).toBeTruthy();
    expect(screen.getByText('Study Room is Closed')).toBeTruthy();
    expect(screen.getByText(/This room has been closed or archived by the host/i)).toBeTruthy();
  });

  it('renders enrollment required card when eligibilityReason is ENROLLMENT_REQUIRED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        room: {
          id: 'room-cohort',
          slug: 'cohort-den',
          title: 'Cohort Room',
          status: 'OPEN',
          cohortId: 'cohort-123',
          capacity: 25,
          onlineCount: 5,
        },
        viewer: {
          userId: 'test-user',
          isJoined: false,
        },
        capabilities: {
          canJoin: false,
          eligibilityReason: 'ENROLLMENT_REQUIRED',
        },
      }),
    } as any);

    render(<RoomScreen roomSlug="cohort-den" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('room-denied-stage')).toBeTruthy();
    expect(screen.getByText('Cohort Enrollment Required')).toBeTruthy();
    expect(screen.getByRole('button', { name: /View Cohort/i })).toBeTruthy();
  });
});
