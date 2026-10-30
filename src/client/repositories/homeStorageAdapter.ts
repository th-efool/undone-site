import type { ActiveCohort, PausedCohort, Weekday } from '@/src/client/screens/dashboard/home/models';
import {
  type ChannelId,
  type ChannelPreferences,
  type StoredChannelConfig,
  VALID_CHANNEL_IDS,
  DEFAULT_CHANNEL_PREFERENCES,
  CHANNEL_CONFIG_STORAGE_PREFIX,
  validatePrefEntry,
} from '@/src/shared/feed/channelPreferences';

export type { ChannelId, ChannelPreferences, StoredChannelConfig };
export { VALID_CHANNEL_IDS, DEFAULT_CHANNEL_PREFERENCES };

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type SaveListener = (status: SaveStatus) => void;

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

let lastCohortSyncAt = 0;
const SYNC_TTL_MS = 30_000;

function getStorageKey(userId?: string | null): string {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

function getChannelConfigKey(userId?: string | null): string {
  return `${CHANNEL_CONFIG_STORAGE_PREFIX}${userId || 'anon'}`;
}

function getDefaultChannelConfig(): StoredChannelConfig {
  return {
    version: 2,
    activeChannel: 'default',
    prefs: {
      depth: DEFAULT_CHANNEL_PREFERENCES.depth.toFixed(2),
      rigor: DEFAULT_CHANNEL_PREFERENCES.rigor.toFixed(2),
      scaffolding: DEFAULT_CHANNEL_PREFERENCES.scaffolding.toFixed(2),
      weekly_goal: DEFAULT_CHANNEL_PREFERENCES.weeklyGoal,
      learning_allocation: DEFAULT_CHANNEL_PREFERENCES.learningAllocation,
      reminder_window: DEFAULT_CHANNEL_PREFERENCES.reminderWindow,
    },
    dirty: false,
    updatedAt: new Date().toISOString(),
  };
}

interface UserSaveCoordinator {
  timer: NodeJS.Timeout | null;
  inFlight: boolean;
  pendingSnapshot: { activeChannel: ChannelId; prefs: Record<string, string> } | null;
  status: SaveStatus;
  listeners: Set<SaveListener>;
}

const userCoordinators = new Map<string, UserSaveCoordinator>();

function getCoordinator(userIdKey: string): UserSaveCoordinator {
  let coord = userCoordinators.get(userIdKey);
  if (!coord) {
    coord = {
      timer: null,
      inFlight: false,
      pendingSnapshot: null,
      status: 'idle',
      listeners: new Set(),
    };
    userCoordinators.set(userIdKey, coord);
  }
  return coord;
}

function notifySaveStatus(coord: UserSaveCoordinator, status: SaveStatus) {
  coord.status = status;
  for (const listener of coord.listeners) {
    try {
      listener(status);
    } catch {}
  }
}

async function executeSave(userId: string) {
  const coord = getCoordinator(userId);
  if (coord.inFlight) return;
  if (!coord.pendingSnapshot) return;

  const snapshotToSave = coord.pendingSnapshot;
  coord.pendingSnapshot = null;
  coord.inFlight = true;
  notifySaveStatus(coord, 'saving');

  try {
    const res = await fetch('/api/user/channel-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshotToSave),
    });

    if (res.ok) {
      if (!coord.pendingSnapshot) {
        // Successfully saved latest snapshot
        const currentDoc = homeStorageAdapter.getStoredChannelConfig(userId);
        if (currentDoc) {
          currentDoc.dirty = false;
          homeStorageAdapter.saveStoredChannelConfig(currentDoc, userId);
        }
        notifySaveStatus(coord, 'saved');
      } else {
        // Newer changes queued while in-flight
        coord.inFlight = false;
        void executeSave(userId);
        return;
      }
    } else {
      notifySaveStatus(coord, 'error');
    }
  } catch {
    notifySaveStatus(coord, 'error');
  } finally {
    coord.inFlight = false;
  }
}

