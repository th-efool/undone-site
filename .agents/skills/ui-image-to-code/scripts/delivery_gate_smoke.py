#!/usr/bin/env python3
"""Regression checks for contract, design-signoff, and local evidence hard gates."""

from __future__ import annotations

import json
import hashlib
import tempfile
from pathlib import Path

from validate_delivery_gate import (
    REQUIRED_COMPANION_SKILLS,
    validate_contract,
    validate_design_review,
    validate_evidence_files,
    validate_studio_installation,
    require_file,
)


def ready_contract() -> dict:
    return {
        "schemaVersion": 1,
        "status": "ready",
        "requirements": {
            "captureContract": True,
            "approvedStateEvidence": True,
            "atomicIconEvidence": True,
            "uniformVectorIconSystem": True,
            "p0IssuesMustBeZero": True,
            "browserE2E": True,
            "studio": True,
            "roundtrip": True,
            "designReview": True,
            "requiredCompanionSkills": sorted(REQUIRED_COMPANION_SKILLS),
        },
        "exceptions": [],
    }


def main() -> int:
    contract = ready_contract()
    errors: list[str] = []
    validate_contract(contract, errors)
    assert not errors, errors

    weakened = json.loads(json.dumps(contract))
    weakened["requirements"]["atomicIconEvidence"] = False
    errors = []
    validate_contract(weakened, errors)
    assert any("non-optional" in message and "atomicIconEvidence" in message for message in errors)

    missing_skill = json.loads(json.dumps(contract))
    missing_skill["requirements"]["requiredCompanionSkills"].remove("emil-design-eng")
    errors = []
    validate_contract(missing_skill, errors)
    assert any("emil-design-eng" in message for message in errors)

    exceptional = json.loads(json.dumps(contract))
    exceptional["requirements"]["browserE2E"] = False
    exceptional["exceptions"] = [{
        "requirements": ["browserE2E"],
        "reason": "Explicit user-approved non-browser artifact scope",
    }]
    errors = []
    validate_contract(exceptional, errors)
    assert not errors, errors

    with tempfile.TemporaryDirectory(prefix="ui-delivery-gate-") as directory:
        target = Path(directory)
        (target / "src").mkdir()
        (target / "evidence").mkdir()
        source = target / "src" / "app.html"
        source.write_text('<svg data-ui-id="app.icon" viewBox="0 0 24 24"></svg>\n', encoding="utf-8")
        evidence_paths: list[str] = []
        for skill in sorted(REQUIRED_COMPANION_SKILLS):
            relative = f"evidence/{skill}.json"
            (target / relative).write_text('{"status":"passed"}\n', encoding="utf-8")
            evidence_paths.append(relative)
        review = {
            "schemaVersion": 1,
            "status": "passed",
            "p0IssueCount": 0,
            "skillSignoffs": sorted(REQUIRED_COMPANION_SKILLS),
            "reviews": {
                skill: {
                    "status": "passed",
                    "reviewedAt": "2026-08-14T00:00:00Z",
                    "evidence": [f"evidence/{skill}.json"],
                }
                for skill in sorted(REQUIRED_COMPANION_SKILLS)
            },
            "checks": {
                "hierarchy": "passed",
                "responsive": "passed",
                "iconSystem": "passed",
                "interactionPolish": "passed",
                "visualParity": "passed",
            },
        }
        review_path = target / "design-review.json"
        review_path.write_text(json.dumps(review, indent=2) + "\n", encoding="utf-8")
        errors = []
        validate_design_review(target, contract, review_path, ["src/app.html"], errors)
        assert not errors, errors

        (target / evidence_paths[0]).unlink()
        errors = []
        validate_design_review(target, contract, review_path, ["src/app.html"], errors)
        assert any("missing deliverable" in message for message in errors)

        errors = []
        validate_evidence_files(target, ["evidence/does-not-exist.json"], "browser QA", errors)
        assert errors and "missing deliverable" in errors[0]

        studio_target = target / "studio-project"
        studio_state = studio_target / ".ui-studio"
        studio_job = studio_target / ".ui-job"
        studio_state.mkdir(parents=True)
        studio_job.mkdir(parents=True)
        production = studio_target / "index.html"
        production.write_text('<main data-ui-id="page.root"></main>\n', encoding="utf-8")
        (studio_target / "studio.html").write_text('<main id="canvas-viewport"></main>\n', encoding="utf-8")
        source_digest = hashlib.sha256(production.read_bytes()).hexdigest()
        marker = {
            "schemaVersion": 1,
            "status": "generated",
            "sourceFiles": [{"path": "index.html", "sha256": source_digest, "bytes": production.stat().st_size}],
        }
        marker_path = studio_job / "source-generation.json"
        marker_path.write_text(json.dumps(marker) + "\n", encoding="utf-8")
        identity = {
            "identityCount": 1,
            "entries": [{"id": "page.root", "locations": [{"file": "index.html", "line": 1}]}],
            "duplicateIds": [],
            "unresolvedTargetIds": [],
        }
        identity_path = studio_state / "identity-registry.json"
        identity_path.write_text(json.dumps(identity) + "\n", encoding="utf-8")
        for filename in ("ui-document.json", "sync-state.json", "source-map.json"):
            (studio_state / filename).write_text("{}\n", encoding="utf-8")
        identity_digest = hashlib.sha256(b"page.root").hexdigest()
        receipt = {
            "schemaVersion": 1,
            "status": "ready",
            "importMode": "live-production-dom",
            "productionEntry": "index.html",
            "studioEntry": "studio.html",
            "sourceMarkerSha256": hashlib.sha256(marker_path.read_bytes()).hexdigest(),
            "sourceFiles": marker["sourceFiles"],
            "uiDocument": ".ui-studio/ui-document.json",
            "syncState": ".ui-studio/sync-state.json",
            "sourceMap": ".ui-studio/source-map.json",
            "identityRegistry": ".ui-studio/identity-registry.json",
            "editableObjectCount": 1,
            "identityIdsSha256": identity_digest,
            "checks": {
                "realGeneratedSourcePreserved": "passed",
                "studioContract": "passed",
                "projectStateInitialized": "passed",
                "stableIdentityRegistry": "passed",
                "sourceMappingInitialized": "passed",
                "cleanInitialSync": "passed",
            },
        }
        receipt_path = studio_job / "studio-installation.json"
        receipt_path.write_text(json.dumps(receipt) + "\n", encoding="utf-8")
        errors = []
        validate_studio_installation(studio_target, receipt_path, marker_path, errors)
        assert not errors, errors

        receipt_path.unlink()
        errors = []
        missing_receipt = require_file(studio_target, ".ui-job/studio-installation.json", errors)
        validate_studio_installation(studio_target, missing_receipt, marker_path, errors)
        assert any("missing deliverable" in message for message in errors)

    print("Delivery hard-gate workflow: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
