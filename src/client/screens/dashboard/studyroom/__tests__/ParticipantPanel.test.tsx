/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import ParticipantPanel from '../room/components/ParticipantPanel';
import type { RoomParticipantView } from '../types';

describe('ParticipantPanel component', () => {
  afterEach(() => {
    cleanup();
  });

  const baseNow = 1_700_000_000_000;

  it('orders participants: current user first, host second, then others by joinedAt ascending', () => {
    const participants: RoomParticipantView[] = [
      {
        userId: 'peer-later',
        displayName: 'Late Comer',
        avatarUrl: null,
        joinedAt: baseNow - 10 * 60_000, // joined 10m ago
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: false,
      },
      {
        userId: 'peer-earlier',
        displayName: 'Early Bird',
        avatarUrl: null,
        joinedAt: baseNow - 45 * 60_000, // joined 45m ago (longest-present peer)
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: false,
      },
      {
        userId: 'peer-host',
        displayName: 'Room Host',
        avatarUrl: null,
        joinedAt: baseNow - 20 * 60_000,
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: true,
      },
      {
        userId: 'current-user',
        displayName: 'Current User',
        avatarUrl: null,
        joinedAt: baseNow - 5 * 60_000,
        publicGoal: null,
        isCurrentUser: true,
        isAdmin: false,
      },
    ];

    render(<ParticipantPanel participants={participants} now={baseNow} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);

    // 1. Current user
    expect(rows[0].textContent).toContain('Current User');
    expect(rows[0].textContent).toContain('You');

    // 2. Room host
    expect(rows[1].textContent).toContain('Room Host');
    expect(rows[1].textContent).toContain('Host');

    // 3. Early bird (joined 45m ago)
    expect(rows[2].textContent).toContain('Early Bird');

    // 4. Late comer (joined 10m ago)
    expect(rows[3].textContent).toContain('Late Comer');
  });

  it('renders "You" badge and "Host" badge appropriately', () => {
    const participants: RoomParticipantView[] = [
      {
        userId: 'user-me',
        displayName: 'Alice',
        avatarUrl: null,
        joinedAt: baseNow,
        publicGoal: null,
        isCurrentUser: true,
        isAdmin: false,
      },
      {
        userId: 'user-admin',
        displayName: 'Bob',
        avatarUrl: null,
        joinedAt: baseNow - 60_000,
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: true,
      },
      {
        userId: 'user-regular',
        displayName: 'Charlie',
        avatarUrl: null,
        joinedAt: baseNow - 120_000,
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: false,
      },
    ];

    render(<ParticipantPanel participants={participants} now={baseNow} />);

    const aliceRow = screen.getByTestId('participant-row-user-me');
    expect(aliceRow.textContent).toContain('You');
    expect(aliceRow.textContent).not.toContain('Host');

    const bobRow = screen.getByTestId('participant-row-user-admin');
    expect(bobRow.textContent).toContain('Host');
    expect(bobRow.textContent).not.toContain('You');

    const charlieRow = screen.getByTestId('participant-row-user-regular');
    expect(charlieRow.textContent).not.toContain('You');
    expect(charlieRow.textContent).not.toContain('Host');
  });

  it('renders public goal when present and omits it when null', () => {
    const participants: RoomParticipantView[] = [
      {
        userId: 'user-with-goal',
        displayName: 'Focused Learner',
        avatarUrl: null,
        joinedAt: baseNow - 60_000,
        publicGoal: 'Finishing section 4',
        isCurrentUser: false,
        isAdmin: false,
      },
      {
        userId: 'user-no-goal',
        displayName: 'Quiet Student',
        avatarUrl: null,
        joinedAt: baseNow - 120_000,
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: false,
      },
    ];

    render(<ParticipantPanel participants={participants} now={baseNow} />);

    expect(screen.getByText('Finishing section 4')).toBeTruthy();
    const quietRow = screen.getByTestId('participant-row-user-no-goal');
    expect(quietRow.querySelector('p')).toBeNull();
  });

  it('formats elapsed time correctly', () => {
    const participants: RoomParticipantView[] = [
      {
        userId: 'user-just-joined',
        displayName: 'Newcomer',
        avatarUrl: null,
        joinedAt: baseNow - 30_000, // 30s ago
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: false,
      },
      {
        userId: 'user-minutes',
        displayName: 'Steady Worker',
        avatarUrl: null,
        joinedAt: baseNow - 15 * 60_000, // 15m ago
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: false,
      },
      {
        userId: 'user-hours',
        displayName: 'Marathoner',
        avatarUrl: null,
        joinedAt: baseNow - (2 * 3600_000 + 10 * 60_000), // 2h 10m ago
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: false,
      },
    ];

    render(<ParticipantPanel participants={participants} now={baseNow} />);

    expect(screen.getByText('Just joined')).toBeTruthy();
    expect(screen.getByText('15m')).toBeTruthy();
    expect(screen.getByText('2h 10m')).toBeTruthy();
  });

  it('displays alone notice when participant is the only one in room', () => {
    const participants: RoomParticipantView[] = [
      {
        userId: 'solo-user',
        displayName: 'Sole Survivor',
        avatarUrl: null,
        joinedAt: baseNow,
        publicGoal: null,
        isCurrentUser: true,
        isAdmin: false,
      },
    ];

    render(<ParticipantPanel participants={participants} now={baseNow} />);

    expect(screen.getByText("You're the only one here right now.")).toBeTruthy();
  });

  it('falls back to "Guest" when displayName is missing or empty whitespace', () => {
    const participants: RoomParticipantView[] = [
      {
        userId: 'anonymous-user',
        displayName: '   ',
        avatarUrl: null,
        joinedAt: baseNow,
        publicGoal: null,
        isCurrentUser: false,
        isAdmin: false,
      },
    ];

    render(<ParticipantPanel participants={participants} now={baseNow} />);

    expect(screen.getByText('Guest')).toBeTruthy();
  });
});
