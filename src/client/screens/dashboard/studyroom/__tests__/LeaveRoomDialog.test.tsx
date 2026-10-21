/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LeaveRoomDialog from '../room/components/LeaveRoomDialog';

describe('LeaveRoomDialog (Phase 5)', () => {
  it('renders correctly and dispatches onStay, onLeave, and onLeaveAll', () => {
    const handleStay = vi.fn();
    const handleLeave = vi.fn();
    const handleLeaveAll = vi.fn();

    const { rerender } = render(
      <LeaveRoomDialog
        open={true}
        onStay={handleStay}
        onLeave={handleLeave}
        onLeaveAll={handleLeaveAll}
      />
    );

    expect(screen.getByText('Leave this room?')).toBeTruthy();
    expect(
      screen.getByText('Your timer, tasks and goal live only in this session and will be cleared.')
    ).toBeTruthy();

    const leaveBtn = screen.getByRole('button', { name: 'Leave room' });
    fireEvent.click(leaveBtn);
    expect(handleLeave).toHaveBeenCalledTimes(1);

    const leaveAllBtn = screen.getByRole('button', { name: 'Leave all devices' });
    fireEvent.click(leaveAllBtn);
    expect(handleLeaveAll).toHaveBeenCalledTimes(1);

    const stayBtn = screen.getByRole('button', { name: 'Stay' });
    fireEvent.click(stayBtn);
    expect(handleStay).toHaveBeenCalledTimes(1);

    // Rerender without onLeaveAll
    rerender(
      <LeaveRoomDialog
        open={true}
        onStay={handleStay}
        onLeave={handleLeave}
      />
    );

    expect(screen.queryByRole('button', { name: 'Leave all devices' })).toBeNull();
  });
});
