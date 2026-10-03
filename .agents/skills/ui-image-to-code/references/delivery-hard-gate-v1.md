# UI Delivery Hard Gate V1

The delivery gate converts task intent into machine-checkable completion. It prevents a structurally runnable homepage from being reported as a finished reconstruction when journeys, state evidence, icon assets, design review, Studio identity, or real-source roundtrip are missing.

## Required order

1. Create `.ui-job/job-contract.json` with `prepare_ui_contract.py`.
2. Capture every declared page and journey.
3. Bind every approved settled state to an `evidenceId`.
4. Validate and compile every evidence map and interaction manifest.
5. Generate production source and record its source/spec hashes.
6. Replay real browser journeys and required viewports.
7. Complete visual-director sign-offs.
8. Run `finalize_ui_to_studio.py`; require the current generated UI, stable identities, UI Document V4, source map, and clean sync state to produce `.ui-job/studio-installation.json`.
9. Prove a saved revision can be applied to production source, previewed, and rolled back.
10. Run `validate_delivery_gate.py`.

`frontend-skill`, `emil-design-eng`, and `qinglu-ui-parity` are always retained in `requiredCompanionSkills`; extra `--companion-skill` values append to them. Browser replay, design review, Studio, or roundtrip may be disabled only for an explicit user-approved scope reduction recorded with `--exception-reason`. Atomic evidence, a uniform vector icon system, approved-state evidence, and zero P0 issues are non-optional.

## Capture contract additions

Every state uses:

```json
{
  "id": "state.home.product-settled",
  "pageId": "page.home",
  "evidenceId": "state-home-product-settled",
  "stability": {"status": "settled", "observations": 2}
}
```

Every required action uses:

```json
{
  "id": "action.home.product.open",
  "journeyId": "journey.product-set",
  "fromStateId": "state.home.initial",
  "toStateId": "state.home.product-settled",
  "evidence": {"level": "observed", "sources": ["browser-replay"]}
}
```

Required journeys must lead to distinct approved destination states. Approved states must be settled and must have an evidence map plus compiled UI spec.

## Browser QA file

`.ui-job/browser-qa.json`:

```json
{
  "schemaVersion": 1,
  "status": "passed",
  "viewportIds": ["vp-1440x900", "vp-390x844"],
  "journeys": [
    {
      "id": "journey.product-set",
      "status": "passed",
      "evidence": ["artifacts/browser-qa/product-set-desktop.png"],
      "steps": ["open homepage", "activate product-set entry", "confirm settled destination"]
    }
  ]
}
```

Evidence must come from the real project URL. An editor iframe or a screenshot-only mock is not real-project browser proof.

## Design review file

`.ui-job/design-review.json`:

```json
{
  "schemaVersion": 1,
  "status": "passed",
  "p0IssueCount": 0,
  "skillSignoffs": ["frontend-skill", "emil-design-eng", "qinglu-ui-parity"],
  "reviews": {
    "frontend-skill": {
      "status": "passed",
      "reviewedAt": "2026-08-14T12:00:00Z",
      "evidence": ["artifacts/design-review/hierarchy-desktop.png", "artifacts/design-review/responsive-mobile.png"]
    },
    "emil-design-eng": {
      "status": "passed",
      "reviewedAt": "2026-08-14T12:05:00Z",
      "evidence": ["artifacts/design-review/interaction-polish.json"]
    },
    "qinglu-ui-parity": {
      "status": "passed",
      "reviewedAt": "2026-08-14T12:10:00Z",
      "evidence": ["artifacts/design-review/parity-report.json"]
    }
  },
  "checks": {
    "hierarchy": "passed",
    "responsive": "passed",
    "iconSystem": "passed",
    "interactionPolish": "passed",
    "visualParity": "passed"
  },
  "allowedUnicodeIcons": []
}
```

`frontend-skill` owns hierarchy, composition, content density, and responsive structure. `emil-design-eng` owns feedback, motion, drag/resize feel, icon optical alignment, and reduced-motion behavior. `qinglu-ui-parity` owns traceability from observed actions and motion to implementation and validation. Each review evidence path must resolve to a real project-local file. The review cannot pass with mixed icon languages, decorative Unicode/Emoji product icons, unreviewed approximate assets, or any P0 issue.

Before review, run `python scripts/audit_icon_assets.py <target-project> --source index.html --source app.js` (or the equivalent production entries). Every product icon must be an independent `svg[data-ui-id]`, every ID must be unique and present in production source, every item must be `verified`, and one icon family must be used unless the task contract explicitly adds a reviewed regional exception. The resulting `.ui-job/icon-inventory.json` is a mandatory delivery artifact.

## Roundtrip QA file

`.ui-job/roundtrip-qa.json`:

```json
{
  "schemaVersion": 1,
  "status": "passed",
  "appliedRevision": 1,
  "realPreviewVerified": true,
  "rollbackVerified": true,
  "evidence": ["artifacts/roundtrip/r1-before.png", "artifacts/roundtrip/r1-after.png"]
}
```

The applied revision must target stable identities, be written into production source or the canonical generated source patch, appear in the real project preview, become clean in sync state, and be recoverable by the project revision mechanism.
Both roundtrip evidence files must exist. Browser journey evidence paths must also exist and each passing journey must list the replay steps; a JSON claim with missing screenshots/reports is not evidence.

## Studio installation receipt

`.ui-job/studio-installation.json` is generated only by `finalize_ui_to_studio.py`. It must bind the current `.ui-job/source-generation.json` hash to the preserved production files, `studio.html`, UI Document V4, source map, sync state, and the non-empty stable identity registry. The validator recomputes all source and identity hashes. A manually copied template, stale receipt, empty registry, starter page, screenshot-only canvas, or `.ui-studio` directory without this receipt does not satisfy the Studio gate.

The Studio tree must also pass namespace-independent coverage: with search and type filters cleared, every current registered identity must be represented by exactly one selectable tree row. Demo-specific route IDs may add semantic grouping but may not hide a new project's identities. A non-empty registry paired with an empty tree, a stale page label, or a preview whose live identity set differs from the installation receipt is a blocking installation failure.

## Failure semantics

- Missing contract: do not capture or generate.
- Missing journey action: continue visible interaction acquisition.
- Missing approved-state evidence: prepare and compile that state.
- Stale source marker: reconcile the changed source/spec before QA.
- Missing design sign-off: run the named companion skill and record the review.
- Invalid identity or dirty sync: do not apply another Studio revision.
- Missing real preview or rollback proof: the roundtrip is incomplete.
- Any final gate error: no completion claim and no production handoff.

## Skill-maintainer regression

Before distributing an updated Skill, run:

```text
python scripts/delivery_gate_smoke.py
python scripts/studio_finalize_smoke.py
```

These regressions prove that non-optional requirements cannot be disabled, mandatory companion Skills cannot be replaced, exceptional omissions need a recorded reason, a claimed design sign-off fails when its project-local evidence file is missing, and the actual generated UI—not a template—creates a current non-empty Studio identity import while stale source is rejected.
