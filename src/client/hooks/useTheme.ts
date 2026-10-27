'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  type ThemeMode,
  THEME_STORAGE_KEY,
  THEME_CHANGE_EVENT,
  resolveEffectiveTheme,
  applyThemeToDocument,
  getRoutePolicy,
} from '@/src/client/config/routeThemeConfig';

export type Theme = ThemeMode;

function useSafePathname(): string | null {
  try {
    return usePathname();
  } catch {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return null;
  }
}

export function useTheme() {
  const pathname = useSafePathname();
  const [theme, setThemeState] = useState<Theme>(() => resolveEffectiveTheme(pathname));
  const [mounted, setMounted] = useState(false);

  // Sync theme when pathname changes or on mount
  useEffect(() => {
    setMounted(true);
    const effective = resolveEffectiveTheme(pathname);
    setThemeState(effective);
    applyThemeToDocument(effective);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<Theme>;
      if (customEvent.detail) {
        // If current route has a forced policy, route policy always wins
        const routePolicy = getRoutePolicy(pathname);
        const resolved = routePolicy || customEvent.detail;
        setThemeState(resolved);
        applyThemeToDocument(resolved);
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, [pathname]);

  const setTheme = useCallback((newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: newTheme }));
    } catch {
      // Ignore
    }

    const routePolicy = getRoutePolicy(pathname);
    const effective = routePolicy || newTheme;
    setThemeState(effective);
    applyThemeToDocument(effective);
  }, [pathname]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
    mounted,
  };
}
