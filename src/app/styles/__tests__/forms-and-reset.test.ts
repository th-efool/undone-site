/**
 * Forms and Reset Base Neutralization Test Suite
 *
 * Phase 2, Task 2.2A: Neutralize reset.css and forms.css defaults
 *
 * Verified invariants:
 * 1. Text fields have 2.75rem height and padding-inline.
 * 2. Checkbox has width 1.125rem, height 1.125rem, padding 0, and does NOT inherit text-field padding.
 * 3. Radio has width 1.125rem, height 1.125rem, border-radius 999px.
 * 4. Bare and composite inputs retain transparent background and no borders.
 * 5. Checkbox and radio definitions are reconciled into a single unified implementation.
 * 6. Conflicting global scrollbar styles are removed from forms.css to harmonize with globals.css.
 * 7. reset.css provides universal normalization defaults suitable for @layer base.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import postcss, { Root as PostcssRoot, Rule as PostcssRule } from 'postcss';
import { JSDOM } from 'jsdom';

describe('Forms and Reset Base Neutralization (Phase 2, Task 2.2A)', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const formsCssPath = path.resolve(rootDir, 'src/app/styles/forms.css');
  const resetCssPath = path.resolve(rootDir, 'src/app/styles/reset.css');

  let formsCssSource: string;
  let resetCssSource: string;
  let formsAst: PostcssRoot;
  let resetAst: PostcssRoot;
  let dom: JSDOM;
  let document: Document;

  beforeAll(() => {
    formsCssSource = fs.readFileSync(formsCssPath, 'utf8');
    resetCssSource = fs.readFileSync(resetCssPath, 'utf8');
    formsAst = postcss.parse(formsCssSource);
    resetAst = postcss.parse(resetCssSource);
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
  });

  // ─── 1. RESET.CSS CONTRACT ──────────────────────────────────────────────────

  describe('1. reset.css Universal Normalization Defaults', () => {
    it('defines universal box-sizing border-box on all elements', () => {
      let foundBoxSizing = false;
      resetAst.walkRules((rule) => {
        if (rule.selector.includes('*') && rule.selector.includes('*::before') && rule.selector.includes('*::after')) {
          rule.walkDecls('box-sizing', (decl) => {
            if (decl.value === 'border-box') foundBoxSizing = true;
          });
        }
      });
      expect(foundBoxSizing).toBe(true);
    });

    it('defines margin and padding resets on *', () => {
      let foundMarginReset = false;
      let foundPaddingReset = false;
      resetAst.walkRules((rule) => {
        if (rule.selector === '*') {
          rule.walkDecls('margin', (decl) => {
            if (decl.value === '0') foundMarginReset = true;
          });
          rule.walkDecls('padding', (decl) => {
            if (decl.value === '0') foundPaddingReset = true;
          });
        }
      });
      expect(foundMarginReset).toBe(true);
      expect(foundPaddingReset).toBe(true);
    });

    it('neutralizes button defaults cleanly for @layer base', () => {
      let foundButtonReset = false;
      resetAst.walkRules('button', (rule) => {
        let hasBgNone = false;
        let hasBorderZero = false;
        rule.walkDecls('background', (decl) => {
          if (decl.value === 'none') hasBgNone = true;
        });
        rule.walkDecls('border', (decl) => {
          if (decl.value === '0') hasBorderZero = true;
        });
        if (hasBgNone && hasBorderZero) foundButtonReset = true;
      });
      expect(foundButtonReset).toBe(true);
    });

    it('inherits font and color across form controls', () => {
      let foundFontInherit = false;
      resetAst.walkRules((rule) => {
        if (
          rule.selector.includes('button') &&
          rule.selector.includes('input') &&
          rule.selector.includes('textarea') &&
          rule.selector.includes('select')
        ) {
          rule.walkDecls('font', (decl) => {
            if (decl.value === 'inherit') foundFontInherit = true;
          });
        }
      });
      expect(foundFontInherit).toBe(true);
    });
  });

  // ─── 2. FORMS.CSS CONTROL TYPE SCOPING ───────────────────────────────────────

  describe('2. Control Type Separation in forms.css', () => {
    it('scopes text-like input rules to exclude checkboxes and radios', () => {
      const textInputSelectorPattern =
        /input:not\(\[type=["']checkbox["']\]\):not\(\[type=["']radio["']\]\)/;
      expect(formsCssSource).toMatch(textInputSelectorPattern);

      // Confirm no broad `input, textarea, select { ... }` or `input, select { ... }` rule exists
      let hasBroadUnscopedInput = false;
      formsAst.walkRules((rule) => {
        const selectors = rule.selector.split(',').map((s) => s.trim());
        for (const sel of selectors) {
          if (sel === 'input') {
            hasBroadUnscopedInput = true;
          }
        }
      });
      expect(hasBroadUnscopedInput).toBe(false);
    });

    it('applies 2.75rem height and padding-inline to text-like inputs and selects', () => {
      let foundHeight = false;
      let foundPaddingInline = false;

      formsAst.walkRules((rule) => {
        if (
          rule.selector.includes('input:not([type="checkbox"]):not([type="radio"]') &&
          rule.selector.includes('select')
        ) {
          rule.walkDecls('height', (decl) => {
            if (decl.value === '2.75rem') foundHeight = true;
          });
          rule.walkDecls('padding-inline', (decl) => {
            if (decl.value === 'var(--space-4)') foundPaddingInline = true;
          });
        }
      });

      expect(foundHeight).toBe(true);
      expect(foundPaddingInline).toBe(true);
    });

    it('verifies DOM matching: text fields match text-input rule while checkboxes and radios do not', () => {
      const textInput = document.createElement('input');
      textInput.type = 'text';

      const emailInput = document.createElement('input');
      emailInput.type = 'email';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';

      const radio = document.createElement('input');
      radio.type = 'radio';

      const bareInput = document.createElement('input');
      bareInput.setAttribute('data-bare-input', 'true');

      const textbarInput = document.createElement('input');
      textbarInput.setAttribute('data-textbar-input', 'true');

      // The scoped selector from forms.css
      const scopedSelector =
        'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([data-bare-input]):not([data-textbar-input])';

      // Text fields must match
      expect(textInput.matches(scopedSelector)).toBe(true);
      expect(emailInput.matches(scopedSelector)).toBe(true);

      // Non-text fields must NOT match
      expect(checkbox.matches(scopedSelector)).toBe(false);
      expect(radio.matches(scopedSelector)).toBe(false);
      expect(bareInput.matches(scopedSelector)).toBe(false);
      expect(textbarInput.matches(scopedSelector)).toBe(false);
    });
  });

  // ─── 3. CHECKBOX AND RADIO GEOMETRY ──────────────────────────────────────────

  describe('3. Checkbox and Radio Unified Geometry and Presentation', () => {
    it('sets width: 1.125rem, height: 1.125rem, box-sizing: border-box, and margin: 0', () => {
      let foundWidth = false;
      let foundHeight = false;
      let foundBoxSizing = false;
      let foundMargin = false;

      formsAst.walkRules((rule) => {
        if (rule.selector.includes("input[type='checkbox']") && rule.selector.includes("input[type='radio']")) {
          rule.walkDecls('width', (decl) => {
            if (decl.value === '1.125rem') foundWidth = true;
          });
          rule.walkDecls('height', (decl) => {
            if (decl.value === '1.125rem') foundHeight = true;
          });
          rule.walkDecls('box-sizing', (decl) => {
            if (decl.value === 'border-box') foundBoxSizing = true;
          });
          rule.walkDecls('margin', (decl) => {
            if (decl.value === '0') foundMargin = true;
          });
        }
      });

      expect(foundWidth).toBe(true);
      expect(foundHeight).toBe(true);
      expect(foundBoxSizing).toBe(true);
      expect(foundMargin).toBe(true);
    });

    it('explicitly clears padding and padding-inline to 0 on checkbox and radio', () => {
      let foundPaddingZero = false;
      let foundPaddingInlineZero = false;

      formsAst.walkRules((rule) => {
        if (rule.selector.includes("input[type='checkbox']") && rule.selector.includes("input[type='radio']")) {
          rule.walkDecls('padding', (decl) => {
            if (decl.value === '0') foundPaddingZero = true;
          });
          rule.walkDecls('padding-inline', (decl) => {
            if (decl.value === '0') foundPaddingInlineZero = true;
          });
        }
      });

      expect(foundPaddingZero).toBe(true);
      expect(foundPaddingInlineZero).toBe(true);
    });

    it('verifies checkboxes and radios NEVER match text-field padding rules', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';

      const radio = document.createElement('input');
      radio.type = 'radio';

      // Collect all selectors in forms.css that assign padding-inline: var(--space-4)
      const paddingInlineSelectors: string[] = [];
      formsAst.walkRules((rule) => {
        rule.walkDecls('padding-inline', (decl) => {
          if (decl.value.includes('space-4')) {
            paddingInlineSelectors.push(rule.selector);
          }
        });
      });

      expect(paddingInlineSelectors.length).toBeGreaterThan(0);
      for (const sel of paddingInlineSelectors) {
        // Individual selector branches
        const branches = sel.split(',').map((s) => s.trim());
        for (const branch of branches) {
          expect(checkbox.matches(branch)).toBe(false);
          expect(radio.matches(branch)).toBe(false);
        }
      }
    });

    it('sets radio border-radius to 999px (circular)', () => {
      let foundRadioRadius = false;
      formsAst.walkRules("input[type='radio']", (rule) => {
        rule.walkDecls('border-radius', (decl) => {
          if (decl.value === '999px') foundRadioRadius = true;
        });
      });
      expect(foundRadioRadius).toBe(true);
    });

    it('sets checkbox border-radius to 0.35rem', () => {
      let foundCheckboxRadius = false;
      formsAst.walkRules("input[type='checkbox']", (rule) => {
        rule.walkDecls('border-radius', (decl) => {
          if (decl.value === '0.35rem') foundCheckboxRadius = true;
        });
      });
      expect(foundCheckboxRadius).toBe(true);
    });

    it('reconciles duplicate checkbox/radio blocks into a single unified implementation', () => {
      // Find all rules matching both checkbox and radio
      const unifiedBlocks: PostcssRule[] = [];
      formsAst.walkRules((rule) => {
        if (rule.selector.includes("input[type='checkbox']") && rule.selector.includes("input[type='radio']")) {
          // Exclude pseudo-classes or pseudo-elements
          if (
            !rule.selector.includes(':before') &&
            !rule.selector.includes('::before') &&
            !rule.selector.includes(':hover') &&
            !rule.selector.includes(':active') &&
            !rule.selector.includes(':checked') &&
            !rule.selector.includes(':focus') &&
            !rule.selector.includes(':disabled')
          ) {
            unifiedBlocks.push(rule);
          }
        }
      });

      // There must be exactly ONE base checkbox/radio declaration block
      expect(unifiedBlocks.length).toBe(1);

      // Verify the old conflicting dimensions (1.1rem and 1.15rem) are gone
      expect(formsCssSource).not.toMatch(/width:\s*1\.1rem;/);
      expect(formsCssSource).not.toMatch(/height:\s*1\.1rem;/);
      expect(formsCssSource).not.toMatch(/width:\s*1\.15rem;/);
      expect(formsCssSource).not.toMatch(/height:\s*1\.15rem;/);
    });

    it('preserves accessible focus rings on :focus-visible for checkbox and radio', () => {
      let foundFocusVisible = false;
      formsAst.walkRules((rule) => {
        if (
          rule.selector.includes("input[type='checkbox']:focus-visible") &&
          rule.selector.includes("input[type='radio']:focus-visible")
        ) {
          rule.walkDecls('box-shadow', (decl) => {
            if (decl.value.includes('color-brand-rgb')) foundFocusVisible = true;
          });
        }
      });
      expect(foundFocusVisible).toBe(true);
    });
  });

  // ─── 4. BARE AND COMPOSITE INPUTS ────────────────────────────────────────────

  describe('4. Bare and Composite Inputs (TextBar, Capsules, Inline)', () => {
    it('preserves transparent background and border none on [data-bare-input]', () => {
      let foundBareStyles = false;
      formsAst.walkRules((rule) => {
        if (rule.selector.includes('input[data-bare-input]')) {
          let hasTransparentBg = false;
          let hasBorderNone = false;
          let hasZeroPadding = false;

          rule.walkDecls('background', (decl) => {
            if (decl.value.includes('transparent')) hasTransparentBg = true;
          });
          rule.walkDecls('border', (decl) => {
            if (decl.value === 'none') hasBorderNone = true;
          });
          rule.walkDecls('padding', (decl) => {
            if (decl.value === '0') hasZeroPadding = true;
          });

          if (hasTransparentBg && hasBorderNone && hasZeroPadding) {
            foundBareStyles = true;
          }
        }
      });
      expect(foundBareStyles).toBe(true);
    });

    it('preserves transparent background and border none on [data-textbar-input]', () => {
      let foundTextbarStyles = false;
      formsAst.walkRules((rule) => {
        if (rule.selector.includes('input[data-textbar-input]')) {
          let hasTransparentBg = false;
          let hasBorderNone = false;

          rule.walkDecls('background', (decl) => {
            if (decl.value.includes('transparent')) hasTransparentBg = true;
          });
          rule.walkDecls('border', (decl) => {
            if (decl.value === 'none') hasBorderNone = true;
          });

          if (hasTransparentBg && hasBorderNone) {
            foundTextbarStyles = true;
          }
        }
      });
      expect(foundTextbarStyles).toBe(true);
    });

    it('suppresses focus rings and borders on bare and textbar inputs on :focus / :focus-visible', () => {
      let foundFocusSuppression = false;
      formsAst.walkRules((rule) => {
        if (
          rule.selector.includes('input[data-bare-input]:focus') ||
          rule.selector.includes('input[data-textbar-input]:focus')
        ) {
          let hasBorderNone = false;
          let hasBoxShadowNone = false;
          rule.walkDecls('border', (decl) => {
            if (decl.value === 'none') hasBorderNone = true;
          });
          rule.walkDecls('box-shadow', (decl) => {
            if (decl.value === 'none') hasBoxShadowNone = true;
          });
          if (hasBorderNone && hasBoxShadowNone) {
            foundFocusSuppression = true;
          }
        }
      });
      expect(foundFocusSuppression).toBe(true);
    });
  });

  // ─── 5. SCROLLBAR HARMONIZATION ──────────────────────────────────────────────

  describe('5. Scrollbar Harmonization with globals.css', () => {
    it('confirms conflicting * { scrollbar-width: thin; } is removed from forms.css', () => {
      let hasConflictingScrollbarWidth = false;
      formsAst.walkRules((rule) => {
        if (rule.selector === '*') {
          rule.walkDecls('scrollbar-width', (decl) => {
            if (decl.value === 'thin') hasConflictingScrollbarWidth = true;
          });
        }
      });
      expect(hasConflictingScrollbarWidth).toBe(false);
      expect(formsCssSource).not.toContain('scrollbar-width: thin');
    });

    it('confirms ::-webkit-scrollbar is not overridden with width: 12px in forms.css', () => {
      let has12pxWebkitScrollbar = false;
      formsAst.walkRules((rule) => {
        if (rule.selector.includes('::-webkit-scrollbar')) {
          rule.walkDecls('width', (decl) => {
            if (decl.value === '12px') has12pxWebkitScrollbar = true;
          });
        }
      });
      expect(has12pxWebkitScrollbar).toBe(false);
    });
  });

  // ─── 6. MOBILE RESPONSIVENESS ────────────────────────────────────────────────

  describe('6. Mobile Form Adjustments', () => {
    it('scopes touch-target-min height in mobile media queries away from checkboxes/radios', () => {
      let foundScopedMobileRule = false;
      formsAst.walkAtRules('media', (atRule) => {
        if (atRule.params.includes('max-width: 768px')) {
          atRule.walkRules((rule) => {
            if (
              rule.selector.includes('input:not([type="checkbox"]):not([type="radio"]') &&
              rule.selector.includes('select')
            ) {
              rule.walkDecls('height', (decl) => {
                if (decl.value === 'var(--touch-target-min)') foundScopedMobileRule = true;
              });
            }
          });
        }
      });
      expect(foundScopedMobileRule).toBe(true);
    });
  });
});
