import type { ActiveCohort, PausedCohort } from '@/src/client/screens/dashboard/home/models';

export type ChannelId = 'spark' | 'explore' | 'build' | 'listen' | 'deep_dive' | 'quick';

export interface ChannelPreferences {
  depth: number;
  rigor: number;
  scaffolding: number;
  weeklyGoal: string;
  learningAllocation: string;
  reminderWindow: string;
}

export const VALID_CHANNEL_IDS: ChannelId[] = [
  'spark',
  'explore',
  'build',
  'listen',
  'deep_dive',
  'quick',
];

export const DEFAULT_CHANNEL_PREFERENCES: ChannelPreferences = {
  depth: 0.74,
  rigor: 0.50,
  scaffolding: 0.35,
  weeklyGoal: '8 hours',
  learningAllocation: 'Balanced',
  reminderWindow: 'Evening',
};

const STORAGE_KEY = 'sidequest_home_choices';
const CHANNEL_KEY = 'sidequest_active_channel';
const CHANNEL_PREFS_KEY = 'sidequest_channel_prefs';
const FINETUNE_EXPANDED_KEY = 'sidequest_finetune_expanded';
const PAUSED_OPEN_KEY = 'sidequest_paused_open';
const COMPLETED_OPEN_KEY = 'sidequest_completed_open';
const SEARCH_QUERY_KEY = 'sidequest_home_search_query';

const PREF_DEPTH_KEY = 'sidequest_pref_depth';
const PREF_RIGOR_KEY = 'sidequest_pref_rigor';
const PREF_SCAFFOLDING_KEY = 'sidequest_pref_scaffolding';
const PREF_WEEKLY_GOAL_KEY = 'sidequest_pref_weekly_goal';
const PREF_LEARNING_ALLOCATION_KEY = 'sidequest_pref_learning_allocation';
const PREF_REMINDER_WINDOW_KEY = 'sidequest_pref_reminder_window';

export interface StoredHomeChoices {
  activeCohorts: ActiveCohort[];
  continueLater: PausedCohort[];
  updatedAt: string;
}

