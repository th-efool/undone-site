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
   * Acts as a pass-through for now, ready for future backend API integration.
   * e.g., fetch('/api/user/home-choices') -> merge with local cache -> saveChoices
   */
  async syncWithBackend(): Promise<StoredHomeChoices | null> {
    // Modular backend hook placeholder:
    // When backend endpoint is ready, uncomment & configure:
    // try {
    //   const res = await fetch('/api/user/home-choices');
    //   if (res.ok) {
    //     const remoteData = await res.json();
    //     this.saveChoices(remoteData.activeCohorts, remoteData.continueLater);
    //     return remoteData;
    //   }
    // } catch (err) {
    //   console.warn('Backend sync unavailable, using local choices:', err);
    // }

    return this.getStoredChoices();
  },
};
