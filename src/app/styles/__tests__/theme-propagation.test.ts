// @vitest-environment jsdom
/**
 * Theme Propagation & Font Loading Consolidation Test Suite (Phase 3)
 *
 * Verifies:
 * 1. Authoritative 3-tier precedence:
 *    Tier 1 (Route Policy) > Tier 2 (Saved Preference) > Tier 3 (System Preference) > Default (Light).
 * 2. Route Policy enforcement:
 *    /notes, /play, /explore, /message, /create-cohort, /studyroom force 'dark' regardless of OS.
 * 3. Document Root (<html>) theme ownership:
 *    applyThemeToDocument sets data-theme and colorScheme on document.documentElement.
 * 4. Portal Theme Inheritance:
 *    Portals mounted to document.body inherit data-theme and CSS custom properties from <html>.
 * 5. Font Loading Consolidation:
 *    - Zero runtime @import url('https://fonts.googleapis.com...') in globals.css.
 *    - Zero redundant local @font-face rules in tokens.css.
 *    - Font tokens reference next/font variables.
 *    - Pre-hydration theme init script present in layout.tsx.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ROUTE_THEME_CONFIG,
  getRoutePolicy,
  getRouteTheme,
  resolveEffectiveTheme,
  applyThemeToDocument,
} from '@/src/client/config/routeThemeConfig';

const rootDir = path.resolve(__dirname, '../../../../');
const globalsCssPath = path.resolve(rootDir, 'src/app/globals.css');
const tokensCssPath = path.resolve(rootDir, 'src/app/styles/tokens.css');
const layoutPath = path.resolve(rootDir, 'src/app/layout.tsx');

describe('Theme Propagation & Font Loading Consolidation (Phase 3)', () => {
  // ─── 1. 3-TIER THEME PRECEDENCE RESOLUTION ─────────────────────────────────

  describe('Section 1: 3-Tier Precedence Resolver', () => {
    let originalLocalStorage: Storage;
    let mockStore: Record<string, string> = {};

    beforeEach(() => {
      mockStore = {};
      originalLocalStorage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: (key: string) => mockStore[key] ?? null,
          setItem: (key: string, value: string) => {
            mockStore[key] = value;
          },
          removeItem: (key: string) => {
            delete mockStore[key];
          },
          clear: () => {
            mockStore = {};
          },
        },
        writable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
      });
    });

    it('Tier 1: Forced dark routes resolve to "dark" even when localStorage is "light"', () => {
      window.localStorage.setItem('undone_theme', 'light');

      const mappedDarkRoutes = ['/notes', '/play', '/explore', '/message', '/create-cohort', '/studyroom'];
      for (const route of mappedDarkRoutes) {
        expect(getRoutePolicy(route)).toBe('dark');
        expect(resolveEffectiveTheme(route)).toBe('dark');
      }
    });

    it('Tier 1: Nested paths under forced dark routes inherit "dark"', () => {
      window.localStorage.setItem('undone_theme', 'light');

      expect(getRoutePolicy('/notes/notebook-123')).toBe('dark');
      expect(resolveEffectiveTheme('/notes/notebook-123')).toBe('dark');

      expect(getRoutePolicy('/explore/tags/react')).toBe('dark');
      expect(resolveEffectiveTheme('/explore/tags/react')).toBe('dark');
    });

    it('Tier 2: Unmapped routes respect user saved preference in localStorage', () => {
      window.localStorage.setItem('undone_theme', 'dark');
      expect(getRoutePolicy('/')).toBeNull();
      expect(resolveEffectiveTheme('/')).toBe('dark');

      window.localStorage.setItem('undone_theme', 'light');
      expect(resolveEffectiveTheme('/')).toBe('light');
    });

    it('Tier 3: Unmapped routes fall back to OS prefers-color-scheme when localStorage is empty', () => {
      window.localStorage.clear();

      // Mock dark OS
      window.matchMedia = (query: string) =>
        ({
          matches: query.includes('dark'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList;

      expect(resolveEffectiveTheme('/')).toBe('dark');

      // Mock light OS
      window.matchMedia = (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList;

      expect(resolveEffectiveTheme('/')).toBe('light');
    });
  });

  // ─── 2. DOCUMENT ROOT OWNERSHIP & PORTAL INHERITANCE ───────────────────────

  describe('Section 2: Document Root Ownership & Portal Inheritance', () => {
    it('applyThemeToDocument sets data-theme and colorScheme on document.documentElement', () => {
      applyThemeToDocument('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');

      applyThemeToDocument('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('resolves Defect 3.1: body-level portal inherits data-theme from document.documentElement', () => {
      // Simulate route navigation to /notes
      const effectiveTheme = resolveEffectiveTheme('/notes');
      applyThemeToDocument(effectiveTheme);

      // Create a simulated portal element mounted on document.body (like Radix Popover)
      const portalDiv = document.createElement('div');
      portalDiv.className = 'radix-popover-content';
      document.body.appendChild(portalDiv);

      // Verify portal's root ancestor (documentElement) has data-theme="dark"
      const rootTheme = document.documentElement.getAttribute('data-theme');
      expect(rootTheme).toBe('dark');

      // Portals rely on CSS selectors matching [data-theme="dark"] *
      const closestDarkTheme = portalDiv.closest('[data-theme="dark"]');
      expect(closestDarkTheme).toBe(document.documentElement);

      document.body.removeChild(portalDiv);
    });
  });

  // ─── 3. FONT LOADING CONSOLIDATION ─────────────────────────────────────────

  describe('Section 3: Font Loading Consolidation', () => {
    it('confirms globals.css does NOT contain external @import url for Google Fonts', () => {
      const globalsSource = fs.readFileSync(globalsCssPath, 'utf8');
      expect(globalsSource).not.toContain('fonts.googleapis.com');
      expect(globalsSource).not.toMatch(/@import\s+url\([^)]*fonts\.googleapis/);
    });

    it('confirms tokens.css does NOT contain local @font-face declarations', () => {
      const tokensSource = fs.readFileSync(tokensCssPath, 'utf8');
      expect(tokensSource).not.toContain('@font-face');
      expect(tokensSource).not.toContain('/fonts/Manrope-Medium.ttf');
      expect(tokensSource).not.toContain('/fonts/Caveat-Bold.ttf');
    });

    it('confirms font tokens reference next/font variables with fallbacks', () => {
      const tokensSource = fs.readFileSync(tokensCssPath, 'utf8');
      expect(tokensSource).toContain('--font-manrope: var(--font-manrope-next');
      expect(tokensSource).toContain('--font-caveat: var(--font-caveat-next');
      expect(tokensSource).toContain('--font-dancing-script: var(--font-dancing-script-next');
    });

    it('confirms layout.tsx contains pre-hydration theme initialization script in <head>', () => {
      const layoutSource = fs.readFileSync(layoutPath, 'utf8');
      expect(layoutSource).toContain('id="ud-theme-init"');
      expect(layoutSource).toContain('undone_theme');
      expect(layoutSource).toContain('document.documentElement.setAttribute(\'data-theme\'');
    });
  });
});
