/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomToast } from '../room/components/RoomToast';

describe('RoomToast component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders nothing when message is null', () => {
    const { container } = render(
      <RoomToast message={null} onDismiss={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders message text in role status and auto-dismisses after 4000ms', () => {
    const handleDismiss = vi.fn();

    render(
      <RoomToast
        message={{ id: 1, text: 'Room music set.' }}
        onDismiss={handleDismiss}
      />
    );

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toBeTruthy();
    expect(screen.getByText('Room music set.')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(handleDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when close button is clicked', () => {
    const handleDismiss = vi.fn();

    render(
      <RoomToast
        message={{ id: 2, text: 'Background changed.' }}
        onDismiss={handleDismiss}
      />
    );

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss notification' });
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
