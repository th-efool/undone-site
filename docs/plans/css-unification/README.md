# CSS unification execution plan

Status: proposed; no implementation authorized by this planning request or applied.
Date: 27 October 2026.
Evidence: [investigation](../css-investigation-and-unification.md). This plan supersedes that report's high-level implementation sequence, not its findings.

## Outcome

New UI must reliably receive its intended styling: valid class references, predictable cascade, correct theme, defined tokens, accessible controls, and consistent shared components. Resolve the three Notes screenshot scenarios and migrate the application's styling ownership without disrupting persistence, sync, playback, or editor behavior.

CSS Modules remain the primary component styling mechanism. Tailwind remains available under a documented override contract. Global CSS becomes a small foundation rather than an implicit visual design for every element.

## Read and execute in this order

1. [Foundations: phases 0–3](foundations.md): baseline, contract freeze, cascade, tokens/theme/fonts.
2. [Component and route migration: phases 4–6](migration.md): reusable UI, Notes pilot, remaining routes.
3. [Verification and release: phase 7](verification.md): recurring gates, CI, final audit, rollout.

```text
P0 Baseline + inventories
  -> P1 Freeze contracts + establish regression fixtures
    -> P2 Correct cascade + global element defaults
      -> P3 Unify theme + introduce canonical tokens/fonts
        -> P4 Shared component contract
          -> P5 Notes end-to-end pilot
            -> P6 Route waves
              -> P7 Final enforcement + release readiness
```

Research, fixture preparation, and independent file ownership can run in parallel within a phase. A downstream implementation waits for its upstream gate. Do not start route-wide rewrites against changing shared APIs.

## Team execution model

Maximum concurrency: **one lead agent plus three subagents**. Reuse/reassign completed agents; do not create a second delegation tree. The lead owns coordination, shared integration points, conflict resolution, evidence review, and phase gates.

At each phase:

1. Lead records the baseline revision/working-tree state and reads the preceding gate.
2. Lead assigns each subagent an exact write allowlist and a test/artifact namespace.
3. Subagents inspect existing callers, tests, fixtures, and applicable instructions before editing.
4. Independent implementation proceeds in parallel only within those allowlists.
5. Subagents return their changes, validation evidence, exceptions, and requested cross-owner changes.
6. Lead integrates sequentially, runs the shared gate once the combined state is stable, and updates the phase ledger.
7. A failed gate returns work to its owner; the next dependent phase does not begin.

### Collision rules

- One writer per file, including barrel exports, test configs, package manifests, global stylesheets, and shared fixtures.
- Lead owns `src/app/globals.css`, `src/app/layout.tsx`, shared configuration, central token integration, and final contract documentation unless explicitly transferring exclusive ownership.
- A feature agent requests a shared API/token change from its owner; it does not patch the shared file itself.
- In a shared checkout, edits are immediately visible. Serialize integration checks after all relevant writes stop. Never assume a passed check against a moving tree remains valid.
- One browser driver per shared browser/session. Separate agents may perform static analysis/unit tests; browser workers require genuinely isolated sessions, test data, ports, and output directories.
- Do not share IndexedDB/localStorage identities or mutable backend fixture accounts between concurrent tests.
- Worktrees are optional isolation when required, not mandatory overhead for every subtask. Record the exact base and integrate dependencies explicitly if used.
- Keep existing user changes. In particular, reassess and preserve the pre-existing GitHub connection/sync UI and vault edits; never reset them as part of CSS work.

### Required subagent assignment text

Each assignment must include:

```text
Phase and task ID:
Objective and upstream gate:
Exact files/directories you may edit:
Files you may read but must not edit:
Frozen token/component/theme contracts:
Behavior that must remain unchanged:
Required tests and evidence paths:
Known pre-existing edits:
Stop/escalation conditions:

Read MEMORY/README.md and relevant subsystem memory before exploration.
If graphify-out/graph.json exists, run graphify query "<focused question>"
before the first source search/read. Use graphify path/explain where useful.
Read the exact located source before editing. Do not spawn more agents.
Return: modified files, behavior changes, tests/results, unresolved risks,
and any cross-owner requests. Do not claim a phase is complete yourself.
```

The lead performs `graphify update .` after integrated code changes at phase checkpoints, serially; agents must not concurrently rebuild shared graph outputs.

## Phase ledger

| Phase | Parallel workstreams | Lead integration | Exit gate | Status |
| --- | --- | --- | --- | --- |
| P0 | CSS/classes; themes/portals; visual/behavior baseline | Inventory and evidence ledger | Every entry point/state has an owner and coverage status | **COMPLETE** |
| P1 | Tokens/naming proposal; primitive/caller contract; regression fixtures | Freeze contracts and precedence decisions | Contracts are concrete and failing cases reproduce | **COMPLETE (Gate Passed)** |
| P2 | Reset/forms; typography consumers; independent regression review | Global imports/layers | Utilities work; no unexplained baseline regressions | **COMPLETE (Gate Passed)** |
| P3 | Theme resolver/portals; font consumers; token mapping audit | Root theme, tokens, font loading | Theme matrix and aliases pass | **COMPLETE (Gate Passed)** |
| P4 | Buttons/fields; overlays; typography/status primitives | Exports and shared fixture integration | Shared components satisfy state/keyboard/theme contracts | **COMPLETE (Gate Passed)** |
| P5 | Notes share/layout; sync presentation; editor/mobile boundary | Notes shell/shared stylesheet integration | Three screenshot failures resolved with workflow coverage | **COMPLETE (Gate Passed)** |
| P6 | Disjoint feature groups per wave | Shared fixes and cross-route navigation | Each wave passes before next wave | Ready to start |
| P7 | Static enforcement; browser acceptance; independent review | Build, memory, release record | Acceptance matrix complete; residual risks explicit | Not started |

## Non-negotiable scope boundaries

- No backend auth, vault, sync engine, persistence, or permission redesign to make styling tests pass.
- No wholesale framework replacement or new styling dependency unless existing tools demonstrably cannot satisfy a documented requirement.
- No mass class/token rename without a reference inventory and compatibility plan.
- No blanket deletion of `!important`, inline styles, or vendor overrides; classify ownership and purpose first.
- No global type-scale or palette redesign concealed inside a cascade fix.
- Do not require landing/editorial, dense application UI, and canvas tools to have identical visual density.
- Do not update directives or agent instructions opportunistically. A proposed guidance correction must cite the actual conflicting instruction and follow repository rules.

## Checkpoints and rollback

Use independently reviewable phase changes and smaller route-wave checkpoints. Record exactly which files/hunks belong to the migration, especially where user edits predate it. Use normal reversible Git checkpoints only within the user's authorized workflow; never reset a dirty working tree or revert someone else's edits.

If a gate fails: retain evidence, isolate the responsible change, repair that phase, and rerun affected checks. If rollback is necessary, revert only the owned checkpoint and its dependent migrations. Never retain a broad `!important` workaround merely to silence a visual regression.

Deployment is a separate action after release readiness. This planning request does not authorize implementation or production deployment.
