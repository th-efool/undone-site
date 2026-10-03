# Codex-driven website capture and reconstruction

## Purpose

This workflow lets the user provide an authorized URL and delegate repetitive exploration to Codex. Codex is the planner and controller. The controlled browser performs visible actions, captures deterministic screenshots, and records trigger-to-destination edges. QingLu video is optional supplemental evidence for pointer cues, timing, transitions, and destinations. The screenshot-to-UI and interaction compilers turn approved stable states into editable source.

The capture layer is evidence collection, not source extraction. Respect authorization, origin boundaries, credentials, privacy, copyright, and destructive-action gates.

## System roles

| Role | Responsibility | Must not do |
| --- | --- | --- |
| Codex controller | Plan journeys, choose safe actions, detect states, deduplicate, resume, generate, replay, report | Claim unseen states or silently cross risk gates |
| Browser actuator | Navigate, click, hover, scroll, type approved fixtures, take deterministic screenshots | Read implementation internals in `blind-visual` mode |
| QingLu observer | Optionally record pointer/keystroke cues, timing, transitions, and destination evidence with monotonic timestamps | Decide what to click, block static capture, or become the only evidence source |
| Evidence compiler | Persist state graph, actions, frames, masks, coverage, and provenance | Turn uncertain observations into facts |
| UI compiler | Convert approved state screenshots into UI evidence/spec/source | Embed screenshots as the product |
| Replay validator | Repeat captured journeys against generated UI and compare stable states | Use mismatched viewport or unsettled frames as parity evidence |

## One-command intake

Treat these as equivalent:

```text
复刻这个网站：https://example.com
用 Codex 打开并复刻 https://example.com
把这个网站自动录制、截图并生成可编辑 UI：https://example.com
```

Extract the seed URL, requested viewport(s), requested stack, and any explicit login or origin permission. Default to `blind-visual`, same-origin, read-only exploration, desktop `1440x900`, maximum 60 stable states, and maximum depth 4 when the user does not specify them.

Initialize the job:

```text
python <skill>/scripts/prepare_website_capture.py <url> <target-project>
```

The command creates `artifacts/ui-capture/<run-id>/capture-manifest.json` plus append-only evidence directories. Reuse that run on `继续`; do not create a second run unless the user requests a fresh capture or the seed/scope changes.

## Safety policy

Safe by default:

- Same-origin navigation among visibly linked public pages.
- Opening and closing menus, tabs, accordions, dialogs, filters, pagination, and previews.
- Hover, focus, scroll, carousel navigation, and non-mutating view controls.
- Filling clearly local demonstration fields with non-sensitive fixtures when it does not submit.

Require explicit user approval immediately before:

- Login, MFA, CAPTCHA, credential or cookie import.
- Payment, purchase, subscription, checkout, financial operation, or real order creation.
- Delete, publish, send, upload, invite, follow, like, comment, save-to-account, or other mutation.
- Submitting a form, changing an account, logging out, or accepting legal terms.
- Leaving the allowed origin, accessing private/admin areas, bypassing controls, or collecting personal data.

Never guess credentials, bypass access controls, or explore private URLs merely because they appear in page source.

## Acquisition profiles

### `blind-visual`

Use for competitor references, benchmarks, source-blind evaluation A, and any case where the user wants reconstruction from what a person can see.

- Observe rendered pixels only.
- Locate targets from screenshots, coordinates, and visibly rendered labels.
- Do not inspect DOM, HTML, CSS, JavaScript, network traffic, source maps, hidden accessibility content, or downloadable assets.
- Do not derive routes from source; only follow visibly exposed navigation.
- Record the browser and capture tools used in provenance.

### `authorized-semantic`

Use only after explicit permission for semantic browser assistance.

- Visible roles and accessible names may be used for reliable actuation.
- Source, CSS, JavaScript, network payloads, and private APIs remain out of scope unless separately authorized.
- Mark every action locator as `semantic-visible` rather than `visual-coordinate`.

## Exploration algorithm

1. Open the seed URL at a fixed viewport and wait for a stable initial state.
2. Inventory only visible safe targets: primary navigation, menus, tabs, accordions, dialogs, filters, pagination, and scroll sections.
3. Rank targets by information gain: navigation and major state controls before decorative or repeated controls.
4. Capture the current state, then execute one action at a time.
5. After each action, wait for visual stability and capture the resulting state.
6. Add an edge to the state graph, then return through a known reversible action or browser history.
7. Deduplicate by canonical visible URL, viewport, selected-state labels, dialog/menu state, and perceptual screenshot signature.
8. Continue breadth-first within depth/state budgets. Record skipped and blocked controls with reasons.
9. Repeat high-value journeys at requested viewports. Do not multiply every minor state across every viewport without a reason.
10. Validate the manifest before sending stable screenshots to the screenshot-to-UI phase.

