// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  homeStorageAdapter,
  DEFAULT_CHANNEL_PREFERENCES,
  type ChannelPreferences,
} from '../homeStorageAdapter';

describe('homeStorageAdapter channel preferences and canonical storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('initializes with default channel preferences when storage is empty', () => {
    const config = homeStorageAdapter.getStoredChannelConfig('usr-1');
    expect(config.version).toBe(2);
    expect(config.activeChannel).toBe('default');
    expect(config.dirty).toBe(false);

    const prefs = homeStorageAdapter.getChannelPreferences('usr-1');
    expect(prefs.depth).toBe(DEFAULT_CHANNEL_PREFERENCES.depth);
    expect(prefs.weeklyGoal).toBe('8 hours');
  });

  it('merges partial preference updates without erasing channel sliders', () => {
    // 1. Save a channel slider
    homeStorageAdapter.saveChannelParam('explore', 'novelty', 0.85, 'usr-1');
    expect(homeStorageAdapter.getChannelParam('explore', 'novelty', 0.5, 'usr-1')).toBe(0.85);

    // 2. Update general preferences
    homeStorageAdapter.saveChannelPreferences({ depth: 0.95 }, 'usr-1');

    // 3. Verify channel slider was NOT erased
    expect(homeStorageAdapter.getChannelParam('explore', 'novelty', 0.5, 'usr-1')).toBe(0.85);
    expect(homeStorageAdapter.getChannelPreferences('usr-1').depth).toBe(0.95);

    // 4. Verify canonical storage document
    const config = homeStorageAdapter.getStoredChannelConfig('usr-1');
    expect(config.prefs.explore_novelty).toBe('0.85');
    expect(config.prefs.depth).toBe('0.95');
    expect(config.dirty).toBe(true);
  });

  it('isolates user preferences by userId', () => {
    homeStorageAdapter.saveSelectedChannel('build', 'user-A');
    homeStorageAdapter.saveSelectedChannel('listen', 'user-B');

    expect(homeStorageAdapter.getSelectedChannel('user-A')).toBe('build');
    expect(homeStorageAdapter.getSelectedChannel('user-B')).toBe('listen');
  });

  it('imports legacy keys for anonymous user only and cleans them up', () => {
    localStorage.setItem('sidequest_active_channel', 'explore');
    localStorage.setItem('sidequest_channel_prefs', JSON.stringify({
      depth: '0.40',
      spark_novelty: '0.70',
    }));

    // Access anon config
    const anonConfig = homeStorageAdapter.getStoredChannelConfig(null);
    expect(anonConfig.activeChannel).toBe('explore');
    expect(anonConfig.prefs.depth).toBe('0.40');
    expect(anonConfig.prefs.spark_novelty).toBe('0.70');

    // A newly signed-in user must NOT inherit unattributed legacy anonymous keys
    const newUserConfig = homeStorageAdapter.getStoredChannelConfig('new-user-123');
    expect(newUserConfig.activeChannel).toBe('default'); // Default
    expect(newUserConfig.prefs.depth).toBe(DEFAULT_CHANNEL_PREFERENCES.depth.toFixed(2));
  });

  it('preserves dirty local draft during backend sync and triggers sync instead of overwriting', async () => {
    homeStorageAdapter.saveChannelPreferences({ depth: 0.99 }, 'usr-1');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeChannel: 'quick',
        prefs: { depth: '0.20' },
      }),
    });
    global.fetch = fetchMock;

    const result = await homeStorageAdapter.syncChannelWithBackend('usr-1', true);
    // Preserves local 0.99 draft because it was dirty
    expect(result?.prefs.depth).toBe(0.99);
  });

  it('clears user choices and cancel pending saves on clearUserChoices', () => {
    homeStorageAdapter.saveSelectedChannel('quick', 'usr-to-clear');
    expect(homeStorageAdapter.getSelectedChannel('usr-to-clear')).toBe('quick');

    homeStorageAdapter.clearUserChoices('usr-to-clear');
    expect(homeStorageAdapter.getSelectedChannel('usr-to-clear')).toBe('default'); // reset to default
  });
});
