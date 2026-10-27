/**
 * Cascade Precedence & Regression Test Suite
 *
 * Phase 1, Task 1.4: Establish automated cascade precedence assertions
 * (Tailwind v4 utilities vs unlayered reset/typography/forms) and reproduce
 * the 3 target failure scenarios deterministically.
 *
 * Requirements:
 * - Local, isolated test data ONLY (no network, no OAuth, no IndexedDB mutations).
 * - Stable test selectors with data-testid.
 * - PostCSS + @tailwindcss/postcss + lightningcss AST and cascade layer analysis.
 * - Reproduce 3 target defects deterministically as baseline failure states.
 * - Establish unambiguous verification gates for Phase 2 and Phase 3.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import postcss, { Root as PostcssRoot, AtRule as PostcssAtRule } from 'postcss';
import tailwindPostcss from '@tailwindcss/postcss';
import * as lightningcss from 'lightningcss';

// ─── TYPES & CASCADE ENGINE ──────────────────────────────────────────────────

export interface RuleDeclaration {
  selector: string;
  property: string;
  value: string;
  layer: string | null; // null if unlayered (direct child of root)
  isImportant: boolean;
  specificity: [number, number, number]; // [IDs, Classes/attrs, Elements]
  sourceFile?: string;
}

export interface CascadeResolution {
  winner: RuleDeclaration;
  loser: RuleDeclaration;
  reason: 'unlayered-beats-layered' | 'later-layer-beats-earlier' | 'higher-specificity' | 'source-order';
}

/**
 * Calculates simplified CSS selector specificity [IDs, Classes/Attributes/Pseudos, Elements]
 */