Long pages use overlapping viewport tiles and an explicit scroll timeline. Mark sticky/fixed elements so they are not duplicated as separate page content. For animated UI, capture the resting state plus only behaviorally meaningful intermediate states.

## Stable identities

Use immutable IDs within a run:

```text
run.<slug>-<short-hash>
journey.<slug>
screen.<route-or-purpose>
state.<screen>.<variant>
action.<from-state>.<verb>.<target>
frame.<state>.<phase>.<sequence>
node.<semantic-path>
```

Every state stores its viewport, visible URL, screenshot, mask, parent journey, discovery action, capture time, stability evidence, and confidence. Every action stores its source/target states, visible label, locator profile, coordinates when applicable, action kind, risk class, and observed outcome. Never identify a state only by list position or a mutable display name.

## State settling

A stable capture requires both:

1. Two consecutive observations at least 250ms apart with no meaningful layout or pixel change outside declared dynamic masks.
2. No active pointer gesture, navigation, loading indicator, open transition, or pending recorder marker.

Keep `before`, `pressed/open`, `transition`, and `settled` frames when visually meaningful. Only the settled frame becomes the default screenshot-to-UI reference. Record timeout as unresolved rather than silently accepting an unstable frame.

## Capture and video preference

Use this preference order:

1. Browser screenshot at the exact CSS viewport for parity geometry.
2. Browser action records for trigger, source state, destination state, and stable identity.
3. QingLu or browser video for pointer cues, timing, transition tracks, and action-to-destination proof.
4. Intermediate video keyframes only when they reveal a meaningful property change.

Normal capture does not require a QingLu control protocol. A supported manual or automated recording is acceptable because the browser action log remains the authoritative interaction path. Align useful video spans to stable `recording.*` and `action.*` identities. If alignment is uncertain, use evidence level `inferred` or `unknown`; never promote an ambiguous transition to an observed fact.

Do not automate the QingLu GUI with fragile blind clicks. When no recording is available, set `recorder.status` accurately and continue with browser screenshots and actions. Use [capture-control-protocol-v1.md](capture-control-protocol-v1.md) only when the user explicitly asks to build or diagnose a separate programmable recorder bridge.

## Evidence package

```text
artifacts/ui-capture/<run-id>/
  capture-manifest.json
  screenshots/
  recordings/
  actions/
  states/
  motion/
  masks/
  reports/
```

The manifest is authoritative. It contains policy, acquisition mode, viewport matrix, adapter health, state graph, risk blocks, skipped controls, dynamic masks, coverage, and handoff state. Files are append-only during capture; corrections create new records rather than silently replacing old evidence.

Validate before generation:

```text
python <skill>/scripts/validate_website_capture.py <target-project>/artifacts/ui-capture/<run-id>/capture-manifest.json
python <skill>/scripts/compile_interaction_spec.py <target-project>/artifacts/ui-capture/<run-id>/capture-manifest.json
```

Then, for each approved stable state:

```text
python <skill>/scripts/prepare_ui_job.py <state-screenshot> <target-project> --id <state-id> --viewport <width>x<height>
```

## Reconstruction and replay

Generate a shared shell, reusable components, and explicit state variants from the state graph. Stable `data-ui-id` values must connect screenshot evidence, UI spec nodes, generated source, Studio operations, and replay results. Bind every compiled trigger with `data-ui-action`, implement its destination and settled state before motion, and add only motion tracks backed by the interaction spec.

Replay the captured journey against the generated app using the same viewport and action sequence. Compare state-specific settled screenshots, not just the landing page. Report geometry, typography, asset, color, interaction, and responsive differences separately. A high screenshot score does not prove unrecorded workflows; completion reports must include coverage and unresolved states.

## Completion contract

Report:

- Seed URL, allowed origin, acquisition profile, and authorization boundary.
- Capture run ID, state/action counts, visited and skipped coverage, and recorder status.
- Evidence manifest and stable screenshots.
- Generated routes/components and stable-ID registry.
- Browser replay results at matching viewports.
- Studio URL and latest revision state when Studio is enabled.
- Risk-blocked, unstable, inaccessible, or unobserved behavior.

Never claim full-site completion merely because the landing page was reconstructed.
