# Verification, enforcement, and release

Use alongside every phase in the [execution plan](README.md), not only at the end.

## Evidence rules

1. Record revision/working-tree state, fixture data version, route/state, viewport, effective theme, OS preference, and test mode with each browser capture.
2. Distinguish `static`, `component fixture`, `mocked route`, `authenticated integration`, and `built-app browser` evidence. One does not automatically prove another.
3. Existing broken screenshots establish the defect. They are not golden targets to preserve. Every visual difference must be classified as an intentional correction or a regression; never auto-accept snapshots.
4. Capture acceptance evidence after an integration freeze. Do not run a browser acceptance pass while other agents are changing global styles or rebuilding shared output.
5. Reuse the existing harness first. If a new deterministic check is genuinely necessary, inspect `execution/` and repository test conventions, then give it one focused responsibility and a self-test. Do not create a sprawling custom CSS analysis platform.
6. Graph updates, production builds, shared fixtures, and browser settings each have one writer/driver at a time. Unit/static checks may run concurrently if their outputs and mutable state are isolated.

## Recurring gate matrix

| Gate | Required assertions | When |
| --- | --- | --- |
| CSS emission | Actual root stylesheet compiles; critical used utilities exist; intended layer ordering is emitted | P1 fixture setup, P2, and changes to CSS compilation/imports |
| Cascade | Correct panel/button padding, heading size, backgrounds, borders, checkbox geometry, help/error inheritance; include utility and module examples | P2; later shared cascade changes |
| Theme | Dark route/light OS and light route/dark OS; direct load, reload, client navigation; native controls and body portals; nested scopes if supported | P3; theme or overlay changes |
| Primitive behavior | Names/labels, focus, Escape, focus restoration, disabled/loading/invalid states, selected indicators | P4; affected primitive changes |
| Layout | 320px/390px and representative desktop widths, short height, long content/title, zoom; no clipped essential actions | P4 onward, bounded to affected surfaces |
| Preferences | Keyboard focus, reduced motion, forced colors, contrast review | Shared controls and affected routes |
| Feature behavior | Existing tests covering touched interactions; isolated authenticated cases where fixtures cannot prove behavior | P5/P6 and final relevant suite |
| Navigation/CSS order | Direct entry and client navigation; lazy editor/style chunk loading; overlays after route changes | Notes pilot, route waves, built-app smoke |

Expected numeric values come from the approved contract. For example, the current `--text-sm` resolves to 16px; a test must not assume 14px merely because a framework commonly uses that value.

## Notes acceptance checklist

- Share title renders readable quotation marks and long titles wrap without overflowing.
- Email field stays usable; permission dropdown does not consume the whole row.
- Public-link checkbox has correct geometry and clear checked/focus states.
- Primary, secondary, and close actions have the intended hierarchy.
- Share dialog has an accessible name, focus containment, Escape behavior, focus restoration, and viewport-safe scrolling.
- Connection form works visually in disconnected, connected, loading, validation-error, and request-error states.
- Sync details covers offline/saved/syncing/error states, readable timestamps/counts, and reachable recovery/reconnect actions.
- Theme remains consistent between Notes, dialog/popover, and controls under opposite OS preferences.
- Canvas and Kanban load without contaminating the surrounding UI, including switching editors and navigating away/back.
- Presentation fixtures do not initiate real OAuth, publish repositories, alter permissions, or mutate private notes. Authenticated feature verification uses a separate controlled fixture environment.

## Regression checks introduced early

Start baseline-aware checks in P1; promote them as phases resolve their targets. Do not defer all prevention work until P7.

| Check | Blocking scope | Exceptions to model |
| --- | --- | --- |
| CSS Module key validity | Newly introduced and migrated static references | Bracket/dynamic keys, composition, globals; unresolved cases require review |
| Application token validity | Canonical application tokens and migrated consumers | Next/font, Tailwind, vendor, inline-owned values, intentional fallback contracts |
| Emitted utilities | Utilities required by critical fixtures | Unsupported plugin names are errors, not silently assumed dependencies |
| Global selector/layer policy | New broad unlayered styling and migrated files | Reviewed vendor/print/accessibility/integration cases |
| Override policy | New undocumented important/specificity escalation | Existing baseline debt tracked with owners; legitimate preference overrides preserved |
| Encoding review | Suspicious literals in changed UI text | Review rather than automatic rewriting of multilingual content |