export const homeStorageAdapter = {
  /**
   * Load locally persisted choices synchronously from localStorage / cache
   */
  getStoredChoices(): StoredHomeChoices | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredHomeChoices;
      if (Array.isArray(parsed?.activeCohorts)) {
        return parsed;
      }
      return null;
    } catch (err) {
      console.warn('Failed to load local home choices:', err);
      return null;
    }
  },

  /**
   * Save choices locally to localStorage & Capacitor Preferences
   */
  saveChoices(activeCohorts: ActiveCohort[], continueLater: PausedCohort[]): void {
    if (typeof window === 'undefined') return;
    try {
      // Guard against clobbering existing stored choices with an empty array
      if (activeCohorts.length === 0 && continueLater.length === 0) {
        return;
      }

      const payload: StoredHomeChoices = {
        activeCohorts,
        continueLater,
        updatedAt: new Date().toISOString(),
      };
      const jsonStr = JSON.stringify(payload);
      localStorage.setItem(STORAGE_KEY, jsonStr);

      // Capacitor Preferences plugin fallback for native mobile
      const preferencesPlugin = (window as any).Capacitor?.Plugins?.Preferences;
      if (preferencesPlugin?.set) {
        preferencesPlugin.set({ key: STORAGE_KEY, value: jsonStr }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to save local home choices:', err);
    }
  },

  /**
   * Pluggable backend sync method.
   * Checks authentication before sending to prevent 401 spam.
   * Fetches latest user cohort configs from /api/user/cohort-config and aligns local cache.
   */
  async syncWithBackend(isAuthenticated = true): Promise<StoredHomeChoices | null> {
    if (typeof window === 'undefined') return null;
    if (!isAuthenticated) {
      // Unauthenticated users rely purely on offline local storage without console 401s
      return this.getStoredChoices();
    }

    try {
      const res = await fetch('/api/user/cohort-config');
      if (res.status === 401) {
        // Session expired or unauthenticated; return local choices quietly
        return this.getStoredChoices();
      }

      if (res.ok) {
        const remoteConfigs = await res.json();
        if (Array.isArray(remoteConfigs) && remoteConfigs.length > 0) {
          const current = this.getStoredChoices();
          const currentActive = current?.activeCohorts ? [...current.activeCohorts] : [];
          const currentPaused = current?.continueLater ? [...current.continueLater] : [];

          const remoteMap = new Map<string, any>(
            remoteConfigs.map((cfg: any) => [cfg.cohortId, cfg])
          );

          const updatedActive: ActiveCohort[] = [];
          const updatedPaused: PausedCohort[] = [];

          // Process current active cohorts with remote overrides
          for (const cohort of currentActive) {
            const cleanId = cohort.cohortId || cohort.id;
            const remote = remoteMap.get(cleanId);
            if (remote) {
              remoteMap.delete(cleanId);
              if (remote.isPaused) {
                updatedPaused.push({
                  ...cohort,
                  pausedUntil: remote.pausedUntil || new Date().toISOString(),
                  pausedReason: remote.pausedReason || '',
                  resumeLabel: 'Paused',
                });
              } else {
                updatedActive.push({
                  ...cohort,
                  rank: typeof remote.rank === 'number' ? remote.rank : cohort.rank,
                  dailyGoalMinutes: typeof remote.dailyGoalMinutes === 'number' ? remote.dailyGoalMinutes : cohort.dailyGoalMinutes,
                  schedule: {
                    days: Array.isArray(remote.scheduleDays) ? remote.scheduleDays : cohort.schedule?.days || ['Mon', 'Wed', 'Fri'],
                    label: remote.scheduleLabel || cohort.schedule?.label || 'Mon, Wed, Fri',
                  },
                  frequency: remote.frequency || cohort.frequency,
                  orderStyle: remote.orderStyle || cohort.orderStyle,
                });
              }
            } else {
              updatedActive.push(cohort);
            }
          }

          // Process current paused cohorts with remote overrides
          for (const cohort of currentPaused) {
            const cleanId = cohort.cohortId || cohort.id;
            const remote = remoteMap.get(cleanId);
            if (remote) {
              remoteMap.delete(cleanId);
              if (!remote.isPaused) {
                updatedActive.push({
                  id: cohort.id,
                  cohortId: cleanId,
                  rank: typeof remote.rank === 'number' ? remote.rank : 999,
                  title: cohort.title,
                  provider: cohort.provider,
                  thumbnail: cohort.thumbnail,
                  minutesToday: cohort.minutesToday,
                  dailyGoalMinutes: typeof remote.dailyGoalMinutes === 'number' ? remote.dailyGoalMinutes : cohort.dailyGoalMinutes,
                  progressPercent: cohort.progressPercent,
                  schedule: {
                    days: Array.isArray(remote.scheduleDays) ? remote.scheduleDays : cohort.schedule?.days || ['Mon', 'Wed', 'Fri'],
                    label: remote.scheduleLabel || cohort.schedule?.label || 'Mon, Wed, Fri',
                  },
                  frequency: remote.frequency || cohort.frequency,
                  orderStyle: remote.orderStyle || cohort.orderStyle,
                });
              } else {
                updatedPaused.push({
                  ...cohort,
                  pausedUntil: remote.pausedUntil || cohort.pausedUntil,
                  pausedReason: remote.pausedReason ?? cohort.pausedReason,
                });
              }
            } else {
              updatedPaused.push(cohort);
            }
          }

          // Sort active cohorts by rank
          updatedActive.sort((a, b) => (a.rank || 0) - (b.rank || 0));

          if (updatedActive.length > 0 || updatedPaused.length > 0) {
            this.saveChoices(updatedActive, updatedPaused);
            return {
              activeCohorts: updatedActive,
              continueLater: updatedPaused,
              updatedAt: new Date().toISOString(),
            };
          }
        }
      }
    } catch (err) {
      console.warn('Backend cohort config sync unavailable, using local choices:', err);
    }

    return this.getStoredChoices();
  },

  /**
   * Fetch and align channel configuration with backend database.
   */
  async syncChannelWithBackend(isAuthenticated = true): Promise<{
    activeChannel: ChannelId;
    prefs: ChannelPreferences;
  } | null> {
    if (typeof window === 'undefined') return null;
    if (!isAuthenticated) {
      return {
        activeChannel: this.getSelectedChannel(),
        prefs: this.getChannelPreferences(),
      };
    }

    try {
      const res = await fetch('/api/user/channel-config');
      if (res.status === 401) {
        return {
          activeChannel: this.getSelectedChannel(),
          prefs: this.getChannelPreferences(),
        };
      }

      if (res.ok) {
        const data = await res.json();
        if (data.activeChannel && VALID_CHANNEL_IDS.includes(data.activeChannel)) {
          this.saveSelectedChannel(data.activeChannel);
        }

        if (data.prefs && typeof data.prefs === 'object') {
          const partial: Partial<ChannelPreferences> = {};
          if (data.prefs.depth) partial.depth = parseFloat(data.prefs.depth);
          if (data.prefs.rigor) partial.rigor = parseFloat(data.prefs.rigor);
          if (data.prefs.scaffolding) partial.scaffolding = parseFloat(data.prefs.scaffolding);
          if (data.prefs.weekly_goal) partial.weeklyGoal = data.prefs.weekly_goal;
          if (data.prefs.learning_allocation) partial.learningAllocation = data.prefs.learning_allocation;
          if (data.prefs.reminder_window) partial.reminderWindow = data.prefs.reminder_window;
          this.saveChannelPreferences(partial);
        }

        return {
          activeChannel: this.getSelectedChannel(),
          prefs: this.getChannelPreferences(),
        };
      }
    } catch (err) {
      console.warn('Backend channel config sync unavailable, using local choices:', err);
    }

    return {
      activeChannel: this.getSelectedChannel(),
      prefs: this.getChannelPreferences(),
    };
  },

  savePausedOpen(isOpen: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PAUSED_OPEN_KEY, isOpen ? '1' : '0');
    } catch {}
  },

  getStoredPausedOpen(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(PAUSED_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  },

  saveCompletedOpen(isOpen: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(COMPLETED_OPEN_KEY, isOpen ? '1' : '0');
    } catch {}
  },

  getStoredCompletedOpen(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(COMPLETED_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  },

  saveSearchQuery(query: string): void {
    if (typeof window === 'undefined') return;
    try {
      if (query.trim()) {
        localStorage.setItem(SEARCH_QUERY_KEY, query.trim());
      } else {
        localStorage.removeItem(SEARCH_QUERY_KEY);
      }
    } catch {}
  },

  getStoredSearchQuery(): string {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(SEARCH_QUERY_KEY) || '';
    } catch {
      return '';
    }
  },

  getSelectedChannel(): ChannelId {
    if (typeof window === 'undefined') return 'spark';
    try {
      const saved = localStorage.getItem(CHANNEL_KEY) as ChannelId;
      if (saved && VALID_CHANNEL_IDS.includes(saved)) {
        return saved;
      }
      return 'spark';
    } catch {
      return 'spark';
    }
  },

  saveSelectedChannel(channel: ChannelId): void {
    if (typeof window === 'undefined') return;
    try {
      if (VALID_CHANNEL_IDS.includes(channel)) {
        localStorage.setItem(CHANNEL_KEY, channel);
      }
    } catch {}
  },

  getChannelHubExpanded(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(FINETUNE_EXPANDED_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  },

  saveChannelHubExpanded(isExpanded: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(FINETUNE_EXPANDED_KEY, String(isExpanded));
    } catch {}
  },

  getChannelPreferences(): ChannelPreferences {
    const prefs: ChannelPreferences = { ...DEFAULT_CHANNEL_PREFERENCES };
    if (typeof window === 'undefined') return prefs;

    try {
      // 1. Try reading composite channel prefs JSON
      const compositeRaw = localStorage.getItem(CHANNEL_PREFS_KEY);
      if (compositeRaw) {
        try {
          const parsed = JSON.parse(compositeRaw);
          if (parsed && typeof parsed === 'object') {
            if (parsed.depth !== undefined && !isNaN(parseFloat(parsed.depth))) {
              let d = parseFloat(parsed.depth);
              if (d > 1) d = d / 5;
              prefs.depth = Math.max(0, Math.min(1, d));
            }
            if (parsed.rigor !== undefined && !isNaN(parseFloat(parsed.rigor))) {
              let r = parseFloat(parsed.rigor);
              if (r > 1) r = r / 5;
              prefs.rigor = Math.max(0, Math.min(1, r));
            }
            if (parsed.scaffolding !== undefined && !isNaN(parseFloat(parsed.scaffolding))) {
              let s = parseFloat(parsed.scaffolding);
              if (s > 1) s = s / 5;
              prefs.scaffolding = Math.max(0, Math.min(1, s));
            }
            if (typeof parsed.weekly_goal === 'string' && parsed.weekly_goal.trim()) {
              prefs.weeklyGoal = parsed.weekly_goal.trim();
            }
            if (typeof parsed.learning_allocation === 'string' && parsed.learning_allocation.trim()) {
              prefs.learningAllocation = parsed.learning_allocation.trim();
            }
            if (typeof parsed.reminder_window === 'string' && parsed.reminder_window.trim()) {
              prefs.reminderWindow = parsed.reminder_window.trim();
            }
          }
        } catch {}
      }

      // 2. Individual key overrides (matching legacy / external writers)
      const rawDepth = localStorage.getItem(PREF_DEPTH_KEY);
      if (rawDepth) {
        let val = parseFloat(rawDepth);
        if (!isNaN(val)) {
          if (val > 1) val = val / 5;
          prefs.depth = Math.max(0, Math.min(1, val));
        }
      }

      const rawRigor = localStorage.getItem(PREF_RIGOR_KEY);
      if (rawRigor) {
        let val = parseFloat(rawRigor);
        if (!isNaN(val)) {
          if (val > 1) val = val / 5;
          prefs.rigor = Math.max(0, Math.min(1, val));
        }
      }

      const rawScaffolding = localStorage.getItem(PREF_SCAFFOLDING_KEY);
      if (rawScaffolding) {
        let val = parseFloat(rawScaffolding);
        if (!isNaN(val)) {
          if (val > 1) val = val / 5;
          prefs.scaffolding = Math.max(0, Math.min(1, val));
        }
      }

      const rawWeeklyGoal = localStorage.getItem(PREF_WEEKLY_GOAL_KEY);
      if (rawWeeklyGoal && rawWeeklyGoal.trim()) {
        prefs.weeklyGoal = rawWeeklyGoal.trim();
      }

      const rawAllocation = localStorage.getItem(PREF_LEARNING_ALLOCATION_KEY);
      if (rawAllocation && rawAllocation.trim()) {
        prefs.learningAllocation = rawAllocation.trim();
      }

      const rawReminder = localStorage.getItem(PREF_REMINDER_WINDOW_KEY);
      if (rawReminder && rawReminder.trim()) {
        prefs.reminderWindow = rawReminder.trim();
      }
    } catch (err) {
      console.warn('Failed to load local channel preferences:', err);
    }

    return prefs;
  },

  getChannelParam(channelId: ChannelId, paramId: string, defaultValue = 0.5): number {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const key = `${channelId}_${paramId}`;
      const compositeRaw = localStorage.getItem(CHANNEL_PREFS_KEY);
      if (compositeRaw) {
        const parsed = JSON.parse(compositeRaw);
        if (parsed && parsed[key] !== undefined) {
          let val = parseFloat(parsed[key]);
          if (!isNaN(val)) {
            if (val > 1) val = val / 5;
            return Math.max(0, Math.min(1, val));
          }
        }
      }
      const direct = localStorage.getItem(`sidequest_pref_${key}`);
      if (direct) {
        let val = parseFloat(direct);
        if (!isNaN(val)) {
          if (val > 1) val = val / 5;
          return Math.max(0, Math.min(1, val));
        }
      }
    } catch {}
    return defaultValue;
  },

  saveChannelParam(channelId: ChannelId, paramId: string, value: number): void {
    if (typeof window === 'undefined') return;
    try {
      const clamped = Math.max(0, Math.min(1, value));
      const key = `${channelId}_${paramId}`;
      let composite: Record<string, string> = {};
      const compositeRaw = localStorage.getItem(CHANNEL_PREFS_KEY);
      if (compositeRaw) {
        try {
          composite = JSON.parse(compositeRaw) || {};
        } catch {}
      }
      composite[key] = clamped.toFixed(2);
      localStorage.setItem(CHANNEL_PREFS_KEY, JSON.stringify(composite));
      localStorage.setItem(`sidequest_pref_${key}`, clamped.toFixed(2));
    } catch {}
  },

  getAllChannelPrefs(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    try {
      const compositeRaw = localStorage.getItem(CHANNEL_PREFS_KEY);
      if (compositeRaw) {
        return JSON.parse(compositeRaw) || {};
      }
    } catch {}
    return {};
  },

  saveChannelPreferences(partial: Partial<ChannelPreferences>): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getChannelPreferences();
      const updated: ChannelPreferences = {
        ...current,
        ...partial,
      };

      // Write composite JSON
      const compositeMap: Record<string, string> = {
        depth: updated.depth.toFixed(2),
        rigor: updated.rigor.toFixed(2),
        scaffolding: updated.scaffolding.toFixed(2),
        weekly_goal: updated.weeklyGoal,
        learning_allocation: updated.learningAllocation,
        reminder_window: updated.reminderWindow,
      };
      localStorage.setItem(CHANNEL_PREFS_KEY, JSON.stringify(compositeMap));

      // Write individual keys for cross-component compatibility
      localStorage.setItem(PREF_DEPTH_KEY, updated.depth.toFixed(2));
      localStorage.setItem(PREF_RIGOR_KEY, updated.rigor.toFixed(2));
      localStorage.setItem(PREF_SCAFFOLDING_KEY, updated.scaffolding.toFixed(2));
      localStorage.setItem(PREF_WEEKLY_GOAL_KEY, updated.weeklyGoal);
      localStorage.setItem(PREF_LEARNING_ALLOCATION_KEY, updated.learningAllocation);
      localStorage.setItem(PREF_REMINDER_WINDOW_KEY, updated.reminderWindow);

      // Capacitor Preferences fallback
      const preferencesPlugin = (window as any).Capacitor?.Plugins?.Preferences;
      if (preferencesPlugin?.set) {
        preferencesPlugin
          .set({ key: CHANNEL_PREFS_KEY, value: JSON.stringify(compositeMap) })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Failed to save channel preferences locally:', err);
    }
  },
};

