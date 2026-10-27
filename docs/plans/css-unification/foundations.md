# Foundations: phases 0–3

Follow the [execution model](README.md). Steps marked parallel run only after their stated prerequisite. All file locations below are starting scopes; verify exact callers and ownership against the current checkout.

## Phase 0 — Establish baseline and complete inventories

**Purpose:** avoid fixing one screenshot while breaking unseen routes or overwriting existing work.

### Steps

0.1 Lead records working-tree changes, current runtime/build configuration, available test tools, and known authentication constraints. Read repository memory and query graphify before exploration.

0.2 Agent A inventories CSS entry points and compiled output: root imports, module imports, vendor chunks, layers, global selectors, emitted utilities, missing module exports, and duplicate selectors. Check `execution/` and existing checks before proposing scripts. Separate confirmed missing definitions from dynamic/composed cases.

0.3 Agent B inventories theme/token/font ownership: every theme writer and reader, route policy, portals, runtime variables, alias chains, absent tokens, font source/load paths, and native color-scheme. Identify where shared tokens change meaning across components.

0.4 Agent C prepares the route/state matrix and captures baseline evidence through the sole browser session. Use deterministic non-sensitive fixtures where authentication is unavailable; label those as fixture coverage. Include the Notes Share, connection, and sync popover states from the screenshots.

0.5 Lead reconciles findings into a migration ledger: item ID, source, owner, severity, affected consumers, intended phase, and evidence. Mark unknown/unverified items explicitly. Audit any repository styling guidance encountered for conflicts with the proposed ownership model; do not infer a prompt cause from bad rendering.

### Ownership and outputs

- A: inventory evidence only; no application edits.
- B: ownership evidence only; no application edits.
- C: baseline captures and fixture design; no production behavior changes.
- Lead: durable inventory summary and ledger. Temporary captures/logs belong in `.tmp/css-unification/p0/`, not `MEMORY/`.

**Gate P0:** every global stylesheet and theme writer has an owner; initial missing-class/token findings are classified; all required route/states are captured or explicitly blocked with a fixture/access strategy. No blocked scenario is marked passed.

## Phase 1 — Freeze contracts and build regression fixtures

**Prerequisite:** P0 inventory. **Purpose:** agents must implement the same system, not three individually reasonable systems.

### Steps

1.1 Lead selects contracts using the existing report as a starting point:

- CSS Modules own component presentation; role-based local names, such as `.dialog`, `.header`, `.title`, `.actions`.
- Explicit global integration classes use `ud-`; no generic public `.modal`/`.button` API.
- Canonical application tokens use `--ud-*`; existing names remain compatibility aliases during migration.
- Separate application typography roles from editorial/display roles.
- Target layer order: `theme, base, vendor, components, utilities, overrides`. A temporary unlayered legacy inventory tracks exceptions until migration finishes.
- Feature CSS cannot repair shared defaults with new specificity/important escalations.

1.2 Agent A produces the token map: existing name/value, semantic role, new owner/name, consumers, runtime/vendor exceptions, alias direction, retirement gate. Avoid cycles and do not change numeric scales during alias introduction.

1.3 Agent B reviews existing Button, Typography, Tooltip, TextBar, Dialog/Popover usages and proposes the smallest shared API changes. Map callers and accessibility requirements. Specify which CSS properties a consumer may override; avoid a generic component with dozens of speculative variants.

1.4 Agent C establishes browser regression fixtures for the known failures and unit tests for behavior that needs protection. Include compiled CSS checks but do not use JSDOM as proof of cascade correctness. Give all fixture states stable selectors and local, isolated test data.

1.5 Lead freezes theme precedence: keep explicit dark route policy initially; on routes without an explicit policy, retain the existing saved-preference/default behavior until the inventory resolves any conflicts. Define document/portal ownership, initial render/hydration behavior, and whether nested opposite-theme regions are supported. Choose one strategy rather than letting agents implement both a global theme and a competing portal theme.

1.6 Lead records the contract and tests together. New regression expectations may initially fail because they describe the desired repair; label expected failures precisely and remove temporary expected-failure handling as each corresponding fix lands.

**Gate P1:** canonical names, aliases, layer policy, theme precedence, primitive APIs, and required states are unambiguous. At least one deterministic browser case reproduces each principal failure; fixtures cannot send real emails, publish repositories, or alter real notes.

## Phase 2 — Correct cascade and global defaults

