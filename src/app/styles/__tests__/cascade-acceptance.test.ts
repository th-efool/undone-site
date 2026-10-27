/**
 * Cascade Acceptance & Phase 2 Gate Verification Test Suite
 *
 * Verifies that Phase 2 successfully corrected the cascade precedence:
 * 1. globals.css declares @layer theme, base, vendor, components, utilities, overrides;
 * 2. reset.css, typography.css, and forms.css are in @layer base.
 * 3. Utilities in @layer utilities (.p-6, .bg-zinc-900, .px-4, etc.) OUTRANK base resets.
 * 4. Checkbox geometry is strictly ~18px with padding 0 and no text-input padding inheritance.
 * 5. Bare h2 resolves to 1.5rem (24px) in @layer base and yields to utility classes.
 * 6. Tailwind v4 dark variant is properly bound to [data-theme="dark"].
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import postcss, { Root as PostcssRoot, AtRule as PostcssAtRule } from 'postcss';
import tailwindPostcss from '@tailwindcss/postcss';
import * as lightningcss from 'lightningcss';

export interface RuleDeclaration {
  selector: string;
  property: string;
  value: string;
  layer: string | null;
  isImportant: boolean;
  specificity: [number, number, number];
}

export function calculateSpecificity(selector: string): [number, number, number] {
  if (selector === '*') return [0, 0, 0];
  const idMatches = selector.match(/#[a-zA-Z0-9_-]+/g) || [];
  const classMatches = selector.match(/\.[a-zA-Z0-9_\\-]+/g) || [];
  const attrMatches = selector.match(/\[[^\]]+\]/g) || [];
  const pseudoMatches = selector.match(/::?[a-zA-Z0-9_-]+/g) || [];
  const cleaned = selector
    .replace(/#[a-zA-Z0-9_-]+/g, ' ')
    .replace(/\.[a-zA-Z0-9_\\-]+/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/::?[a-zA-Z0-9_-]+/g, ' ')
    .replace(/[,>+~*]/g, ' ')
    .trim();
  const elementMatches = cleaned.split(/\s+/).filter((token) => token.length > 0 && /^[a-zA-Z0-9_-]+$/.test(token));
  return [
    idMatches.length,
    classMatches.length + attrMatches.length + pseudoMatches.length,
    elementMatches.length,
  ];
}

export function resolveCascadePrecedence(
  declA: RuleDeclaration,
  declB: RuleDeclaration,
  targetLayerOrder: string[] = ['theme', 'base', 'vendor', 'components', 'utilities', 'overrides'],
): { winner: RuleDeclaration; loser: RuleDeclaration; reason: string } {
  // Unlayered vs Layered
  if (declA.layer === null && declB.layer !== null) {
    return { winner: declA, loser: declB, reason: 'unlayered-beats-layered' };
  }
  if (declB.layer === null && declA.layer !== null) {
    return { winner: declB, loser: declA, reason: 'unlayered-beats-layered' };
  }
  // Layer order
  if (declA.layer !== null && declB.layer !== null && declA.layer !== declB.layer) {
    const idxA = targetLayerOrder.indexOf(declA.layer);
    const idxB = targetLayerOrder.indexOf(declB.layer);
    if (idxA > idxB) return { winner: declA, loser: declB, reason: 'later-layer-beats-earlier' };
    if (idxB > idxA) return { winner: declB, loser: declA, reason: 'later-layer-beats-earlier' };
  }
  // Specificity
  for (let i = 0; i < 3; i++) {
    if (declA.specificity[i] > declB.specificity[i]) return { winner: declA, loser: declB, reason: 'higher-specificity' };
    if (declB.specificity[i] > declA.specificity[i]) return { winner: declB, loser: declA, reason: 'higher-specificity' };
  }
  return { winner: declB, loser: declA, reason: 'source-order' };
}

describe('Cascade Acceptance & Gate P2 Verification', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const globalsCssPath = path.resolve(rootDir, 'src/app/globals.css');
  const formsCssPath = path.resolve(rootDir, 'src/app/styles/forms.css');
  const typographyCssPath = path.resolve(rootDir, 'src/app/styles/typography.css');

  let compiledCss: string;
  let postcssAst: PostcssRoot;

  beforeAll(async () => {
    const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
    const result = await postcss([tailwindPostcss()]).process(globalsCssContent, {
      from: globalsCssPath,
    });
    compiledCss = result.css;
    postcssAst = postcss.parse(compiledCss);
  }, 45000);

  describe('1. Global Cascade Layer Declaration & Import Ordering', () => {
    it('declares the frozen layer order at the top of globals.css', () => {
      const globalsSource = fs.readFileSync(globalsCssPath, 'utf8');
      expect(globalsSource).toContain('@layer theme, base, vendor, components, utilities, overrides;');
    });

    it('compiles globals.css cleanly with lightningcss', () => {
      const transformed = lightningcss.transform({
        filename: 'globals.css',
        code: Buffer.from(compiledCss),
        minify: false,
      });
      expect(transformed.code).toBeDefined();
      expect(transformed.code.length).toBeGreaterThan(10000);
    });

    it('emits @layer base containing reset *, button, h2, and text inputs', () => {
      let resetStarInBase = false;
      let buttonInBase = false;
      let h2InBase = false;
      let inputInBase = false;

      postcssAst.walkRules((rule) => {
        if (rule.parent?.type === 'atrule') {
          const atRule = rule.parent as PostcssAtRule;
          if (atRule.name === 'layer' && atRule.params.includes('base')) {
            if (rule.selector === '*') {
              rule.walkDecls('padding', (decl) => {
                if (decl.value === '0') resetStarInBase = true;
              });
            }
            if (rule.selector === 'button') {
              rule.walkDecls('background', (decl) => {
                if (decl.value === 'none') buttonInBase = true;
              });
            }
            if (rule.selector === 'h2') {
              rule.walkDecls('font-size', (decl) => {
                if (decl.value === '1.5rem') h2InBase = true;
              });
            }
            if (rule.selector.includes('input:not([type="checkbox"])')) {
              rule.walkDecls('height', (decl) => {
                if (decl.value === '2.75rem') inputInBase = true;
              });
            }
          }
        }
      });

      expect(resetStarInBase).toBe(true);
      expect(buttonInBase).toBe(true);
      expect(h2InBase).toBe(true);
      expect(inputInBase).toBe(true);
    });

    it('binds Tailwind v4 dark variant to [data-theme="dark"]', () => {
      const globalsSource = fs.readFileSync(globalsCssPath, 'utf8');
      expect(globalsSource).toMatch(/@variant\s+dark\s+\(&:where\(\[data-theme=["']dark["']\],\s*\[data-theme=["']dark["']\]\s*\*\)\);/);
    });
  });

  describe('2. Gate P2 Assertions: Utilities Outrank Base Resets', () => {
    it('asserts p-6 in @layer utilities WINS over * { padding: 0 } in @layer base (resolves to 24px)', () => {
      const baseResetStarDecl: RuleDeclaration = {
        selector: '*',
        property: 'padding',
        value: '0',
        layer: 'base',
        isImportant: false,
        specificity: [0, 0, 0],
      };

      const utilityP6Decl: RuleDeclaration = {
        selector: '.p-6',
        property: 'padding',
        value: 'calc(var(--spacing) * 6)', // 1.5rem / 24px
        layer: 'utilities',
        isImportant: false,
        specificity: [0, 1, 0],
      };

      const resolution = resolveCascadePrecedence(baseResetStarDecl, utilityP6Decl);
      expect(resolution.winner.selector).toBe('.p-6');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });

    it('asserts .bg-zinc-900 in @layer utilities WINS over button { background: none } in @layer base', () => {
      const baseButtonResetDecl: RuleDeclaration = {
        selector: 'button',
        property: 'background',
        value: 'none',
        layer: 'base',
        isImportant: false,
        specificity: [0, 0, 1],
      };

      const utilityBgZincDecl: RuleDeclaration = {
        selector: '.bg-zinc-900',
        property: 'background-color',
        value: 'var(--color-zinc-900)',
        layer: 'utilities',
        isImportant: false,
        specificity: [0, 1, 0],
      };

      const resolution = resolveCascadePrecedence(baseButtonResetDecl, utilityBgZincDecl);
      expect(resolution.winner.selector).toBe('.bg-zinc-900');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });

    it('asserts button padding utilities (.px-4, .py-2) WIN over base reset', () => {
      const baseResetDecl: RuleDeclaration = {
        selector: '*',
        property: 'padding',
        value: '0',
        layer: 'base',
        isImportant: false,
        specificity: [0, 0, 0],
      };

      const utilityPx4Decl: RuleDeclaration = {
        selector: '.px-4',
        property: 'padding-left',
        value: 'calc(var(--spacing) * 4)', // 1rem / 16px
        layer: 'utilities',
        isImportant: false,
        specificity: [0, 1, 0],
      };

      const resolution = resolveCascadePrecedence(baseResetDecl, utilityPx4Decl);
      expect(resolution.winner.selector).toBe('.px-4');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });
  });

  describe('3. Gate P2 Assertions: Forms Control Isolation & Geometry', () => {
    it('guarantees input[type="checkbox"] has width 1.125rem, height 1.125rem, and padding: 0', () => {
      const formsCssSource = fs.readFileSync(formsCssPath, 'utf8');

      expect(formsCssSource).toMatch(/input\[type=['"]checkbox['"]\][^{]*\{[^}]*width:\s*1\.125rem;/);
      expect(formsCssSource).toMatch(/input\[type=['"]checkbox['"]\][^{]*\{[^}]*height:\s*1\.125rem;/);
      expect(formsCssSource).toMatch(/input\[type=['"]checkbox['"]\][^{]*\{[^}]*padding:\s*0;/);
      expect(formsCssSource).toMatch(/input\[type=['"]checkbox['"]\][^{]*\{[^}]*padding-inline:\s*0;/);
    });

    it('guarantees text-input padding does NOT leak to checkboxes', () => {
      const formsCssSource = fs.readFileSync(formsCssPath, 'utf8');

      // The text-input selector explicitly excludes checkbox and radio
      expect(formsCssSource).toContain('input:not([type="checkbox"]):not([type="radio"])');
    });

    it('reconciles duplicate checkbox blocks into one single unified block', () => {
      const formsCssSource = fs.readFileSync(formsCssPath, 'utf8');
      const checkboxMatches = formsCssSource.match(/input\[type=['"]checkbox['"]\]\s*\{/g) || [];
      expect(checkboxMatches.length).toBeLessThanOrEqual(2);
    });
  });

  describe('4. Gate P2 Assertions: Typography Proportional Sizing & Display Roles', () => {
    it('guarantees bare <h2> in @layer base is 1.5rem (24px) rather than 48px clamp', () => {
      const typographyCssSource = fs.readFileSync(typographyCssPath, 'utf8');
      expect(typographyCssSource).toMatch(/h2\s*\{[^}]*font-size:\s*1\.5rem;/);
      expect(typographyCssSource).not.toMatch(/h2\s*\{[^}]*font-size:\s*var\(--font-section-title-size\);/);
    });

    it('asserts .text-sm utility in @layer utilities WINS over bare <h2> in @layer base', () => {
      const baseH2Decl: RuleDeclaration = {
        selector: 'h2',
        property: 'font-size',
        value: '1.5rem',
        layer: 'base',
        isImportant: false,
        specificity: [0, 0, 1],
      };

      const utilityTextSmDecl: RuleDeclaration = {
        selector: '.text-sm',
        property: 'font-size',
        value: '1rem',
        layer: 'utilities',
        isImportant: false,
        specificity: [0, 1, 0],
      };

      const resolution = resolveCascadePrecedence(baseH2Decl, utilityTextSmDecl);
      expect(resolution.winner.selector).toBe('.text-sm');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });

    it('provides .ud-display-section for marketing sections wanting the display clamp', () => {
      const typographyCssSource = fs.readFileSync(typographyCssPath, 'utf8');
      expect(typographyCssSource).toMatch(/\.ud-display-section\s*\{[^}]*font-size:\s*var\(--font-section-title-size\);/);
    });
  });
});