function scheduleSave(userId?: string | null) {
  if (!userId) return; // Anonymous changes are offline-only
  const coord = getCoordinator(userId);
  const currentDoc = homeStorageAdapter.getStoredChannelConfig(userId);
  coord.pendingSnapshot = {
    activeChannel: currentDoc.activeChannel,
    prefs: { ...currentDoc.prefs },
  };

  if (coord.timer) {
    clearTimeout(coord.timer);
  }

  coord.timer = setTimeout(() => {
    coord.timer = null;
    void executeSave(userId);
  }, 500);
}

export const homeStorageAdapter = {
  getStoredChoices(userId?: string | null): StoredHomeChoices | null {
    if (typeof window === 'undefined') return null;
    try {
      const key = getStorageKey(userId);
      const raw = localStorage.getItem(key) || (!userId ? localStorage.getItem(STORAGE_KEY) : null);
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

  saveChoices(activeCohorts: ActiveCohort[], continueLater: PausedCohort[], userId?: string | null): void {
    if (typeof window === 'undefined') return;
    try {
      const payload: StoredHomeChoices = {
        activeCohorts,
        continueLater,
        updatedAt: new Date().toISOString(),
      };
      const jsonStr = JSON.stringify(payload);
      const key = getStorageKey(userId);
      localStorage.setItem(key, jsonStr);

      const preferencesPlugin = (window as unknown as {
        Capacitor?: { Plugins?: { Preferences?: { set: (opts: { key: string; value: string }) => Promise<void> } } };
      }).Capacitor?.Plugins?.Preferences;
      if (preferencesPlugin?.set) {
        preferencesPlugin.set({ key, value: jsonStr }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to save local home choices:', err);
    }
  },

  clearUserChoices(userId?: string | null): void {
    if (typeof window === 'undefined') return;
    try {
      if (userId) {
        const coord = userCoordinators.get(userId);
        if (coord) {
          if (coord.timer) clearTimeout(coord.timer);
          coord.pendingSnapshot = null;
          coord.listeners.clear();
          userCoordinators.delete(userId);
        }
        localStorage.removeItem(getStorageKey(userId));
        localStorage.removeItem(getChannelConfigKey(userId));
      }
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(getChannelConfigKey(null));
    } catch {}
  },

  async syncWithBackend(isAuthenticated = true, userId?: string | null): Promise<StoredHomeChoices | null> {
    if (typeof window === 'undefined') return null;
    if (!isAuthenticated) {
      return this.getStoredChoices(userId);
    }

    if (process.env.NODE_ENV !== 'test' && Date.now() - lastCohortSyncAt < SYNC_TTL_MS) {
      const cached = this.getStoredChoices(userId);
      if (cached) return cached;
    }

    try {
      const res = await fetch('/api/user/cohort-config');
      lastCohortSyncAt = Date.now();
      if (res.status === 401) {
        return this.getStoredChoices(userId);
      }

      if (res.ok) {
        const remoteConfigs = await res.json();
        if (Array.isArray(remoteConfigs) && remoteConfigs.length > 0) {
          const current = this.getStoredChoices(userId);
          const currentActive = current?.activeCohorts ? [...current.activeCohorts] : [];
          const currentPaused = current?.continueLater ? [...current.continueLater] : [];

          type RemoteCohortConfig = {
            cohortId?: string;
            rank?: number;
            isHidden?: boolean;
            isPaused?: boolean;
            pausedUntil?: string | null;
            pausedReason?: string | null;
            dailyGoalMinutes?: number;
            scheduleDays?: string[];
            scheduleLabel?: string;
            frequency?: string;
            orderStyle?: string;
          };
          const remoteMap = new Map<string, RemoteCohortConfig>(
            (remoteConfigs as RemoteCohortConfig[]).map((cfg) => [cfg.cohortId || '', cfg])
          );

          const updatedActive: ActiveCohort[] = [];
          const updatedPaused: PausedCohort[] = [];

          for (const cohort of currentActive) {
            const cleanId = cohort.cohortId || cohort.id;
            const remote = remoteMap.get(cleanId);
            if (remote?.isHidden) continue;
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
                    days: (Array.isArray(remote.scheduleDays) ? remote.scheduleDays : cohort.schedule?.days || ['Mon', 'Wed', 'Fri']) as Weekday[],
                    label: remote.scheduleLabel || cohort.schedule?.label || 'Mon, Wed, Fri',
                  },
                  frequency: (remote.frequency || cohort.frequency) as ActiveCohort['frequency'],
                  orderStyle: (remote.orderStyle || cohort.orderStyle) as ActiveCohort['orderStyle'],
                });
              }
            } else {
              updatedActive.push(cohort);
            }
          }

          for (const cohort of currentPaused) {
            const cleanId = cohort.cohortId || cohort.id;
            const remote = remoteMap.get(cleanId);
            if (remote?.isHidden) continue;
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
                    days: (Array.isArray(remote.scheduleDays) ? remote.scheduleDays : cohort.schedule?.days || ['Mon', 'Wed', 'Fri']) as Weekday[],
                    label: remote.scheduleLabel || cohort.schedule?.label || 'Mon, Wed, Fri',
                  },
                  frequency: (remote.frequency || cohort.frequency) as ActiveCohort['frequency'],
                  orderStyle: (remote.orderStyle || cohort.orderStyle) as ActiveCohort['orderStyle'],
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

          updatedActive.sort((a, b) => (a.rank || 0) - (b.rank || 0));

          this.saveChoices(updatedActive, updatedPaused, userId);
          return {
            activeCohorts: updatedActive,
            continueLater: updatedPaused,
            updatedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn('Backend cohort config sync unavailable, using local choices:', err);
    }

    return this.getStoredChoices(userId);
  },

  getStoredChannelConfig(userId?: string | null): StoredChannelConfig {
    if (typeof window === 'undefined') return getDefaultChannelConfig();
    const key = getChannelConfigKey(userId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 2 && typeof parsed.prefs === 'object') {
          return {
            version: 2,
            activeChannel: VALID_CHANNEL_IDS.includes(parsed.activeChannel)
              ? parsed.activeChannel
              : 'default',
            prefs: parsed.prefs,
            dirty: Boolean(parsed.dirty),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
        }
      }

      // If anonymous and no v2 document yet, import legacy keys once
      if (!userId) {
        const legacyActive = (localStorage.getItem(CHANNEL_KEY) as ChannelId) || 'default';
        const legacyPrefsRaw = localStorage.getItem(CHANNEL_PREFS_KEY);
        const importedPrefs: Record<string, string> = {
          ...getDefaultChannelConfig().prefs,
        };

        if (legacyPrefsRaw) {
          try {
            const p = JSON.parse(legacyPrefsRaw);
            if (p && typeof p === 'object') {
              for (const [k, v] of Object.entries(p)) {
                const valRes = validatePrefEntry(k, v);
                if (valRes.valid && valRes.normalizedKey && valRes.normalizedVal) {
                  importedPrefs[valRes.normalizedKey] = valRes.normalizedVal;
                }
              }
            }
          } catch {}
        }

        const legacyKeys = [
          ['depth', PREF_DEPTH_KEY],
          ['rigor', PREF_RIGOR_KEY],
          ['scaffolding', PREF_SCAFFOLDING_KEY],
          ['weekly_goal', PREF_WEEKLY_GOAL_KEY],
          ['learning_allocation', PREF_LEARNING_ALLOCATION_KEY],
          ['reminder_window', PREF_REMINDER_WINDOW_KEY],
        ] as const;

        for (const [field, lk] of legacyKeys) {
          const lval = localStorage.getItem(lk);
          if (lval) {
            const valRes = validatePrefEntry(field, lval);
            if (valRes.valid && valRes.normalizedKey && valRes.normalizedVal) {
              importedPrefs[valRes.normalizedKey] = valRes.normalizedVal;
            }
          }
        }

        const importedDoc: StoredChannelConfig = {
          version: 2,
          activeChannel: VALID_CHANNEL_IDS.includes(legacyActive) ? legacyActive : 'spark',
          prefs: importedPrefs,
          dirty: false,
          updatedAt: new Date().toISOString(),
        };

        localStorage.setItem(key, JSON.stringify(importedDoc));

        // Clean up legacy keys after successful write
        for (const [, lk] of legacyKeys) {
          localStorage.removeItem(lk);
        }

        return importedDoc;
      }
    } catch {}

    const fresh = getDefaultChannelConfig();
    try {
      localStorage.setItem(key, JSON.stringify(fresh));
    } catch {}
    return fresh;
  },

  saveStoredChannelConfig(config: StoredChannelConfig, userId?: string | null): void {
    if (typeof window === 'undefined') return;
    const key = getChannelConfigKey(userId);
    try {
      localStorage.setItem(key, JSON.stringify(config));
      // Only mirror to legacy keys for unauthenticated sessions to avoid cross-user state leaks
      if (!userId) {
        localStorage.setItem(CHANNEL_KEY, config.activeChannel);
        localStorage.setItem(CHANNEL_PREFS_KEY, JSON.stringify(config.prefs));
      }
    } catch {}
  },

  getSelectedChannel(userId?: string | null): ChannelId {
    return this.getStoredChannelConfig(userId).activeChannel;
  },

  saveSelectedChannel(channel: ChannelId, userId?: string | null): void {
    if (!VALID_CHANNEL_IDS.includes(channel)) return;
    const config = this.getStoredChannelConfig(userId);
    config.activeChannel = channel;
    config.dirty = true;
    config.updatedAt = new Date().toISOString();
    this.saveStoredChannelConfig(config, userId);
    scheduleSave(userId);
  },

  getChannelPreferences(userId?: string | null): ChannelPreferences {
    const config = this.getStoredChannelConfig(userId);
    const p = config.prefs;

    const parseNum = (val: string | undefined, def: number) => {
      const n = parseFloat(val ?? '');
      return Number.isFinite(n) && n >= 0 && n <= 1 ? n : def;
    };

    return {
      depth: parseNum(p.depth, DEFAULT_CHANNEL_PREFERENCES.depth),
      rigor: parseNum(p.rigor, DEFAULT_CHANNEL_PREFERENCES.rigor),
      scaffolding: parseNum(p.scaffolding, DEFAULT_CHANNEL_PREFERENCES.scaffolding),
      weeklyGoal: p.weekly_goal || DEFAULT_CHANNEL_PREFERENCES.weeklyGoal,
      learningAllocation: p.learning_allocation || DEFAULT_CHANNEL_PREFERENCES.learningAllocation,
      reminderWindow: p.reminder_window || DEFAULT_CHANNEL_PREFERENCES.reminderWindow,
    };
  },

  saveChannelPreferences(partial: Partial<ChannelPreferences>, userId?: string | null): void {
    const config = this.getStoredChannelConfig(userId);
    const nextPrefs = { ...config.prefs };

    if (partial.depth !== undefined && Number.isFinite(partial.depth)) {
      nextPrefs.depth = Math.max(0, Math.min(1, partial.depth)).toFixed(2);
    }
    if (partial.rigor !== undefined && Number.isFinite(partial.rigor)) {
      nextPrefs.rigor = Math.max(0, Math.min(1, partial.rigor)).toFixed(2);
    }
    if (partial.scaffolding !== undefined && Number.isFinite(partial.scaffolding)) {
      nextPrefs.scaffolding = Math.max(0, Math.min(1, partial.scaffolding)).toFixed(2);
    }
    if (partial.weeklyGoal && typeof partial.weeklyGoal === 'string') {
      nextPrefs.weekly_goal = partial.weeklyGoal.trim();
    }
    if (partial.learningAllocation && typeof partial.learningAllocation === 'string') {
      nextPrefs.learning_allocation = partial.learningAllocation.trim();
    }
    if (partial.reminderWindow && typeof partial.reminderWindow === 'string') {
      nextPrefs.reminder_window = partial.reminderWindow.trim();
    }

    config.prefs = nextPrefs;
    config.dirty = true;
    config.updatedAt = new Date().toISOString();
    this.saveStoredChannelConfig(config, userId);
    scheduleSave(userId);
  },

  getChannelParam(
    channelId: ChannelId,
    paramId: string,
    defaultValue = 0.5,
    userId?: string | null
  ): number {
    const config = this.getStoredChannelConfig(userId);
    const key = `${channelId}_${paramId}`;
    const raw = config.prefs[key];
    if (raw !== undefined) {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
    }
    return defaultValue;
  },

  saveChannelParam(
    channelId: ChannelId,
    paramId: string,
    value: number,
    userId?: string | null
  ): void {
    const clamped = Math.max(0, Math.min(1, value));
    const key = `${channelId}_${paramId}`;
    const config = this.getStoredChannelConfig(userId);
    config.prefs[key] = clamped.toFixed(2);
    config.dirty = true;
    config.updatedAt = new Date().toISOString();
    this.saveStoredChannelConfig(config, userId);
    scheduleSave(userId);
  },

  getAllChannelPrefs(userId?: string | null): Record<string, string> {
    return { ...this.getStoredChannelConfig(userId).prefs };
  },

  subscribeToSaveStatus(userId: string | null | undefined, listener: SaveListener): () => void {
    const key = userId || 'anon';
    const coord = getCoordinator(key);
    coord.listeners.add(listener);
    listener(coord.status);
    return () => {
      coord.listeners.delete(listener);
    };
  },

  getSaveStatus(userId?: string | null): SaveStatus {
    const key = userId || 'anon';
    return getCoordinator(key).status;
  },

  flushPendingSave(userId?: string | null): void {
    if (!userId || typeof window === 'undefined') return;
    const coord = getCoordinator(userId);
    const currentDoc = this.getStoredChannelConfig(userId);
    if (!currentDoc.dirty && !coord.pendingSnapshot) return;

    if (coord.timer) {
      clearTimeout(coord.timer);
      coord.timer = null;
    }

    const snapshot = coord.pendingSnapshot || {
      activeChannel: currentDoc.activeChannel,
      prefs: currentDoc.prefs,
    };
    coord.pendingSnapshot = null;

    try {
      fetch('/api/user/channel-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
        keepalive: true,
      });
    } catch {}
  },

  retrySave(userId?: string | null): void {
    if (!userId) return;
    const currentDoc = this.getStoredChannelConfig(userId);
    const coord = getCoordinator(userId);
    coord.pendingSnapshot = {
      activeChannel: currentDoc.activeChannel,
      prefs: { ...currentDoc.prefs },
    };
    if (coord.timer) {
      clearTimeout(coord.timer);
      coord.timer = null;
    }
    void executeSave(userId);
  },

  async syncChannelWithBackend(
    userId?: string | null,
    isAuthenticated = true,
    signal?: AbortSignal
  ): Promise<{ activeChannel: ChannelId; prefs: ChannelPreferences } | null> {
    if (typeof window === 'undefined') return null;
    const currentLocal = this.getStoredChannelConfig(userId);

    if (!isAuthenticated || !userId) {
      return {
        activeChannel: currentLocal.activeChannel,
        prefs: this.getChannelPreferences(userId),
      };
    }

    // Preserve dirty local drafts on mount! Do not overwrite.
    if (currentLocal.dirty) {
      scheduleSave(userId);
      return {
        activeChannel: currentLocal.activeChannel,
        prefs: this.getChannelPreferences(userId),
      };
    }

    try {
      const res = await fetch('/api/user/channel-config', { signal });
      if (res.status === 401) {
        return {
          activeChannel: currentLocal.activeChannel,
          prefs: this.getChannelPreferences(userId),
        };
      }

      if (res.ok) {
        const data = await res.json();
        const nextActive =
          data.activeChannel && VALID_CHANNEL_IDS.includes(data.activeChannel)
            ? data.activeChannel
            : currentLocal.activeChannel;

        const nextPrefs: Record<string, string> = { ...currentLocal.prefs };
        if (data.prefs && typeof data.prefs === 'object') {
          for (const [k, v] of Object.entries(data.prefs)) {
            const valRes = validatePrefEntry(k, v);
            if (valRes.valid && valRes.normalizedKey && valRes.normalizedVal) {
              nextPrefs[valRes.normalizedKey] = valRes.normalizedVal;
            }
          }
        }

        const updatedDoc: StoredChannelConfig = {
          version: 2,
          activeChannel: nextActive,
          prefs: nextPrefs,
          dirty: false,
          updatedAt: new Date().toISOString(),
        };

        this.saveStoredChannelConfig(updatedDoc, userId);
        notifySaveStatus(getCoordinator(userId), 'saved');

        return {
          activeChannel: nextActive,
          prefs: this.getChannelPreferences(userId),
        };
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('Backend channel config sync unavailable, using local choices:', err);
      }
    }

    return {
      activeChannel: currentLocal.activeChannel,
      prefs: this.getChannelPreferences(userId),
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
};