**Prerequisite:** P1. **Purpose:** restore component intent without an unrelated redesign.

### Parallel assignments

| Owner | Write scope | Work |
| --- | --- | --- |
| A | `styles/reset.css`, `styles/forms.css`, dedicated control tests | Neutral reset; distinguish control types; reconcile duplicate checkbox/radio definitions; preserve composite focus behavior |
| B | `styles/typography.css`, exact audited typography consumer modules | Replace implicit visual hierarchy with explicit roles while preserving intended marketing/editorial appearance |
| C | Regression fixtures/test-only scope | Independent cascade audit; run checks after code stabilizes; inspect mobile/native/keyboard states |
| Lead | `globals.css`, `styles/layout.css`, shared integration/config | Declare ordering and import layers; coordinate exceptions and combined build |

### Steps

2.1 Lead freezes consumer compatibility requirements from P0/P1. Agent B first adds explicit styling to consumers that currently rely on global display-sized headings; do not neutralize headings before those replacements are ready.

2.2 Agents A/B implement their disjoint changes in parallel. Keep normal text defaults useful, but stop global elements from imposing complete component designs. Correct checkbox/radio padding, dimensions, appearance, and disabled/focus states separately from text fields.

2.3 Lead integrates the import/layer changes. Verify the actual emitted layer order, including Tailwind imports; placing a declaration after Tailwind has already established order is not an adequate check.

2.4 Lead and C inspect why any remaining override wins. Explicitly record legacy unlayered modules; do not move isolated modules into layers while leaving competing broad rules unlayered without testing that boundary.

2.5 Resolve scrollbar ownership and preserve accessibility/print behavior with a documented policy. Avoid expanding this step into a scrollbar visual redesign.

2.6 Run shared browser probes, representative route checks, focused behavioral tests, lint/type checks relevant to changed files, and graphify update. Integrate only after all writes are stable.

**Gate P2:** `p-6` resolves to 24px under the current spacing contract; the small-title utility resolves to its documented current token rather than the global 48px heading; button padding/background obey intent; checkbox geometry is not expanded by text-input padding. Existing focus/disabled/native-control behavior passes. All unexplained visual regressions are resolved, not snapshot-approved away.

## Phase 3 — Unify tokens, theme propagation, and font loading

**Prerequisite:** P2. **Purpose:** components agree on values and theme across route boundaries and portals.

### Parallel assignments

| Owner | Write scope | Work |
| --- | --- | --- |
| A | Theme hook/provider/config and audited portal consumers, excluding root layout | Implement frozen resolver and eliminate independent theme writers |
| B | Audited font consumer modules and dedicated font-loading stylesheet if retained | Map consumers to chosen font variables; prepare safe removal of duplicate sources |
| C | Token mapping/check tests and theme/browser fixtures | Validate alias resolution, opposite OS themes, portals, reload/navigation |
| Lead | `tokens.css`, `globals.css`, `layout.tsx`, DashboardShell integration | Introduce canonical tokens/aliases, Tailwind bridge, effective root theme, color-scheme, final font imports |

### Steps

3.1 Lead adds canonical token definitions and one-way compatibility aliases with current resolved values. Assert required variables resolve in both themes. Existing CSS-module consumers retain compatibility while migration proceeds.

3.2 A/B work in parallel against the frozen names. Theme work includes cleaning up duplicated writers, not simply adding another provider. Font work preserves every currently used family/style/weight until verified unused.

3.3 Lead integrates one effective theme path with route ownership and body portals. Bind Tailwind dark variants and native `color-scheme` to that path. Check nested theme behavior if supported; an ancestor-dark selector alone does not implement nested light overrides.

3.4 Lead adopts one font-loading path per family and verifies the generated Next/font variables versus literal family names. Remove duplicate imports/font-face definitions only after consumer and asset checks pass. Rename misleading font-loading files only if they remain necessary.

3.5 C runs theme/alias/font checks after integration. Exercise direct load, internal navigation, preference changes, reload, portal opening, OS light on a dark route, and OS dark on a light route. Compare font metrics and layout stability; do not claim network savings without measurement.

3.6 Lead records retained aliases and exceptions with owners, runs phase checks and graphify update, and freezes the primitive-facing token/theme API for P4.

**Gate P3:** no independent component mount unexpectedly changes the effective theme; overlays and native controls follow their owning surface; no required token resolves empty/cyclically; font source ownership is clear. Type-scale changes, if desired later, remain separate from this compatibility step.
