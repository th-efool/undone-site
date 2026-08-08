/**
 * Route Theme Configuration
 *
 * Configurable route themes ('dark' | 'light').
 * Change the theme of any route by updating the single variable value below!
 *
 * Example:
 *   '/explore': 'dark'  -> Renders /explore in OLED dark mode (page + sidebar)
 *   '/explore': 'light' -> Renders /explore in light mode (page + sidebar)
 *   '/message': 'dark'  -> Renders /message in dark mode (page + sidebar)
 *   '/message': 'light' -> Renders /message in light mode (page + sidebar)
 */

export type ThemeMode = 'dark' | 'light';

export const ROUTE_THEME_CONFIG: Record<string, ThemeMode> = {
  '/explore': 'dark',
  '/message': 'dark',
  '/notes': 'dark',
};

export function getRouteTheme(pathname: string | null): ThemeMode {
  if (!pathname) return 'light';

  for (const [route, theme] of Object.entries(ROUTE_THEME_CONFIG)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return theme;
    }
  }

  return 'light';
}
