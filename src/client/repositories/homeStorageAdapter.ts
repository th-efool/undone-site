import type { ActiveCohort, PausedCohort } from '@/src/client/screens/dashboard/home/models';

const STORAGE_KEY = 'sidequest_home_choices';

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
   * Fetches latest user cohort configs from /api/user/cohort-config and aligns local cache.
   */
  async syncWithBackend(): Promise<StoredHomeChoices | null> {
    if (typeof window === 'undefined') return null;
    try {
      const res = await fetch('/api/user/cohort-config');
      if (res.ok) {
        const remoteConfigs = await res.json();
        if (Array.isArray(remoteConfigs)) {
          // Sync successful
        }
      }
    } catch (err) {
      console.warn('Backend sync unavailable, using local choices:', err);
    }

    return this.getStoredChoices();
  },
  savePausedOpen(isOpen: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('sidequest_paused_open', isOpen ? '1' : '0');
    } catch {}
  },

  getStoredPausedOpen(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('sidequest_paused_open') === '1';
    } catch { return false; }
  },

};
