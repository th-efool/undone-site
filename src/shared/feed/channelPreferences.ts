/**
 * Undone - Canonical Channel Preferences Definitions
 * File: src/shared/feed/channelPreferences.ts
 */

import type { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';

export type { ChannelId };

export const VALID_CHANNEL_IDS: readonly ChannelId[] = [
  'default',
  'spark',
  'explore',
  'build',
  'listen',
  'deep_dive',
  'quick',
] as const;

export interface ChannelPreferences {
  depth: number;
  rigor: number;
  scaffolding: number;
  weeklyGoal: string;
  learningAllocation: string;
  reminderWindow: string;
}

export const DEFAULT_CHANNEL_PREFERENCES: ChannelPreferences = {
  depth: 0.74,
  rigor: 0.5,
  scaffolding: 0.35,
  weeklyGoal: '8 hours',
  learningAllocation: 'Balanced',
  reminderWindow: 'Evening',
};

export interface StoredChannelConfig {
  version: 2;
  activeChannel: ChannelId;
  prefs: Record<string, string>;
  dirty: boolean;
  updatedAt: string;
}

export const CHANNEL_CONFIG_STORAGE_PREFIX = 'sidequest_channel_config_v2:';

export const VALID_WEEKLY_GOALS = new Set([
  '4 hours',
  '8 hours',
  '12 hours',
  '16 hours',
  '20 hours',
]);

export const VALID_LEARNING_ALLOCATIONS = new Set([
  'Light',
  'Balanced',
  'Intensive',
  'Deep Dive',
]);

export const VALID_REMINDER_WINDOWS = new Set([
  'Morning',
  'Afternoon',
  'Evening',
  'Night',
]);

export const RECOGNIZED_NUMERIC_PREF_KEYS = new Set([
  'depth',
  'rigor',
  'scaffolding',
  // Channel sliders
  'spark_novelty',
  'spark_connectivity',
  'spark_abstraction',
  'explore_novelty',
  'explore_scope',
  'explore_serendipity',
  'build_guidance',
  'build_scope',
  'build_constraint',
  'listen_pacing',
  'listen_dialogue',
  'listen_soundscape',
  'deep_dive_depth',
  'deep_dive_rigor',
  'deep_dive_foundational',
  'quick_granularity',
  'quick_continuity',
  'quick_density',
]);

export function validatePrefEntry(
  key: string,
  val: unknown
): { valid: boolean; normalizedKey?: string; normalizedVal?: string } {
  if (typeof key !== 'string' || !key.length || key.length > 64 || key.startsWith('$')) {
    return { valid: false };
  }
  const cleanKey = key.trim();
  const strVal = String(val ?? '').trim();

  if (RECOGNIZED_NUMERIC_PREF_KEYS.has(cleanKey)) {
    const num = parseFloat(strVal);
    if (!Number.isFinite(num) || num < 0 || num > 1) {
      return { valid: false };
    }
    return { valid: true, normalizedKey: cleanKey, normalizedVal: num.toFixed(2) };
  }

  if (cleanKey === 'weekly_goal') {
    if (!VALID_WEEKLY_GOALS.has(strVal)) return { valid: false };
    return { valid: true, normalizedKey: cleanKey, normalizedVal: strVal };
  }

  if (cleanKey === 'learning_allocation') {
    if (!VALID_LEARNING_ALLOCATIONS.has(strVal)) return { valid: false };
    return { valid: true, normalizedKey: cleanKey, normalizedVal: strVal };
  }

  if (cleanKey === 'reminder_window') {
    if (!VALID_REMINDER_WINDOWS.has(strVal)) return { valid: false };
    return { valid: true, normalizedKey: cleanKey, normalizedVal: strVal };
  }

  // Allow channel slider keys of form <channel>_<control> where value is finite number 0..1
  if (cleanKey.includes('_')) {
    const [ch] = cleanKey.split('_');
    if (VALID_CHANNEL_IDS.includes(ch as ChannelId)) {
      const num = parseFloat(strVal);
      if (Number.isFinite(num) && num >= 0 && num <= 1) {
        return { valid: true, normalizedKey: cleanKey, normalizedVal: num.toFixed(2) };
      }
    }
  }

  return { valid: false };
}
