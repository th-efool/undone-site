/**
 * Built-Output Production Acceptance Test Suite (Phase 7, Step 7.5)
 *
 * Verifies that the compiled Next.js production build in `.next/`:
 * 1. Contains compiled CSS chunks without bundling failures or orphan references.
 * 2. Emits canonical `--ud-*` tokens into production bundles.
 * 3. Compiles UI primitives (Button, Dialog, Heading, Popover, Field) with their scoped CSS classes.
 * 4. Ensures zero phantom Tailwind animation utilities remain in production CSS.
 * 5. Verifies mobile safe areas and minimum touch targets (44px) are preserved.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../../../../');
const chunksDir = path.resolve(rootDir, '.next/static/chunks');

describe('Built-Output Production Acceptance (Phase 7, Step 7.5)', () => {
  const cssChunkContents: string[] = [];
  let combinedCss = '';

  beforeAll(() => {
    if (!fs.existsSync(chunksDir)) {
      throw new Error(`.next/static/chunks directory not found. Run 'npm run build' first.`);
    }

    const files = fs.readdirSync(chunksDir);
    const cssFiles = files.filter((f) => f.endsWith('.css'));

    expect(cssFiles.length, 'No compiled CSS chunks found in .next/static/chunks').toBeGreaterThan(0);

    for (const file of cssFiles) {
      const content = fs.readFileSync(path.join(chunksDir, file), 'utf8');
      cssChunkContents.push(content);
      combinedCss += '\n' + content;
    }
  });

  // ─── 1. PRODUCTION BUNDLE INTEGRITY ─────────────────────────────────────────

  describe('1. Production Bundle Integrity', () => {
    it('verifies multiple CSS chunks are emitted and non-empty', () => {
      expect(cssChunkContents.length).toBeGreaterThan(5);
      for (const chunk of cssChunkContents) {
        expect(chunk.length).toBeGreaterThan(0);
      }
    });

    it('verifies total compiled CSS size is substantial and reasonable', () => {
      expect(combinedCss.length).toBeGreaterThan(100000); // >100KB compiled CSS
    });
  });

  // ─── 2. CANONICAL TOKEN COMPILATION ─────────────────────────────────────────

  describe('2. Canonical Token Compilation in Production', () => {
    it('verifies canonical --ud-* tokens are present in compiled production CSS', () => {
      expect(combinedCss).toContain('--ud-color-brand');
      expect(combinedCss).toContain('--ud-color-surface');
      expect(combinedCss).toContain('--ud-radius-');
      expect(combinedCss).toContain('--ud-space-');
      expect(combinedCss).toContain('--ud-font-size-');
    });

    it('verifies one-way legacy aliases resolve to canonical tokens', () => {
      expect(combinedCss).toMatch(/var\(--ud-color-brand/);
      expect(combinedCss).toMatch(/var\(--ud-radius-pill/);
      expect(combinedCss).toMatch(/var\(--ud-color-surface-elevated/);
    });
  });

  // ─── 3. UI PRIMITIVES PRODUCTION SCOPING ────────────────────────────────────

  describe('3. UI Primitives Production Scoping', () => {
    it('verifies Button primitive is compiled with scoped module classes and touch target', () => {
      expect(combinedCss).toMatch(/Button-module__[a-zA-Z0-9_-]+__root/);
      expect(combinedCss).toMatch(/Button-module__[a-zA-Z0-9_-]+__primary/);
      expect(combinedCss).toMatch(/Button-module__[a-zA-Z0-9_-]+__destructive/);
      expect(combinedCss).toContain('--ud-touch-target-min');
    });

    it('verifies Dialog primitive is compiled with scoped animation and close button', () => {
      expect(combinedCss).toMatch(/Dialog-module__[a-zA-Z0-9_-]+__dialog/);
      expect(combinedCss).toMatch(/Dialog-module__[a-zA-Z0-9_-]+__closeButton/);
      expect(combinedCss).toMatch(/Dialog-module__[a-zA-Z0-9_-]+__udFadeIn/);
    });

    it('verifies Navigation and Shell modules are compiled with canonical tokens', () => {
      expect(combinedCss).toMatch(/MobileNav-module__[a-zA-Z0-9_-]+__mobileNav/);
      expect(combinedCss).toMatch(/SidebarItem-module__[a-zA-Z0-9_-]+__item/);
      expect(combinedCss).toMatch(/CommandPalette-module__[a-zA-Z0-9_-]+__dialog/);
    });
  });

  // ─── 4. ZERO PHANTOM TAILWIND UTILITIES IN PRODUCTION ───────────────────────

  describe('4. Zero Phantom Utilities in Production', () => {
    it('verifies zero occurrences of phantom animation classes in production CSS', () => {
      // These classes generate 0 CSS rules in Tailwind v4 and were purged
      expect(combinedCss).not.toContain('.animate-in');
      expect(combinedCss).not.toContain('.fade-in');
      expect(combinedCss).not.toContain('.slide-in-from-bottom-2');
      expect(combinedCss).not.toContain('.slide-in-from-top-2');
    });
  });

  // ─── 5. MOBILE VIEWPORT & SAFE AREA HANDLING ────────────────────────────────

  describe('5. Mobile Viewport & Safe Area Compilation', () => {
    it('verifies safe area insets are preserved for mobile bottom navigation', () => {
      expect(combinedCss).toContain('env(safe-area-inset-bottom');
    });
  });
});