Baseline legacy debt, block new debt, and require targeted old debt to reach zero before declaring its phase complete. An allowlist entry must name a concrete reason, owner, and retirement/retention condition.

## Phase 7 — Closure, strict enforcement, and release readiness

**Prerequisite:** all P6 waves pass. No unverified authentication-dependent requirement is silently treated as complete.

### Parallel assignments

| Owner | Exclusive scope | Work |
| --- | --- | --- |
| A | Existing/new focused static validation tools and tests | Enforce class/token/utility/layer contracts; verify exception handling |
| B | Final browser acceptance evidence and relevant behavioral suite | Execute frozen route/state matrix; validate built output after lead build |
| C | Read-only independent review and retirement proposals | Review residual aliases, duplicate font/slider ownership, overrides, dead-style evidence, missed routes |
| Lead | CI/config integration, alias removal, memory/contract docs, production build | Resolve findings and make final readiness decision |

### Steps

7.1 Lead freezes the implementation state and coverage matrix. Every ledger item is resolved, explicitly retained with justification, or still open. Open core items block full completion.

7.2 A tightens early checks for migrated scope and adds focused self-tests for their analysis logic, including dynamic-key/token false-positive cases. Use existing tooling where practical; no dependency added solely to enforce a simple naming rule.

7.3 C independently reviews unresolved exceptions and proposes any last cleanup. C does not delete aliases/styles while B is verifying. Lead applies accepted removals serially, rechecks consumers, and re-freezes the state before affected browser checks resume.

7.4 Lead runs relevant type/lint checks, existing feature tests, and a production build using repository commands. Do not run multiple builds against the same generated directories. Any pre-existing failure is reported with evidence, not silently relabeled a pass.

7.5 B runs browser smoke against the built application, including route transition and lazy CSS order. Complete the agreed authenticated cases separately from mocked visual checks. If access is unavailable, list exact pending cases and withhold the corresponding completion claim.

7.6 Lead documents the shipped styling contract and examples: class naming, tokens/aliases, theme precedence, portal ownership, layer placement, primitive usage, vendor boundaries, and test commands. Add `MEMORY/css-styling.md` and index it only once these contracts are implemented and verified. Avoid logs/screenshots in memory. Propose any agent-guidance update through the repository's applicable instructions.

7.7 Lead runs the final graph update, reviews the combined diff for unrelated changes and preserved user work, and records evidence paths, commands/results, residual risks, and deployment prerequisites.

7.8 Produce the release-readiness handoff. Deploy only under a separately authorized deployment workflow. If deployed later, smoke-check the same critical built routes/states on the deployed target before calling rollout complete.

**Gate P7:** all agreed active surfaces and targeted failure modes are covered; no unexplained visual differences or unresolved migrated class/token defects remain; important behavior remains intact; production build and built-browser smoke pass; canonical ownership and CI checks exist; remaining exceptions are concrete and reviewed.

## Phase handoff format

```text
Phase / task / owner:
Baseline and final revision or owned diff:
Modified files:
Contract/API changes:
Tests and exact results:
Browser evidence and fixture/auth mode:
Intentional visual changes:
Remaining exceptions and their owners:
Unverified cases:
Cross-owner requests:
Rollback checkpoint/scope:
Gate status: pending | pass | fail
```

Only the lead marks the integrated phase gate passed. Subagents report task results, not completion of other agents' work.

## Stop conditions and recovery

- **Ownership collision:** stop writes to the shared file; lead resolves ownership and integrates deliberately.
- **Contract changes mid-wave:** pause dependent work, update the frozen contract, rerun its affected shared tests, then resume.
- **Unexpected cross-route regression:** fix the owning foundation/primitive, then rerun the affected route matrix. Do not spread local patches.
- **Missing authentication or infrastructure:** continue independent static/fixture work, record the exact blocker, and keep integration coverage pending.
- **Unrelated backend failure:** distinguish it from styling failures; do not expand the CSS migration into a backend rewrite.
- **Material irreversible action:** prepare the reviewable result and follow the applicable authorization workflow; this plan does not itself authorize release.

Full completion is a verified architectural and UI outcome, not a line-count reduction or a clean screenshot of one route.
