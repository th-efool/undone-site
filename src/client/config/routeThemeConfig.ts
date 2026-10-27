/**
 * Route Theme Configuration & Unified Precedence Resolver (Phase 3)
 *
 * Implements the 3-Tier Precedence Hierarchy from theme-and-cascade-contract.md:
 * 1. Route Theme Policy (ROUTE_THEME_CONFIG) -> Highest Priority
 * 2. User Saved Preference (localStorage: 'undone_theme')
 * 3. System Preference (prefers-color-scheme)
 * 4. Default: 'light'
 */

export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'undone_theme';
export const THEME_CHANGE_EVENT = 'undone-theme-change';

export const ROUTE_THEME_CONFIG: Record<string, ThemeMode> = {
  '/play': 'dark',
  '/explore': 'dark',
  '/message': 'dark',
  '/notes': 'dark',
  '/create-cohort': 'dark',
  '/studyroom': 'dark',
};

/**
 * Returns explicit route policy theme if route is in ROUTE_THEME_CONFIG, or null if unmapped.
 */
export function getRoutePolicy(pathname: string | null): ThemeMode | null {
  if (!pathname) return null;

  for (const [route, theme] of Object.entries(ROUTE_THEME_CONFIG)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return theme;
    }
  }

  return null;
}

/**
 * Backward-compatible helper returning 'dark' for mapped dark routes or 'light' default.
 */
export function getRouteTheme(pathname: string | null): ThemeMode {
  return getRoutePolicy(pathname) || 'light';
}

/**
 * Resolves the effective theme using the authoritative 3-tier precedence contract.
 */
export function resolveEffectiveTheme(pathname: string | null): ThemeMode {
  // Tier 1: Forced Route Policy
  const routePolicy = getRoutePolicy(pathname);
  if (routePolicy) {
    return routePolicy;
  }

  // Client-only resolution for stored and system preferences
  if (typeof window !== 'undefined') {
    try {
      // Tier 2: User Saved Preference
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }

      // Tier 3: System Preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // Ignore if localStorage unavailable
    }
  }

  return 'light';
}

/**
 * Sets data-theme attribute and native colorScheme on document.documentElement (<html>).
 * Ensures body portals and native controls inherit the effective theme.
 */
export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}
