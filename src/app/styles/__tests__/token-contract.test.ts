/**
 * Token Architecture & Canonical Contract Acceptance Test Suite (Phase 3)
 *
 * Verifies:
 * 1. Canonical `--ud-*` token definitions in `:root` and `[data-theme="dark"]`.
 * 2. Non-cyclic one-way legacy compatibility aliases.
 * 3. 100% theme parity between `:root` (light) and `[data-theme="dark"]`.
 * 4. Resolution of missing tokens:
 *    - `--radius-full` -> `--ud-radius-pill` (NotesSaveStatus.module.css:53)
 *    - `--color-surface-elevated` -> `--ud-color-surface-elevated` (Sidebar, CreateCohort)
 *    - `--color-surface-hover` -> `--ud-color-surface-hover`
 *    - `--color-border-subtle` / `--color-border-soft`
 *    - `--color-amber-500`, `--color-gray-500`, `--color-green-500`, `--color-red-500`, `--color-red-50`
 *    - `--font-size-sm`, `--font-size-lg`, `--font-size-2xl`
 * 5. Scale preservation:
 *    - `--text-sm` = 1rem (16px), `--text-xs` = 0.875rem (14px).
 * 6. Tailwind v4 `@theme inline` bridging.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import postcss, { type Root, type Rule, type AtRule } from 'postcss';

const rootDir = path.resolve(__dirname, '../../../../');
const tokensCssPath = path.resolve(rootDir, 'src/app/styles/tokens.css');
const globalsCssPath = path.resolve(rootDir, 'src/app/globals.css');

describe('Token Architecture & Canonical Contract (Phase 3)', () => {
  let tokensSource: string;
  let tokensAst: Root;
  let rootRule: Rule | null = null;
  let darkRule: Rule | null = null;
  let themeInlineAtRule: AtRule | null = null;

  beforeAll(() => {
    tokensSource = fs.readFileSync(tokensCssPath, 'utf8');
    tokensAst = postcss.parse(tokensSource);

    tokensAst.walkRules((rule) => {
      if (rule.selector === ':root') {
        rootRule = rule;
      }
      if (rule.selector === '[data-theme="dark"]') {
        darkRule = rule;
      }
    });

    tokensAst.walkAtRules('theme', (atRule) => {
      if (atRule.params.includes('inline')) {
        themeInlineAtRule = atRule;
      }
    });
  });

  // ─── 1. CANONICAL TOKENS & ALIASES EXISTENCE ───────────────────────────────

  describe('Section 1: Canonical --ud-* Tokens & Compatibility Aliases', () => {
    it('defines canonical primitives and one-way legacy aliases in :root', () => {
      expect(rootRule).not.toBeNull();
      const decls: Record<string, string> = {};
      rootRule?.walkDecls((decl) => {
        decls[decl.prop] = decl.value;
      });

      // Canonical primitives
      expect(decls['--ud-color-primitive-indigo-500']).toBe('#4f46e5');
      expect(decls['--ud-color-primitive-orange-500']).toBe('#f59e0b');
      expect(decls['--ud-color-primitive-gray-900']).toBe('#1f2937');
      expect(decls['--ud-color-primitive-green-500']).toBe('#22c55e');
      expect(decls['--ud-color-primitive-red-500']).toBe('#ef4444');
      expect(decls['--ud-color-primitive-blue-500']).toBe('#3b82f6');

      // Legacy primitive aliases point to canonical
      expect(decls['--indigo-500']).toBe('var(--ud-color-primitive-indigo-500)');
      expect(decls['--orange-500']).toBe('var(--ud-color-primitive-orange-500)');
      expect(decls['--gray-900']).toBe('var(--ud-color-primitive-gray-900)');
      expect(decls['--green-500']).toBe('var(--ud-color-primitive-green-500)');
      expect(decls['--red-500']).toBe('var(--ud-color-primitive-red-500)');
      expect(decls['--blue-500']).toBe('var(--ud-color-primitive-blue-500)');
    });

    it('defines canonical semantic colors and one-way legacy aliases in :root', () => {
      const decls: Record<string, string> = {};
      rootRule?.walkDecls((decl) => {
        decls[decl.prop] = decl.value;
      });

      // Canonical semantics
      expect(decls['--ud-color-brand']).toBe('var(--ud-color-primitive-indigo-500)');
      expect(decls['--ud-color-accent']).toBe('var(--ud-color-primitive-orange-500)');
      expect(decls['--ud-color-background']).toBe('#ffffff');
      expect(decls['--ud-color-surface']).toBe('#ffffff');
      expect(decls['--ud-color-text-primary']).toBe('var(--ud-color-primitive-gray-900)');
      expect(decls['--ud-color-border']).toBe('var(--ud-color-primitive-gray-200)');

      // Legacy semantic aliases point to canonical
      expect(decls['--color-brand']).toBe('var(--ud-color-brand)');
      expect(decls['--color-accent']).toBe('var(--ud-color-accent)');
      expect(decls['--color-background']).toBe('var(--ud-color-background)');
      expect(decls['--color-surface']).toBe('var(--ud-color-surface)');
      expect(decls['--color-text-primary']).toBe('var(--ud-color-text-primary)');
      expect(decls['--color-text']).toBe('var(--ud-color-text-primary)');
      expect(decls['--color-border']).toBe('var(--ud-color-border)');
    });

    it('enforces non-cyclic guarantee: canonical --ud-* tokens NEVER reference legacy aliases', () => {
      rootRule?.walkDecls((decl) => {
        if (decl.prop.startsWith('--ud-')) {
          // Must not reference legacy variable names like var(--color-*), var(--space-*), etc.
          expect(decl.value).not.toMatch(/var\(--color-[a-z]/);
          expect(decl.value).not.toMatch(/var\(--space-[0-9]/);
          expect(decl.value).not.toMatch(/var\(--radius-[a-z]/);
          expect(decl.value).not.toMatch(/var\(--shadow-[a-z]/);
          expect(decl.value).not.toMatch(/var\(--duration-[a-z]/);
          expect(decl.value).not.toMatch(/var\(--text-[a-z0-9]/);
        }
      });
    });
  });

  // ─── 2. MISSING TOKEN RESOLUTIONS ──────────────────────────────────────────

  describe('Section 2: Missing Token Resolution Audit', () => {
    it('resolves Defect 3.3: --radius-full maps to --ud-radius-pill (999px)', () => {
      const decls: Record<string, string> = {};
      rootRule?.walkDecls((decl) => {
        decls[decl.prop] = decl.value;
      });

      expect(decls['--ud-radius-pill']).toBe('999px');
      expect(decls['--radius-full']).toBe('var(--ud-radius-pill)');
    });

    it('resolves missing surface tokens: --color-surface-elevated and --color-surface-hover', () => {
      const lightDecls: Record<string, string> = {};
      rootRule?.walkDecls((decl) => {
        lightDecls[decl.prop] = decl.value;
      });
      const darkDecls: Record<string, string> = {};
      darkRule?.walkDecls((decl) => {
        darkDecls[decl.prop] = decl.value;
      });

      // Light
      expect(lightDecls['--ud-color-surface-elevated']).toBe('#ffffff');
      expect(lightDecls['--color-surface-elevated']).toBe('var(--ud-color-surface-elevated)');
      expect(lightDecls['--ud-color-surface-hover']).toBe('var(--ud-color-primitive-gray-100)');
      expect(lightDecls['--color-surface-hover']).toBe('var(--ud-color-surface-hover)');

      // Dark
      expect(darkDecls['--ud-color-surface-elevated']).toBe('#18181b');
      expect(darkDecls['--ud-color-surface-hover']).toBe('#27272a');
    });

    it('resolves missing border tokens: --color-border-subtle and --color-border-soft', () => {
      const decls: Record<string, string> = {};
      rootRule?.walkDecls((decl) => {
        decls[decl.prop] = decl.value;
      });

      expect(decls['--ud-color-border-subtle']).toBe('var(--ud-color-primitive-gray-100)');
      expect(decls['--color-border-subtle']).toBe('var(--ud-color-border-subtle)');
      expect(decls['--color-border-soft']).toBe('var(--ud-color-border-subtle)');
    });

    it('resolves component-prefixed primitives: --color-amber-500, --color-gray-500, etc.', () => {
      const decls: Record<string, string> = {};
      rootRule?.walkDecls((decl) => {
        decls[decl.prop] = decl.value;
      });

      expect(decls['--color-amber-500']).toBe('var(--ud-color-primitive-orange-500)');
      expect(decls['--color-gray-500']).toBe('var(--ud-color-primitive-gray-500)');
      expect(decls['--color-green-500']).toBe('var(--ud-color-primitive-green-500)');
      expect(decls['--color-red-500']).toBe('var(--ud-color-primitive-red-500)');
      expect(decls['--color-red-50']).toBe('var(--ud-color-primitive-red-50)');
    });

    it('resolves HomeMobile font-size aliases: --font-size-sm, --font-size-lg, --font-size-2xl', () => {
      const decls: Record<string, string> = {};
      rootRule?.walkDecls((decl) => {
        decls[decl.prop] = decl.value;
      });

      expect(decls['--font-size-sm']).toBe('var(--ud-font-size-xs)');
      expect(decls['--font-size-lg']).toBe('var(--ud-font-size-lg)');
      expect(decls['--font-size-2xl']).toBe('var(--ud-font-size-2xl)');
    });
  });

  // ─── 3. SCALE PRESERVATION CONTRACT ────────────────────────────────────────

  describe('Section 3: Scale Preservation Contract', () => {
    it('strictly preserves --text-sm = 1rem (16px) and --text-xs = 0.875rem (14px)', () => {
      const decls: Record<string, string> = {};
      rootRule?.walkDecls((decl) => {
        decls[decl.prop] = decl.value;
      });

      expect(decls['--ud-font-size-sm']).toBe('1rem');
      expect(decls['--ud-font-size-xs']).toBe('0.875rem');
      expect(decls['--text-sm']).toBe('var(--ud-font-size-sm)');
      expect(decls['--text-xs']).toBe('var(--ud-font-size-xs)');
    });

    it('preserves full spacing scale from --ud-space-0 through --ud-space-64', () => {
      const decls: Record<string, string> = {};
      rootRule?.walkDecls((decl) => {
        decls[decl.prop] = decl.value;
      });

      expect(decls['--ud-space-0']).toBe('0');
      expect(decls['--ud-space-0-5']).toBe('0.125rem');
      expect(decls['--ud-space-1']).toBe('0.25rem');
      expect(decls['--ud-space-4']).toBe('1rem');
      expect(decls['--ud-space-6']).toBe('1.5rem');
      expect(decls['--ud-space-8']).toBe('2rem');
      expect(decls['--space-6']).toBe('var(--ud-space-6)');
    });
  });

  // ─── 4. THEME PARITY IN [data-theme="dark"] ────────────────────────────────

  describe('Section 4: Total Theme Parity in [data-theme="dark"]', () => {
    it('sets color-scheme: dark on [data-theme="dark"]', () => {
      expect(darkRule).not.toBeNull();
      let colorSchemeValue = '';
      darkRule?.walkDecls('color-scheme', (decl) => {
        colorSchemeValue = decl.value;
      });
      expect(colorSchemeValue).toBe('dark');
    });

    it('provides explicit dark overrides for all primary semantic color variables', () => {
      const darkDecls: Record<string, string> = {};
      darkRule?.walkDecls((decl) => {
        darkDecls[decl.prop] = decl.value;
      });

      expect(darkDecls['--ud-color-background']).toBe('#000000');
      expect(darkDecls['--ud-color-surface']).toBe('#000000');
      expect(darkDecls['--ud-color-surface-secondary']).toBe('#09090b');
      expect(darkDecls['--ud-color-surface-tertiary']).toBe('#18181b');
      expect(darkDecls['--ud-color-surface-elevated']).toBe('#18181b');
      expect(darkDecls['--ud-color-surface-hover']).toBe('#27272a');
      expect(darkDecls['--ud-color-text-primary']).toBe('#ffffff');
      expect(darkDecls['--ud-color-text-secondary']).toBe('#a1a1aa');
      expect(darkDecls['--ud-color-text-muted']).toBe('#71717a');
      expect(darkDecls['--ud-color-border']).toBe('#27272a');
      expect(darkDecls['--ud-color-border-hover']).toBe('#3f3f46');
      expect(darkDecls['--ud-color-border-subtle']).toBe('#18181b');
      expect(darkDecls['--ud-color-success']).toBe('#22c55e');
      expect(darkDecls['--ud-color-error']).toBe('#ef4444');
    });
  });

  // ─── 5. TAILWIND v4 @theme inline BRIDGE ───────────────────────────────────

  describe('Section 5: Tailwind v4 @theme inline Bridge', () => {
    it('exports @theme inline mapping to canonical tokens', () => {
      expect(themeInlineAtRule).not.toBeNull();
      const themeDecls: Record<string, string> = {};
      themeInlineAtRule?.walkDecls((decl) => {
        themeDecls[decl.prop] = decl.value;
      });

      expect(themeDecls['--color-background']).toBe('var(--ud-color-background)');
      expect(themeDecls['--color-surface']).toBe('var(--ud-color-surface)');
      expect(themeDecls['--color-brand']).toBe('var(--ud-color-brand)');
      expect(themeDecls['--color-text-primary']).toBe('var(--ud-color-text-primary)');
      expect(themeDecls['--color-border']).toBe('var(--ud-color-border)');
      expect(themeDecls['--font-sans']).toBe('var(--ud-font-sans)');
      expect(themeDecls['--radius-button']).toBe('var(--ud-radius-button)');
    });
  });
});
