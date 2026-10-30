// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user-hub' } },
    status: 'authenticated',
  }),
}));

import { ChannelHub } from '../ChannelHub';
import { homeStorageAdapter } from '@/src/client/repositories/homeStorageAdapter';

describe('ChannelHub component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ activeChannel: 'spark', prefs: {} }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders fine-tune header and channel tabs', () => {
    render(<ChannelHub />);
    expect(screen.getByText('Fine-tune your feed')).toBeDefined();
    expect(screen.getByText('Learning style')).toBeDefined();
    expect(screen.getByText('Daily preferences')).toBeDefined();
  });

  it('switches channel and saves to storage adapter when a channel tab is clicked', async () => {
    render(<ChannelHub />);
    const exploreTab = screen.getByTitle(/Explore/);
    fireEvent.click(exploreTab);

    expect(homeStorageAdapter.getSelectedChannel('test-user-hub')).toBe('explore');
  });

  it('renders unconsumed daily preferences disabled with "Coming later"', async () => {
    render(<ChannelHub />);
    const comingLaterBadges = screen.getAllByText('Coming later');
    expect(comingLaterBadges.length).toBe(3);

    // Clicking disabled control does not open a popover
    fireEvent.click(comingLaterBadges[0]);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('resets parameters to defaults when Reset button is clicked', async () => {
    homeStorageAdapter.saveSelectedChannel('build', 'test-user-hub');
    homeStorageAdapter.saveChannelPreferences({ weeklyGoal: '16 hours' }, 'test-user-hub');

    render(<ChannelHub />);
    const resetBtn = screen.getByRole('button', { name: /Reset tuning parameters/i });
    fireEvent.click(resetBtn);

    expect(homeStorageAdapter.getChannelPreferences('test-user-hub').weeklyGoal).toBe('8 hours');
  });
});
