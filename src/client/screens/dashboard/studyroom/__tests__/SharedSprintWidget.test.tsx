/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SharedSprintWidget from '../room/components/SharedSprintWidget';
import type { UseRoomSprintReturn } from '../hooks/useRoomSprint';

describe('SharedSprintWidget component', () => {
  const createMockHook = (overrides?: Partial<UseRoomSprintReturn>): UseRoomSprintReturn => ({
    sprint: null,
    isLoading: false,
    error: null,
    actionError: null,
    remainingSeconds: 0,
    isJoined: false,
    canControl: false,
    startSprint: vi.fn(),
    pauseSprint: vi.fn(),
    resumeSprint: vi.fn(),
    stopSprint: vi.fn(),
    joinSprint: vi.fn(),
    leaveSprint: vi.fn(),
    refreshSprint: vi.fn(),
    ...overrides,
  });

  it('renders idle state for regular participant without controls', () => {
    const mockHook = createMockHook({ canControl: false });
    render(<SharedSprintWidget sprintHook={mockHook} />);

    expect(screen.getByText('Group Sprint')).toBeDefined();
    expect(screen.getByText('Idle')).toBeDefined();
    expect(
      screen.getByText('No group sprint in progress. Hosts can start a sprint.')
    ).toBeDefined();
    expect(screen.queryByText('Start Group Sprint')).toBeNull();
  });

  it('renders start sprint controls for room controller in idle state', () => {
    const startSprintMock = vi.fn();
    const mockHook = createMockHook({ canControl: true, startSprint: startSprintMock });
    render(<SharedSprintWidget sprintHook={mockHook} />);

    expect(screen.getByRole('combobox', { name: /sprint duration/i })).toBeDefined();
    const startBtn = screen.getByRole('button', { name: /start group sprint/i });
    expect(startBtn).toBeDefined();

    fireEvent.click(startBtn);
    expect(startSprintMock).toHaveBeenCalledWith(25);
  });

  it('renders active sprint state with countdown, members, and controller controls', () => {
    const pauseSprintMock = vi.fn();
    const stopSprintMock = vi.fn();
    const leaveSprintMock = vi.fn();

    const mockHook = createMockHook({
      canControl: true,
      isJoined: true,
      remainingSeconds: 1420,
      sprint: {
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'user-1',
        title: 'Math Marathon',
        targetDurationSeconds: 1500,
        elapsedSeconds: 80,
        remainingSeconds: 1420,
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        deadline: new Date(Date.now() + 1420000).toISOString(),
        pausedAt: null,
        endedAt: null,
        version: 1,
        revision: 2,
        participantCount: 3,
        participants: [],
      },
      pauseSprint: pauseSprintMock,
      stopSprint: stopSprintMock,
      leaveSprint: leaveSprintMock,
    });

    render(<SharedSprintWidget sprintHook={mockHook} />);

    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('23:40')).toBeDefined();
    expect(screen.getByText('Math Marathon')).toBeDefined();
    expect(screen.getByText('3 members')).toBeDefined();

    // Joined button
    const joinedBtn = screen.getByRole('button', { name: /joined/i });
    expect(joinedBtn).toBeDefined();
    fireEvent.click(joinedBtn);
    expect(leaveSprintMock).toHaveBeenCalled();

    // Pause button
    const pauseBtn = screen.getByRole('button', { name: /pause group sprint/i });
    fireEvent.click(pauseBtn);
    expect(pauseSprintMock).toHaveBeenCalled();

    // Stop button
    const stopBtn = screen.getByRole('button', { name: /stop group sprint/i });
    fireEvent.click(stopBtn);
    expect(stopSprintMock).toHaveBeenCalled();
  });

  it('renders join sprint button when participant is not yet joined', () => {
    const joinSprintMock = vi.fn();
    const mockHook = createMockHook({
      canControl: false,
      isJoined: false,
      remainingSeconds: 900,
      sprint: {
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'user-1',
        title: null,
        targetDurationSeconds: 1500,
        elapsedSeconds: 600,
        remainingSeconds: 900,
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        deadline: new Date(Date.now() + 900000).toISOString(),
        pausedAt: null,
        endedAt: null,
        version: 1,
        revision: 1,
        participantCount: 1,
        participants: [],
      },
      joinSprint: joinSprintMock,
    });

    render(<SharedSprintWidget sprintHook={mockHook} />);

    const joinBtn = screen.getByRole('button', { name: /join sprint/i });
    expect(joinBtn).toBeDefined();
    fireEvent.click(joinBtn);
    expect(joinSprintMock).toHaveBeenCalled();
  });

  it('renders error banner when actionError is present', () => {
    const mockHook = createMockHook({
      actionError: 'Sprint revision conflict; please refresh sprint status',
    });

    render(<SharedSprintWidget sprintHook={mockHook} />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('Sprint revision conflict; please refresh sprint status');
  });
});