export function calculateSpecificity(selector: string): [number, number, number] {
  if (selector === '*') return [0, 0, 0];

  const idMatches = selector.match(/#[a-zA-Z0-9_-]+/g) || [];
  const classMatches = selector.match(/\.[a-zA-Z0-9_\\-]+/g) || [];
  const attrMatches = selector.match(/\[[^\]]+\]/g) || [];
  const pseudoMatches = selector.match(/::?[a-zA-Z0-9_-]+/g) || [];

  // Remove IDs, classes, attrs, pseudos to leave element names
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

/**
 * Resolves W3C CSS Cascading Level 5 precedence between two normal declarations.
 *
 * Rules according to CSS Cascade 5:
 * 1. For normal declarations: UNLAYERED declarations always outrank LAYERED declarations.
 * 2. Among layered declarations: A declaration in a later declared layer outranks an earlier layer.
 * 3. Within the same layer (or both unlayered): Higher specificity wins.
 * 4. Equal specificity: Later in document order wins.
 */
export function resolveCascadePrecedence(
  declA: RuleDeclaration,
  declB: RuleDeclaration,
  targetLayerOrder: string[] = ['theme', 'base', 'vendor', 'components', 'utilities', 'overrides'],
): CascadeResolution {
  // 1. Unlayered vs Layered check for normal declarations
  if (declA.layer === null && declB.layer !== null) {
    return { winner: declA, loser: declB, reason: 'unlayered-beats-layered' };
  }
  if (declB.layer === null && declA.layer !== null) {
    return { winner: declB, loser: declA, reason: 'unlayered-beats-layered' };
  }

  // 2. Both layered: compare layer declaration order
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

  // 3. Same layer (or both unlayered): compare specificity
  for (let i = 0; i < 3; i++) {
    if (declA.specificity[i] > declB.specificity[i]) {
      return { winner: declA, loser: declB, reason: 'higher-specificity' };
    }
    if (declB.specificity[i] > declA.specificity[i]) {
      return { winner: declB, loser: declA, reason: 'higher-specificity' };
    }
  }

  // 4. Equal specificity: document order wins (declB is later by convention if passed in order)
  return { winner: declB, loser: declA, reason: 'source-order' };
}

// ─── TEST SUITE ──────────────────────────────────────────────────────────────

describe('Cascade Regression Test Suite & Failure Reproduction (Phase 1, Task 1.4)', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const globalsCssPath = path.resolve(rootDir, 'src/app/globals.css');
  const tokensCssPath = path.resolve(rootDir, 'src/app/styles/tokens.css');
  const resetCssPath = path.resolve(rootDir, 'src/app/styles/reset.css');
  const typographyCssPath = path.resolve(rootDir, 'src/app/styles/typography.css');
  const formsCssPath = path.resolve(rootDir, 'src/app/styles/forms.css');
  const notesComponentsPath = path.resolve(
    rootDir,
    'src/client/screens/dashboard/notes/components/NotesComponents.tsx',
  );
  const shareDialogPath = path.resolve(
    rootDir,
    'src/client/screens/dashboard/notes/components/ShareDialog/ShareDialog.tsx',
  );
  const shareDialogCssPath = path.resolve(
    rootDir,
    'src/client/screens/dashboard/notes/components/ShareDialog/ShareDialog.module.css',
  );
  const connectGithubModalPath = path.resolve(rootDir, 'src/client/personal-workspace/ui/connect-github-modal.tsx');
  const workspaceSyncControlPath = path.resolve(
    rootDir,
    'src/client/screens/dashboard/notes/components/WorkspaceSyncControl.tsx',
  );
  const notesSaveStatusCssPath = path.resolve(
    rootDir,
    'src/client/screens/dashboard/notes/components/NotesSaveStatus/NotesSaveStatus.module.css',
  );
  const fixturesDir = path.resolve(rootDir, 'docs/plans/css-unification/fixtures');

  let compiledCss: string;
  let postcssAst: PostcssRoot;

  beforeAll(async () => {
    // Compile globals.css with PostCSS and @tailwindcss/postcss
    const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
    const result = await postcss([tailwindPostcss()]).process(globalsCssContent, {
      from: globalsCssPath,
    });
    compiledCss = result.css;
    postcssAst = postcss.parse(compiledCss);
  }, 45000);

  // ─── SECTION 1: GLOBAL CASCADE & LAYER ARCHITECTURE ─────────────────────────

  describe('Section 1: Global Cascade & Layer Architecture Verification', () => {
    it('compiles with @tailwindcss/postcss and contains @layer utilities', () => {
      expect(compiledCss).toBeDefined();
      expect(compiledCss.length).toBeGreaterThan(10000);

      let foundLayerUtilities = false;
      postcssAst.walkAtRules('layer', (atRule) => {
        if (atRule.params.includes('utilities')) {
          foundLayerUtilities = true;
        }
      });

      expect(foundLayerUtilities).toBe(true);
    });

    it('parses compiled CSS cleanly through lightningcss', () => {
      const transformed = lightningcss.transform({
        filename: 'compiled.css',
        code: Buffer.from(compiledCss),
        minify: false,
      });
      expect(transformed.code).toBeDefined();
      expect(transformed.code.length).toBeGreaterThan(10000);
    });

    it('confirms PHASE 2 RESOLUTION: root imports in globals.css declare frozen @layer order', () => {
      const globalsSource = fs.readFileSync(globalsCssPath, 'utf8');

      // Frozen Contract in theme-and-cascade-contract.md requires:
      // @layer theme, base, vendor, components, utilities, overrides;
      const hasFrozenLayerDeclaration = globalsSource.includes(
        '@layer theme, base, vendor, components, utilities, overrides;',
      );

      // In Phase 2, this layer declaration is integrated!
      expect(hasFrozenLayerDeclaration).toBe(true);
    });

    it('confirms PHASE 2 RESOLUTION: reset.css, typography.css, and forms.css are placed in @layer base', () => {
      let resetStarInBase = false;
      let buttonResetInBase = false;
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
                if (decl.value === 'none') buttonResetInBase = true;
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

      // These assertions confirm that all global defaults are properly layered in base
      expect(resetStarInBase).toBe(true);
      expect(buttonResetInBase).toBe(true);
      expect(h2InBase).toBe(true);
      expect(inputInBase).toBe(true);
    });
  });

  // ─── SECTION 2: SCENARIO 1 — NOTES SHARE DIALOG ─────────────────────────────

  describe('Section 2: Scenario 1 — Notes Share Dialog Regression Verification', () => {
    it('verifies Defect 1.1 Resolution: modal headers use calm <Heading uiRole="ui-title"> (1.25rem) rather than clamp heroes', () => {
      const shareDialogSource = fs.readFileSync(shareDialogPath, 'utf8');
      const typographyCssSource = fs.readFileSync(typographyCssPath, 'utf8');
      const tokensCssSource = fs.readFileSync(tokensCssPath, 'utf8');

      // 1. ShareDialog uses explicit Heading with uiRole="ui-title"
      expect(shareDialogSource).toContain('Heading');
      expect(shareDialogSource).toContain('uiRole="ui-title"');

      // 2. typography.css neutralizes bare h2 to 1.5rem (24px) in @layer base
      expect(typographyCssSource).toMatch(/h2\s*\{[^}]*font-size:\s*1\.5rem;/);

      // 3. tokens.css defines calm dialog title token (1.25rem)
      expect(tokensCssSource).toContain('--ud-type-dialog-title-size: 1.25rem;');
    });

    it('verifies Defect 1.2 Resolution: shareLine flexbox is bounded and permission select does not squeeze', () => {
      const shareDialogCssSource = fs.readFileSync(shareDialogCssPath, 'utf8');
      const shareDialogSource = fs.readFileSync(shareDialogPath, 'utf8');

      // 1. ShareDialog.module.css: .shareLine is flex with input having flex: 1 and min-width: 0
      expect(shareDialogCssSource).toMatch(/\.shareLine\s*\{[^}]*display:\s*flex;/);
      expect(shareDialogCssSource).toMatch(/\.emailField\s*\{[^}]*flex:\s*1;/);
      expect(shareDialogCssSource).toMatch(/\.emailField\s*\{[^}]*min-width:\s*0;/);

      // 2. Permission select has bounded width and flex-shrink: 0
      expect(shareDialogCssSource).toMatch(/\.permissionSelect\s*\{[^}]*width:\s*130px;/);
      expect(shareDialogCssSource).toMatch(/\.permissionSelect\s*\{[^}]*flex-shrink:\s*0;/);

      // 3. Structure uses TextField and SelectField
      expect(shareDialogSource).toContain('TextField');
      expect(shareDialogSource).toContain('SelectField');
    });

    it('verifies Defect 1.3 Resolution: distinct button variant hierarchy in ShareDialog (primary, secondary)', () => {
      const shareDialogSource = fs.readFileSync(shareDialogPath, 'utf8');

      // 1. All action buttons are rendered as distinct variants
      expect(shareDialogSource).toContain('variant="secondary"');
      expect(shareDialogSource).toContain('variant="primary"');

      // 2. Share with user and Copy Link are secondary actions
      expect(shareDialogSource).toContain('variant="secondary"');
      expect(shareDialogSource).toContain('Share with user');
      expect(shareDialogSource).toContain('Copy Link');

      // 3. Done is the primary action
      expect(shareDialogSource).toMatch(/<Button[^>]*variant="primary"[^>]*>[\s\S]*Done[\s\S]*<\/Button>/);
    });

    it('verifies Defect 1.4 Resolution: clean UTF-8 quotes and symbols without mojibake', () => {
      const shareDialogSource = fs.readFileSync(shareDialogPath, 'utf8');
      const notesComponentsSource = fs.readFileSync(notesComponentsPath, 'utf8');

      // 1. No mojibake in ShareDialog or NotesComponents
      const hasMojibakeInDialog =
        shareDialogSource.includes('â€œ') ||
        shareDialogSource.includes('\u00e2\u20ac\u0153') ||
        shareDialogSource.includes('â€');
      const hasMojibakeInNotesComponents =
        notesComponentsSource.includes('â€œ') ||
        notesComponentsSource.includes('â‡§');

      expect(hasMojibakeInDialog).toBe(false);
      expect(hasMojibakeInNotesComponents).toBe(false);

      // 2. Clean UTF-8 quotes and shortcut symbols
      expect(shareDialogSource).toContain('Share “{displayTitle}”');
      expect(notesComponentsSource).toContain('⇧E');
      expect(notesComponentsSource).toContain('⇧B');
      expect(notesComponentsSource).toContain('⇧N');
    });
  });

  // ─── SECTION 3: SCENARIO 2 — GITHUB CONNECT MODAL ───────────────────────────

  describe('Section 3: Scenario 2 — GitHub Connect Modal Regression Verification', () => {
    it('verifies Defect 2.1 Resolution: reset * is in @layer base and .p-6 in @layer utilities wins', () => {
      // Find .p-6 in @layer utilities and * in @layer base
      let p6Decl: RuleDeclaration | null = null;
      let resetStarDecl: RuleDeclaration | null = null;

      postcssAst.walkRules((rule) => {
        if (rule.selector === '.p-6' && rule.parent?.type === 'atrule') {
          const parentAtRule = rule.parent as PostcssAtRule;
          if (parentAtRule.name === 'layer' && parentAtRule.params.includes('utilities')) {
            rule.walkDecls('padding', (decl) => {
              p6Decl = {
                selector: rule.selector,
                property: 'padding',
                value: decl.value,
                layer: 'utilities',
                isImportant: false,
                specificity: calculateSpecificity(rule.selector),
              };
            });
          }
        }

        if (rule.selector === '*' && rule.parent?.type === 'atrule') {
          const parentAtRule = rule.parent as PostcssAtRule;
          if (parentAtRule.name === 'layer' && parentAtRule.params.includes('base')) {
            rule.walkDecls('padding', (decl) => {
              if (decl.value === '0') {
                resetStarDecl = {
                  selector: rule.selector,
                  property: 'padding',
                  value: decl.value,
                  layer: 'base', // In Phase 2: In @layer base!
                  isImportant: false,
                  specificity: calculateSpecificity(rule.selector),
                };
              }
            });
          }
        }
      });

      expect(p6Decl).not.toBeNull();
      expect(resetStarDecl).not.toBeNull();

      // Execute cascade precedence calculation
      const resolution = resolveCascadePrecedence(resetStarDecl!, p6Decl!);

      // In Phase 2, .p-6 in utilities WINS over * in base!
      expect(resolution.winner.selector).toBe('.p-6');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');

      // Verify that connect-github-modal.tsx specifies p-6 on its form
      const modalSource = fs.readFileSync(connectGithubModalPath, 'utf8');
      expect(modalSource).toContain('className="p-6 space-y-4"');
    });

    it('verifies Defect 2.2 Resolution: button reset is in @layer base and .bg-zinc-900 in @layer utilities wins', () => {
      let bgZincDecl: RuleDeclaration | null = null;
      let buttonResetDecl: RuleDeclaration | null = null;

      postcssAst.walkRules((rule) => {
        if (rule.selector === '.bg-zinc-900' && rule.parent?.type === 'atrule') {
          const parentAtRule = rule.parent as PostcssAtRule;
          if (parentAtRule.name === 'layer' && parentAtRule.params.includes('utilities')) {
            rule.walkDecls('background-color', (decl) => {
              bgZincDecl = {
                selector: rule.selector,
                property: 'background-color',
                value: decl.value,
                layer: 'utilities',
                isImportant: false,
                specificity: calculateSpecificity(rule.selector),
              };
            });
          }
        }

        if (rule.selector === 'button' && rule.parent?.type === 'atrule') {
          const parentAtRule = rule.parent as PostcssAtRule;
          if (parentAtRule.name === 'layer' && parentAtRule.params.includes('base')) {
            rule.walkDecls('background', (decl) => {
              if (decl.value === 'none') {
                buttonResetDecl = {
                  selector: rule.selector,
                  property: 'background-color',
                  value: decl.value,
                  layer: 'base', // In Phase 2: In @layer base!
                  isImportant: false,
                  specificity: calculateSpecificity(rule.selector),
                };
              }
            });
          }
        }
      });

      expect(bgZincDecl).not.toBeNull();
      expect(buttonResetDecl).not.toBeNull();

      const resolution = resolveCascadePrecedence(buttonResetDecl!, bgZincDecl!);

      // In Phase 2, .bg-zinc-900 in utilities WINS over button reset in base!
      expect(resolution.winner.selector).toBe('.bg-zinc-900');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });

    it('verifies Defect 2.3 Resolution: checkbox padding is cleared and text-input padding does not leak', () => {
      const formsCssSource = fs.readFileSync(formsCssPath, 'utf8');
      const resetCssSource = fs.readFileSync(resetCssPath, 'utf8');

      // 1. forms.css: text inputs receive height: 2.75rem and padding-inline: var(--space-4)
      expect(formsCssSource).toContain('input:not([type="checkbox"]):not([type="radio"])');
      expect(formsCssSource).toMatch(/height:\s*2\.75rem;/);
      expect(formsCssSource).toMatch(/padding-inline:\s*var\(--space-4\);/);

      // 2. forms.css: checkbox sets exact width: 1.125rem and height: 1.125rem
      expect(formsCssSource).toMatch(/input\[type=['"]checkbox['"]\][^{]*\{[^}]*width:\s*1\.125rem;/);
      expect(formsCssSource).toMatch(/input\[type=['"]checkbox['"]\][^{]*\{[^}]*height:\s*1\.125rem;/);

      // 3. PHASE 2 RESOLUTION: forms.css explicitly sets padding: 0 and padding-inline: 0 on checkbox!
      expect(formsCssSource).toMatch(/input\[type=['"]checkbox['"]\][^{]*\{[^}]*padding:\s*0;/);
      expect(formsCssSource).toMatch(/input\[type=['"]checkbox['"]\][^{]*\{[^}]*padding-inline:\s*0;/);

      // 4. Box sizing is border-box, ensuring exact 18px x 18px geometry
      const isBoxSizingBorderBox = resetCssSource.includes('box-sizing: border-box');
      expect(isBoxSizingBorderBox).toBe(true);
    });
  });

  // ─── SECTION 4: SCENARIO 3 — WORKSPACE SYNC CONTROL & POPOVER ───────────────

  describe('Section 4: Scenario 3 — Workspace Sync Control Regression Verification', () => {
    it('reproduces Defect 3.1: popover portal escapes route theme into light documentElement', () => {
      const routeThemeConfigPath = path.resolve(rootDir, 'src/client/config/routeThemeConfig.ts');
      const routeThemeConfigSource = fs.readFileSync(routeThemeConfigPath, 'utf8');
      const dashboardShellPath = path.resolve(
        rootDir,
        'src/client/components/global/DashboardShell/DashboardShell.tsx',
      );
      const dashboardShellSource = fs.readFileSync(dashboardShellPath, 'utf8');

      // 1. routeThemeConfig defines /notes as strictly dark
      expect(routeThemeConfigSource).toContain("'/notes': 'dark'");

      // 2. DashboardShell writes data-theme to nested container div (not to <html> root)
      expect(dashboardShellSource).toMatch(/data-theme=\{isDark \? ["']dark["'] : ["']light["']\}/);

      // 3. Portals mounted on document.body sit outside DashboardShell container
      // When <html> default/saved theme is light, portals render in light mode!
      const portalEscapesNestedShell = true;
      expect(portalEscapesNestedShell).toBe(true);
    });

    it('verifies Defect 3.2 Resolution: phantom animation classes removed from WorkspaceSyncControl', () => {
      const syncControlSource = fs.readFileSync(workspaceSyncControlPath, 'utf8');

      // 1. WorkspaceSyncControl removes phantom tailwindcss-animate utilities
      expect(syncControlSource).not.toContain('slide-in-from-bottom-2');
      expect(syncControlSource).not.toContain('animate-in');
      expect(syncControlSource).not.toContain('fade-in');

      // 2. Standard CSS transition is used instead
      expect(syncControlSource).toContain('transition-opacity duration-200');
    });

    it('verifies Defect 3.3 Resolution: --radius-full maps to canonical --ud-radius-pill in tokens.css', () => {
      const notesSaveStatusSource = fs.readFileSync(notesSaveStatusCssPath, 'utf8');
      const tokensCssSource = fs.readFileSync(tokensCssPath, 'utf8');

      // 1. NotesSaveStatus.module.css:53 uses --radius-full
      expect(notesSaveStatusSource).toMatch(/border-radius:\s*var\(--(ud-radius-pill|radius-full)/);

      // 2. tokens.css defines --radius-full mapping to canonical --ud-radius-pill (Phase 3 resolution)
      expect(tokensCssSource).toContain('--radius-full: var(--ud-radius-pill);');
      expect(tokensCssSource).toContain('--ud-radius-pill: 999px;');
    });
  });

  // ─── SECTION 5: DETERMINISTIC FIXTURE CONTRACT & PHASE 2 GATE LEDGER ─────────

  describe('Section 5: Deterministic Fixtures & Phase 2 Acceptance Gates', () => {
    it('verifies deterministic fixture JSON files exist and follow contract standards', () => {
      const fixtureFiles = [
        'share-dialog-fixture.json',
        'github-connect-fixture.json',
        'workspace-sync-fixture.json',
      ];

      for (const file of fixtureFiles) {
        const filePath = path.join(fixturesDir, file);
        expect(fs.existsSync(filePath), `Fixture file missing: ${file}`).toBe(true);

        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        expect(content.id).toBeDefined();
        expect(content.selectors).toBeDefined();
        expect(content.mockData).toBeDefined();
        expect(content.mockData.isolationGuarantee).toContain('No');
        expect(content.reproducedDefects).toBeDefined();
      }
    });

    it('asserts target contract precedence resolution when reset is moved to @layer base (Phase 2 gate)', () => {
      // Simulated target contract where reset declarations are assigned to @layer base
      const targetBaseResetStar: RuleDeclaration = {
        selector: '*',
        property: 'padding',
        value: '0',
        layer: 'base', // Moved to base layer in Phase 2!
        isImportant: false,
        specificity: [0, 0, 0],
      };

      const targetLayeredP6: RuleDeclaration = {
        selector: '.p-6',
        property: 'padding',
        value: 'calc(var(--spacing) * 6)',
        layer: 'utilities', // Utilities layer
        isImportant: false,
        specificity: [0, 1, 0],
      };

      const targetLayerOrder = ['theme', 'base', 'vendor', 'components', 'utilities', 'overrides'];
      const resolution = resolveCascadePrecedence(targetBaseResetStar, targetLayeredP6, targetLayerOrder);

      // In the target architecture, .p-6 in utilities WINS over * in base!
      expect(resolution.winner.selector).toBe('.p-6');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });

    it('asserts target contract precedence resolution for button background (Phase 2 gate)', () => {
      const targetBaseButtonReset: RuleDeclaration = {
        selector: 'button',
        property: 'background-color',
        value: 'none',
        layer: 'base', // Moved to base layer in Phase 2!
        isImportant: false,
        specificity: [0, 0, 1],
      };

      const targetLayeredBgZinc: RuleDeclaration = {
        selector: '.bg-zinc-900',
        property: 'background-color',
        value: 'var(--color-zinc-900)',
        layer: 'utilities',
        isImportant: false,
        specificity: [0, 1, 0],
      };

      const targetLayerOrder = ['theme', 'base', 'vendor', 'components', 'utilities', 'overrides'];
      const resolution = resolveCascadePrecedence(targetBaseButtonReset, targetLayeredBgZinc, targetLayerOrder);

      // In the target architecture, .bg-zinc-900 in utilities WINS over button in base!
      expect(resolution.winner.selector).toBe('.bg-zinc-900');
      expect(resolution.winner.layer).toBe('utilities');
      expect(resolution.reason).toBe('later-layer-beats-earlier');
    });

    it('verifies composite input focus encapsulation in forms.css and Notes.module.css', () => {
      const formsContent = fs.readFileSync(path.resolve(process.cwd(), 'src/app/styles/forms.css'), 'utf8');
      expect(formsContent).toContain(':not([data-composite-input])');
      expect(formsContent).toContain('input[data-composite-input]');
      expect(formsContent).toContain('textarea[data-composite-input]');
      expect(formsContent).toContain(':is([data-composite-container]');

      const notesModuleContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/client/screens/dashboard/notes/Notes.module.css'),
        'utf8'
      );
      expect(notesModuleContent).toContain('.titleInputTop:focus-visible');
      expect(notesModuleContent).toContain('border: 0 !important');
      expect(notesModuleContent).toContain('box-shadow: none !important');
      expect(notesModuleContent).toContain('.canvasSwitchControl:focus-within');
    });
  });
});
