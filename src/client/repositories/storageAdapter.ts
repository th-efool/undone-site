import type { Cohort } from '@/src/client/screens/cohort/models';

const STORAGE_KEY = 'sidequest_published_cohorts';

export const storageAdapter = {
  getStoredCohorts(): Cohort[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Cohort[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveStoredCohorts(cohorts: Cohort[]): void {
    if (typeof window === 'undefined') return;
    try {
      const jsonStr = JSON.stringify(cohorts);
      localStorage.setItem(STORAGE_KEY, jsonStr);

      // Sync to Capacitor Preferences plugin if available natively
      const preferencesPlugin = (window as any).Capacitor?.Plugins?.Preferences;
      if (preferencesPlugin?.set) {
        preferencesPlugin.set({ key: STORAGE_KEY, value: jsonStr }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to persist cohorts to storage:', err);
    }
  },

  async syncFromCapacitorPreferences(): Promise<Cohort[]> {
    if (typeof window === 'undefined') return [];
    try {
      const preferencesPlugin = (window as any).Capacitor?.Plugins?.Preferences;
      if (preferencesPlugin?.get) {
        const res = await preferencesPlugin.get({ key: STORAGE_KEY });
        if (res?.value) {
          const parsed = JSON.parse(res.value) as Cohort[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorage.setItem(STORAGE_KEY, res.value);
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn('Capacitor Preferences sync fallback:', err);
    }
    return this.getStoredCohorts();
  },
};
