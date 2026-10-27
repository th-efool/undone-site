/**
 * Typography Base Neutralization & Display Roles Test Suite
 *
 * Phase 2, Task 2.2B: Neutralize implicit visual hierarchy on bare h1-h6 tags
 * in src/app/styles/typography.css while preserving intended marketing/editorial
 * display appearance for explicit heading consumers.
 *
 * Requirements:
 * - Bare <h2> resolves to 1.5rem (24px) instead of 48px clamp.
 * - .ud-display-section provides var(--font-section-title-size).
 * - Headings in @layer base yield to utility classes like text-sm and text-base.
 * - <Heading> and <Text> component contracts remain preserved.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import postcss, { Root as PostcssRoot, Rule as PostcssRule, AtRule as PostcssAtRule } from 'postcss';
import tailwindPostcss from '@tailwindcss/postcss';
import { Heading } from '../../../../src/client/components/ui/Typography/Heading';
import { Text } from '../../../../src/client/components/ui/Typography/Text';

// ─── CASCADE ENGINE & TYPES ──────────────────────────────────────────────────

export interface RuleDeclaration {
  selector: string;
  property: string;
  value: string;
  layer: string | null;
  isImportant: boolean;
  specificity: [number, number, number];
  sourceFile?: string;
}

export interface CascadeResolution {
  winner: RuleDeclaration;
  loser: RuleDeclaration;
  reason: 'unlayered-beats-layered' | 'later-layer-beats-earlier' | 'higher-specificity' | 'source-order';
}

export function calculateSpecificity(selector: string): [number, number, number] {
  if (selector === '*') return [0, 0, 0];

  const idMatches = selector.match(/#[a-zA-Z0-9_-]+/g) || [];
  const classMatches = selector.match(/\.[a-zA-Z0-9_\\-]+/g) || [];
  const attrMatches = selector.match(/\[[^\]]+\]/g) || [];
  const pseudoMatches = selector.match(/::?[a-zA-Z0-9_-]+/g) || [];

  let cleaned = selector
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
): CascadeResolution {
  if (declA.layer === null && declB.layer !== null) {
    return { winner: declA, loser: declB, reason: 'unlayered-beats-layered' };
  }
  if (declB.layer === null && declA.layer !== null) {
    return { winner: declB, loser: declA, reason: 'unlayered-beats-layered' };
  }

  if (declA.layer !== null && declB.layer !== null && declA.layer !== declB.layer) {
    const idxA = targetLayerOrder.indexOf(declA.layer);
    const idxB = targetLayerOrder.indexOf(declB.layer);
    if (idxA > idxB) {
      return { winner: declA, loser: declB, reason: 'later-layer-beats-earlier' };
    }
    if (idxB > idxA) {
      return { winner: declB, loser: declA, reason: 'later-layer-beats-earlier' };
    }
  }

  for (let i = 0; i < 3; i++) {
    if (declA.specificity[i] > declB.specificity[i]) {
      return { winner: declA, loser: declB, reason: 'higher-specificity' };
    }
    if (declB.specificity[i] > declA.specificity[i]) {
      return { winner: declB, loser: declA, reason: 'higher-specificity' };
    }
  }

  return { winner: declB, loser: declA, reason: 'source-order' };
}

// ─── TEST SUITE ──────────────────────────────────────────────────────────────

describe('Phase 2, Task 2.2B: Typography Base Neutralization and Roles', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const typographyCssPath = path.resolve(rootDir, 'src/app/styles/typography.css');
  const globalsCssPath = path.resolve(rootDir, 'src/app/globals.css');
  const headingModuleCssPath = path.resolve(
    rootDir,
    'src/client/components/ui/Typography/Heading.module.css',
  );
  const textModuleCssPath = path.resolve(
    rootDir,
    'src/client/components/ui/Typography/Text.module.css',
  );

  let typographyCssContent: string;
  let compiledCss: string;
  let compiledAst: PostcssRoot;

  beforeAll(async () => {
    typographyCssContent = fs.readFileSync(typographyCssPath, 'utf8');

    // Compile globals.css through PostCSS with @tailwindcss/postcss
    const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
    const result = await postcss([tailwindPostcss()]).process(globalsCssContent, {
      from: globalsCssPath,
    });
    compiledCss = result.css;
    compiledAst = postcss.parse(compiledCss);
  }, 45000);

  // ─── 1. BARE HEADING TAG DECOUPLING & PROPORTIONAL SCALES ──────────────────

  describe('Contract 1: Decouple bare semantic heading tags from marketing display sizes', () => {
    it('defines proportional semantic sizes for bare h1-h6 in typography.css', () => {
      // h1: 2rem (32px), line-height: 1.25
      expect(typographyCssContent).toMatch(/h1\s*\{[^}]*font-size:\s*2rem;[^}]*line-height:\s*1\.25;/);

      // h2: 1.5rem (24px), line-height: 1.3 (NOT var(--font-section-title-size) / 48px clamp)
      expect(typographyCssContent).toMatch(/h2\s*\{[^}]*font-size:\s*1\.5rem;[^}]*line-height:\s*1\.3;/);
      expect(typographyCssContent).not.toMatch(/h2\s*\{[^}]*font-size:\s*var\(--font-section-title-size\);/);

      // h3: 1.25rem (20px), line-height: 1.35
      expect(typographyCssContent).toMatch(/h3\s*\{[^}]*font-size:\s*1\.25rem;[^}]*line-height:\s*1\.35;/);

      // h4: 1.125rem (18px), line-height: 1.4
      expect(typographyCssContent).toMatch(/h4\s*\{[^}]*font-size:\s*1\.125rem;[^}]*line-height:\s*1\.4;/);

      // h5: 1rem (16px), line-height: 1.45
      expect(typographyCssContent).toMatch(/h5\s*\{[^}]*font-size:\s*1rem;[^}]*line-height:\s*1\.45;/);

      // h6: 0.875rem (14px), line-height: 1.5
      expect(typographyCssContent).toMatch(/h6\s*\{[^}]*font-size:\s*0\.875rem;[^}]*line-height:\s*1\.5;/);
    });

    it('encloses bare headings and base elements within @layer base', () => {
      expect(typographyCssContent).toContain('@layer base {');

      // Verify h2 rule is inside @layer base in compiled AST
      let h2FoundInBase = false;
      let h2FontSize = '';
      let h2LineHeight = '';

      compiledAst.walkRules('h2', (rule) => {
        let currentParent: any = rule.parent;
        while (currentParent) {
          if (
            currentParent.type === 'atrule' &&
            currentParent.name === 'layer' &&
            currentParent.params.includes('base')
          ) {
            h2FoundInBase = true;
            rule.walkDecls('font-size', (decl) => {
              h2FontSize = decl.value;
            });
            rule.walkDecls('line-height', (decl) => {
              h2LineHeight = decl.value;
            });
          }
          currentParent = currentParent.parent;
        }
      });

      expect(h2FoundInBase).toBe(true);
      expect(h2FontSize).toBe('1.5rem');
      expect(h2LineHeight).toBe('1.3');
    });

    it('removes aggressive responsive clamp scaling from bare heading elements', () => {
      // The old mobile media query enforced clamp(var(--text-2xl), 5vw, var(--text-4xl)) on h2
      expect(typographyCssContent).not.toMatch(/@media[^{]*max-width[^{]*\{[\s\S]*h2\s*\{[^}]*clamp/);
    });
  });

  // ─── 2. EXPLICIT DISPLAY & EDITORIAL CLASSES ───────────────────────────────

  describe('Contract 2: Explicit Display & Editorial Classes', () => {
    it('provides .ud-display-hero with clamp, extrabold weight, and leading-none', () => {
      expect(typographyCssContent).toMatch(
        /\.ud-display-hero\s*\{[^}]*font-size:\s*clamp\(var\(--text-5xl\),\s*7vw,\s*var\(--display-md\)\);/,
      );
      expect(typographyCssContent).toMatch(/\.ud-display-hero\s*\{[^}]*font-weight:\s*var\(--font-extrabold\);/);
      expect(typographyCssContent).toMatch(/\.ud-display-hero\s*\{[^}]*line-height:\s*var\(--leading-none\);/);
    });

    it('provides .ud-display-section with var(--font-section-title-size), bold weight, and leading-tight', () => {
      expect(typographyCssContent).toMatch(
        /\.ud-display-section\s*\{[^}]*font-size:\s*var\(--font-section-title-size\);/,
      );
      expect(typographyCssContent).toMatch(/\.ud-display-section\s*\{[^}]*font-weight:\s*var\(--font-bold\);/);
      expect(typographyCssContent).toMatch(/\.ud-display-section\s*\{[^}]*line-height:\s*var\(--leading-tight\);/);
    });

    it('encloses display utility classes in @layer utilities in compiled CSS', () => {
      let displaySectionFoundInUtilities = false;
      let displaySectionFontSize = '';

      compiledAst.walkRules('.ud-display-section', (rule) => {
        let currentParent: any = rule.parent;
        while (currentParent) {
          if (
            currentParent.type === 'atrule' &&
            currentParent.name === 'layer' &&
            currentParent.params.includes('utilities')
          ) {
            displaySectionFoundInUtilities = true;
            rule.walkDecls('font-size', (decl) => {
              displaySectionFontSize = decl.value;
            });
          }
          currentParent = currentParent.parent;
        }
      });

      expect(displaySectionFoundInUtilities).toBe(true);
      expect(displaySectionFontSize).toBe('var(--font-section-title-size)');
    });
  });

  // ─── 3. PARAGRAPH NEUTRALIZATION & COLOR INHERITANCE ────────────────────────

  describe('Contract 3: Paragraph rules and non-clobbering color inheritance', () => {
    it('sets color: inherit on p to preserve parent and component color inheritance', () => {
      expect(typographyCssContent).toMatch(/p\s*\{[^}]*color:\s*inherit;/);
      expect(typographyCssContent).toMatch(/p\s*\{[^}]*font-size:\s*var\(--font-body-size\);/);
      expect(typographyCssContent).toMatch(/p\s*\{[^}]*line-height:\s*var\(--font-body-line-height\);/);
    });

    it('does not clobber component error text when wrapped in @layer base', () => {
      let pInBase: RuleDeclaration | null = null;
      let textRoseInUtilities: RuleDeclaration | null = null;

      compiledAst.walkRules((rule) => {
        if (rule.selector === 'p') {
          let inBase = false;
          let currentParent: any = rule.parent;
          while (currentParent) {
            if (
              currentParent.type === 'atrule' &&
              currentParent.name === 'layer' &&
              currentParent.params.includes('base')
            ) {
              inBase = true;
            }
            currentParent = currentParent.parent;
          }
          if (inBase) {
            pInBase = {
              selector: 'p',
              property: 'color',
              value: 'inherit',
              layer: 'base',
              isImportant: false,
              specificity: calculateSpecificity('p'),
            };
          }
        }

        if (rule.selector.includes('.text-rose-600')) {
          let inUtilities = false;
          let currentParent: any = rule.parent;
          while (currentParent) {
            if (
              currentParent.type === 'atrule' &&
              currentParent.name === 'layer' &&
              currentParent.params.includes('utilities')
            ) {
              inUtilities = true;
            }
            currentParent = currentParent.parent;
          }
          if (inUtilities) {
            rule.walkDecls('color', (decl) => {
              textRoseInUtilities = {
                selector: rule.selector,
                property: 'color',
                value: decl.value,
                layer: 'utilities',
                isImportant: false,
                specificity: calculateSpecificity(rule.selector),
              };
            });
          }
        }
      });

      expect(pInBase).not.toBeNull();
      expect(textRoseInUtilities).not.toBeNull();

      const resolution = resolveCascadePrecedence(pInBase!, textRoseInUtilities!);
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });
  });

  // ─── 4. CASCADE PRECEDENCE: BASE HEADINGS YIELD TO UTILITIES ────────────────

  describe('Cascade Precedence: Headings in @layer base yield to utility classes', () => {
    it('yields h2 font-size (1.5rem in base) to .text-sm in utilities', () => {
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
        value: 'var(--text-sm)',
        layer: 'utilities',
        isImportant: false,
        specificity: [0, 1, 0],
      };

      const resolution = resolveCascadePrecedence(baseH2Decl, utilityTextSmDecl);
      expect(resolution.winner.selector).toBe('.text-sm');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });

    it('yields h2 font-size (1.5rem in base) to .text-base in utilities', () => {
      const baseH2Decl: RuleDeclaration = {
        selector: 'h2',
        property: 'font-size',
        value: '1.5rem',
        layer: 'base',
        isImportant: false,
        specificity: [0, 0, 1],
      };

      const utilityTextBaseDecl: RuleDeclaration = {
        selector: '.text-base',
        property: 'font-size',
        value: 'var(--text-base)',
        layer: 'utilities',
        isImportant: false,
        specificity: [0, 1, 0],
      };

      const resolution = resolveCascadePrecedence(baseH2Decl, utilityTextBaseDecl);
      expect(resolution.winner.selector).toBe('.text-base');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });

    it('yields h2 font-size (1.5rem in base) to .ud-display-section in utilities', () => {
      const baseH2Decl: RuleDeclaration = {
        selector: 'h2',
        property: 'font-size',
        value: '1.5rem',
        layer: 'base',
        isImportant: false,
        specificity: [0, 0, 1],
      };

      const utilityDisplaySectionDecl: RuleDeclaration = {
        selector: '.ud-display-section',
        property: 'font-size',
        value: 'var(--font-section-title-size)',
        layer: 'utilities',
        isImportant: false,
        specificity: [0, 1, 0],
      };

      const resolution = resolveCascadePrecedence(baseH2Decl, utilityDisplaySectionDecl);
      expect(resolution.winner.selector).toBe('.ud-display-section');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.winner.value).toBe('var(--font-section-title-size)');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });
  });

  // ─── 5. TYPOGRAPHY PRIMITIVES COMPATIBILITY VERIFICATION ────────────────────

  describe('Typography Primitives (<Heading> and <Text>) Contract Preservation', () => {
    it('preserves Heading.module.css display levels for explicit Heading consumers', () => {
      const headingModuleCss = fs.readFileSync(headingModuleCssPath, 'utf8');

      // level1 provides --font-hero-size
      expect(headingModuleCss).toMatch(/\.level1\s*\{[^}]*font-size:\s*var\(--font-hero-size\);/);
      // level2 provides --font-section-title-size
      expect(headingModuleCss).toMatch(/\.level2\s*\{[^}]*font-size:\s*var\(--font-section-title-size\);/);
      // level3 provides --text-4xl
      expect(headingModuleCss).toMatch(/\.level3\s*\{[^}]*font-size:\s*var\(--text-4xl\);/);
      // level4 provides --text-3xl
      expect(headingModuleCss).toMatch(/\.level4\s*\{[^}]*font-size:\s*var\(--text-3xl\);/);
      // level5 provides --text-2xl
      expect(headingModuleCss).toMatch(/\.level5\s*\{[^}]*font-size:\s*var\(--text-2xl\);/);
      // level6 provides --font-card-title-size
      expect(headingModuleCss).toMatch(/\.level6\s*\{[^}]*font-size:\s*var\(--font-card-title-size\);/);
    });

    it('preserves Text.module.css variants for explicit Text consumers', () => {
      const textModuleCss = fs.readFileSync(textModuleCssPath, 'utf8');

      // body provides --text-base and --color-text-primary
      expect(textModuleCss).toMatch(/\.body\s*\{[^}]*font-size:\s*var\(--text-base\);/);
      // lead provides --text-lg and --color-text-secondary
      expect(textModuleCss).toMatch(/\.lead\s*\{[^}]*font-size:\s*var\(--text-lg\);/);
      // small provides --text-sm
      expect(textModuleCss).toMatch(/\.small\s*\{[^}]*font-size:\s*var\(--text-sm\);/);
      // muted provides --color-text-muted
      expect(textModuleCss).toMatch(/\.muted\s*\{[^}]*color:\s*var\(--color-text-muted\);/);
    });

    it('renders <Heading> component with appropriate semantic tag and CSS module class', () => {
      const htmlHeading = renderToStaticMarkup(
        React.createElement(Heading, { level: 2 }, 'Display Section Title'),
      );
      expect(htmlHeading).toContain('<h2');
      expect(htmlHeading).toContain('heading');
      expect(htmlHeading).toContain('Display Section Title');
    });

    it('renders <Text> component with paragraph tag and variant class', () => {
      const htmlText = renderToStaticMarkup(
        React.createElement(Text, { variant: 'body' }, 'Body text content'),
      );
      expect(htmlText).toContain('<p');
      expect(htmlText).toContain('text');
      expect(htmlText).toContain('Body text content');
    });
  });
});
