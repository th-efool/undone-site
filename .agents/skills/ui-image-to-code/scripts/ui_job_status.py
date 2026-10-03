#!/usr/bin/env python3
"""Summarize screenshot evidence and Studio state so Codex can resume safely."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from scan_project_menu import source_inventory
from validate_project_menu import validate as validate_project_menu


def read_json(path: Path) -> dict | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, json.JSONDecodeError) as error:
        return {"_error": str(error)}
    return value if isinstance(value, dict) else {"_error": "expected a JSON object"}


def source_hash(target: Path) -> str:
    digest = hashlib.sha256()
    for relative in ("index.html", "styles.css", "app.js"):
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        path = target / relative
        try:
            digest.update(path.read_bytes())
        except FileNotFoundError:
            digest.update(b"<missing>")
        digest.update(b"\0")
    return digest.hexdigest()


def contract_status(target: Path) -> dict:
    contract = read_json(target / ".ui-job" / "job-contract.json")
    if contract is None:
        return {"installed": False, "state": "missing", "requirements": {}}
    if "_error" in contract or contract.get("schemaVersion") != 1 or contract.get("status") != "ready":
        return {"installed": True, "state": "invalid", "error": contract.get("_error"), "requirements": {}}
    scope = contract.get("scope") if isinstance(contract.get("scope"), dict) else {}
    return {
        "installed": True,
        "state": "ready",
        "pages": len(scope.get("pages", [])) if isinstance(scope.get("pages"), list) else 0,
        "journeys": len(scope.get("journeys", [])) if isinstance(scope.get("journeys"), list) else 0,
        "viewports": len(scope.get("viewports", [])) if isinstance(scope.get("viewports"), list) else 0,
        "requirements": contract.get("requirements") if isinstance(contract.get("requirements"), dict) else {},
    }


def source_marker_status(target: Path) -> dict:
    marker = read_json(target / ".ui-job" / "source-generation.json")
    if marker is None:
        return {"installed": False, "state": "missing"}
    if "_error" in marker or marker.get("schemaVersion") != 1 or marker.get("status") != "generated":
        return {"installed": True, "state": "invalid", "error": marker.get("_error")}
    stale: list[str] = []
    source_files = marker.get("sourceFiles") if isinstance(marker.get("sourceFiles"), list) else []
    for item in source_files:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            stale.append("<invalid-entry>")
            continue
        path = target / str(item["path"])
        try:
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
        except OSError:
            stale.append(str(item["path"]))
            continue
        if actual != item.get("sha256"):
            stale.append(str(item["path"]))
    return {
        "installed": True,
        "state": "stale" if stale else "current",
        "sources": len(source_files),
        "uiSpecs": len(marker.get("compiledUiSpecs", [])) if isinstance(marker.get("compiledUiSpecs"), list) else 0,
        "interactionSpecs": len(marker.get("compiledInteractionSpecs", [])) if isinstance(marker.get("compiledInteractionSpecs"), list) else 0,
        "staleFiles": stale,
    }


def qa_status(target: Path, relative: str) -> dict:
    value = read_json(target / relative)
    if value is None:
        return {"state": "missing"}
    if "_error" in value:
        return {"state": "invalid", "error": value["_error"]}
    return {"state": str(value.get("status") or "invalid")}


def project_menu_status(target: Path) -> dict:
    path = target / ".ui-job" / "project-menu.json"
    if not path.is_file():
        return {"state": "missing", "menuCount": 0}
    report = validate_project_menu(target)
    if not report["ok"]:
        return {"state": "invalid", "menuCount": report["menuCount"], "errors": report["errors"]}
    document = read_json(path) or {}
    try:
        current_hash, _ = source_inventory(target)
    except (OSError, ValueError) as error:
        return {"state": "invalid", "menuCount": report["menuCount"], "errors": [str(error)]}
    state = "current" if document.get("sourceHash") == current_hash else "stale"
    return {
        "state": state,
        "menuCount": report["menuCount"],
        "sourceHash": document.get("sourceHash"),
        "currentSourceHash": current_hash,
    }


def evidence_status(target: Path) -> list[dict]:
    directory = target / "artifacts" / "ui-evidence"
    result = []
    if not directory.is_dir():
        return result
    for path in sorted(directory.glob("*.json")):
        value = read_json(path) or {}
        if "_error" in value:
            result.append({"id": path.stem, "status": "invalid", "error": value["_error"], "path": path})
            continue
        nodes = value.get("nodes") if isinstance(value.get("nodes"), list) else []
        unresolved = value.get("unresolved") if isinstance(value.get("unresolved"), list) else []
        blocking = sum(1 for item in unresolved if isinstance(item, dict) and item.get("severity") == "blocking")
        reference = value.get("reference") if isinstance(value.get("reference"), dict) else {}
        reference_id = str(reference.get("id") or path.stem)
        spec_path = target / "artifacts" / "ui-spec" / f"{reference_id}.json"
        result.append({
            "id": reference_id,
            "status": str(value.get("status") or "invalid"),
            "nodes": len(nodes),
            "unresolved": len(unresolved),
            "blocking": blocking,
            "viewport": f"{reference.get('width', '?')}x{reference.get('height', '?')}",
            "path": path,
            "compiled": spec_path.is_file(),
            "specPath": spec_path if spec_path.is_file() else None,
        })
    return result


def capture_status(target: Path) -> list[dict]:
    directory = target / "artifacts" / "ui-capture"
    result = []
    if not directory.is_dir():
        return result
    for manifest in sorted(directory.glob("*/capture-manifest.json")):
        value = read_json(manifest) or {}
        if "_error" in value:
            result.append({
                "id": manifest.parent.name,
                "status": "invalid",
                "error": value["_error"],
                "path": manifest,
            })
            continue
        run = value.get("run") if isinstance(value.get("run"), dict) else {}
        run_id = str(run.get("id") or manifest.parent.name)
        graph = value.get("stateGraph") if isinstance(value.get("stateGraph"), dict) else {}
        states = graph.get("states") if isinstance(graph.get("states"), list) else []
        actions = graph.get("actions") if isinstance(graph.get("actions"), list) else []
        handoff = value.get("handoff") if isinstance(value.get("handoff"), dict) else {}
        approved = handoff.get("approvedStateIds") if isinstance(handoff.get("approvedStateIds"), list) else []
        approved_set = set(approved)
        evidence_ids = [
            str(state.get("evidenceId")) for state in states
            if isinstance(state, dict) and state.get("id") in approved_set and isinstance(state.get("evidenceId"), str)
        ]
        recordings = value.get("recordings") if isinstance(value.get("recordings"), list) else []
        motions = value.get("motions") if isinstance(value.get("motions"), list) else []
        adapters = value.get("adapters") if isinstance(value.get("adapters"), dict) else {}
        recorder = adapters.get("recorder") if isinstance(adapters.get("recorder"), dict) else {}
        spec_path = target / "artifacts" / "ui-spec" / f"{run_id}.interaction.json"
        result.append({
            "id": run_id,
            "status": str(value.get("status") or "invalid"),
            "states": len(states),
            "actions": len(actions),
            "approved": len(approved),
            "approvedEvidenceIds": evidence_ids,
            "recordings": len(recordings),
            "motions": len(motions),
            "recorderStatus": str(recorder.get("status") or "unknown"),
            "path": manifest,
            "compiled": spec_path.is_file(),
            "specPath": spec_path if spec_path.is_file() else None,
        })
    return result


def studio_status(target: Path) -> dict:
    sync = read_json(target / ".ui-studio" / "sync-state.json")
    document = read_json(target / ".ui-studio" / "ui-document.json")
    handoff = read_json(target / ".ui-studio" / "handoff.json")
    identity = read_json(target / ".ui-studio" / "identity-registry.json")
    installation = read_json(target / ".ui-job" / "studio-installation.json")
    installation_state = "missing"
    if isinstance(installation, dict):
        installation_state = "ready" if installation.get("schemaVersion") == 1 and installation.get("status") == "ready" else "invalid"
    if sync is None:
        return {"installed": False, "state": "not-installed", "installationState": installation_state}
    if "_error" in sync:
        return {"installed": True, "state": "invalid", "error": sync["_error"]}
    duplicate_ids = identity.get("duplicateIds", []) if isinstance(identity, dict) else []
    unresolved_ids = identity.get("unresolvedTargetIds", []) if isinstance(identity, dict) else []
    identity_valid = isinstance(identity, dict) and not identity.get("_error") and not duplicate_ids and not unresolved_ids
    revision = int((document or {}).get("revision") or sync.get("documentRevision") or 0)
    applied_revision = int(sync.get("appliedRevision") or 0)
    current_hash = source_hash(target)
    base_hash = str(sync.get("baseSourceHash") or "")
    pending = revision > applied_revision
    effective_state = "clean"
    if pending and current_hash != base_hash:
        effective_state = "conflict"
    elif pending:
        effective_state = "pending-codex"
    elif current_hash != base_hash:
        effective_state = "source-ahead"
    return {
        "installed": True,
        "state": effective_state,
        "storedState": str(sync.get("state") or "invalid"),
        "revision": revision,
        "appliedRevision": applied_revision,
        "baseSourceHash": base_hash,
        "currentSourceHash": current_hash,
        "lastWriter": sync.get("lastWriter"),
        "handoffStatus": handoff.get("status") if isinstance(handoff, dict) else None,
        "summary": handoff.get("summary") if isinstance(handoff, dict) and isinstance(handoff.get("summary"), dict) else {},
        "identityStatus": "valid" if identity_valid else ("not-generated" if identity is None else "invalid"),
        "identityCount": identity.get("identityCount", 0) if isinstance(identity, dict) else 0,
        "duplicateIds": duplicate_ids,
        "unresolvedTargetIds": unresolved_ids,
        "installationState": installation_state,
        "editableObjectCount": installation.get("editableObjectCount", 0) if isinstance(installation, dict) else 0,
    }


def next_action(captures: list[dict], evidence: list[dict], studio: dict, contract: dict, source: dict, project_menu: dict, qa: dict) -> tuple[str, str]:
    if contract.get("state") == "missing":
        return "prepare-ui-contract", "Declare required pages, journeys, viewports, Studio, browser, roundtrip, and design sign-offs before capture."
    if contract.get("state") == "invalid":
        return "repair-ui-contract", "Repair the project UI contract before any capture or generation work."
    studio_state = studio.get("state")
    studio_ready = studio.get("installed") and studio.get("installationState") == "ready"
    if studio_ready and studio.get("identityStatus") == "invalid":
        return "resolve-identity-errors", "Resolve duplicate data-ui-id values or missing operation targets before applying Studio changes."
    if studio_ready and studio_state in {"conflict", "invalid"}:
        return "resolve-studio-state", "Resolve the Studio conflict or invalid document before editing source."
    if studio_ready and studio_state == "pending-codex":
        return "apply-studio-revision", "Read sync:changes, apply the pending semantic operations, test, and mark the revision clean."
    if studio_ready and studio_state == "source-ahead":
        return "refresh-studio-base", "Regenerate or reload the Studio document from the latest production source."
    if any(item.get("status") == "invalid" for item in captures):
        return "repair-website-capture", "Repair the invalid website capture manifest before continuing interaction discovery."
    draft_captures = [item for item in captures if item.get("status") == "draft"]
    if draft_captures:
        return "continue-website-capture", f"Resume {len(draft_captures)} draft website capture run(s); add stable states and trigger-to-destination action edges."
    if any(item.get("status") == "ready" and not item.get("compiled") for item in captures):
        return "compile-interaction-spec", "Compile each ready website capture into a deterministic interaction generation spec."
    if captures and not evidence:
        return "prepare-approved-state-evidence", "Create position-evidence jobs for the approved settled website states before source generation."
    if any(item.get("status") == "invalid" for item in evidence):
        return "repair-evidence", "Repair invalid evidence JSON before generation."
    drafts = [item for item in evidence if item.get("status") == "draft"]
    if drafts:
        return "complete-position-evidence", f"Complete {len(drafts)} draft evidence map(s), remove blocking items, set ready, and validate."
    if not evidence and not studio.get("installed"):
        return "prepare-reference", "Persist the screenshot and initialize a position-evidence job."
    if not evidence and studio.get("installed"):
        return "browser-verify-or-edit", "The existing Studio project has no external evidence-map job; continue its saved UI document, browser verification, or small adjustments."
    if any(item.get("status") == "ready" and not item.get("compiled") for item in evidence):
        return "compile-ui-spec", "Compile each ready evidence map into a deterministic UI generation spec before writing source."
    approved_evidence = {evidence_id for item in captures for evidence_id in item.get("approvedEvidenceIds", [])}
    compiled_evidence = {item.get("id") for item in evidence if item.get("compiled")}
    if approved_evidence - compiled_evidence:
        return "complete-approved-state-evidence", "Every approved capture state needs its own ready evidence map and compiled UI spec."
    if source.get("state") == "missing":
        return "generate-and-record-source", "Generate runnable source from every covered UI and interaction spec, then record immutable source/spec hashes."
    if source.get("state") in {"invalid", "stale"}:
        return "reconcile-source-marker", "Production source or its generation marker is stale; regenerate or deliberately refresh the marker after verification."
    if project_menu.get("state") in {"missing", "invalid", "stale"}:
        return "scan-project-menu", "Start the real project on loopback, run scan_project_menu.py, and bind every safe current menu to its localized production page/state and live layer count before Studio import."
    requirements = contract.get("requirements") if isinstance(contract.get("requirements"), dict) else {}
    if requirements.get("studio") and not studio_ready:
        return "finalize-ui-to-studio", "Run finalize_ui_to_studio.py so the real generated UI, identities, document, source map, and sync state enter Studio together."
    if requirements.get("browserE2E") and qa.get("browser", {}).get("state") != "passed":
        return "run-browser-journey-qa", "Replay every contract journey and required viewport against the real project and save browser evidence."
    if requirements.get("designReview") and qa.get("design", {}).get("state") != "passed":
        return "run-design-director-review", "Run frontend hierarchy, icon asset, responsive, visual parity, and interaction-polish sign-offs; P0 must be zero."
    if requirements.get("roundtrip") and qa.get("roundtrip", {}).get("state") != "passed":
        return "verify-studio-roundtrip", "Save a Studio revision, apply it to source, verify the real preview, and prove rollback."
    if qa.get("delivery", {}).get("state") != "passed":
        return "run-delivery-gate", "Run the aggregate delivery hard gate; handoff is blocked until it passes."
    return "delivery-complete", "Capture, evidence, source, browser, design, Studio identity, roundtrip, and rollback gates all passed."


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path, nargs="?", default=Path.cwd(), help="Studio-enabled frontend project")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args()
    target = args.target.resolve()
    contract = contract_status(target)
    captures = capture_status(target)
    evidence = evidence_status(target)
    studio = studio_status(target)
    source = source_marker_status(target)
    project_menu = project_menu_status(target)
    qa = {
        "browser": qa_status(target, ".ui-job/browser-qa.json"),
        "design": qa_status(target, ".ui-job/design-review.json"),
        "roundtrip": qa_status(target, ".ui-job/roundtrip-qa.json"),
        "delivery": qa_status(target, ".ui-job/delivery-gate.json"),
    }
    action, explanation = next_action(captures, evidence, studio, contract, source, project_menu, qa)
    payload = {
        "target": str(target),
        "contract": contract,
        "captures": [
            {
                **item,
                "path": str(item["path"]),
                "specPath": str(item["specPath"]) if item.get("specPath") else None,
            }
            for item in captures
        ],
        "evidence": [
            {
                **item,
                "path": str(item["path"]),
                "specPath": str(item["specPath"]) if item.get("specPath") else None,
            }
            for item in evidence
        ],
        "studio": studio,
        "source": source,
        "projectMenu": project_menu,
        "qa": qa,
        "nextAction": action,
        "explanation": explanation,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    print("UI job status")
    print(f"Contract: {contract.get('state')} | {contract.get('pages', 0)} pages | {contract.get('journeys', 0)} journeys | {contract.get('viewports', 0)} viewports")
    if captures:
        for item in captures:
            compiled = "compiled" if item.get("compiled") else "not compiled"
            print(
                f"Capture {item['id']}: {item['status']} | {item.get('states', 0)} states | "
                f"{item.get('actions', 0)} actions | {item.get('approved', 0)} approved | "
                f"recorder {item.get('recorderStatus')} | {compiled}"
            )
    else:
        print("Capture: none")
    if evidence:
        for item in evidence:
            compiled = "compiled" if item.get("compiled") else "not compiled"
            print(f"Evidence {item['id']}: {item['status']} | {item.get('viewport')} | {item.get('nodes', 0)} nodes | {item.get('blocking', 0)} blocking | {compiled}")
    else:
        print("Evidence: none")
    if studio.get("installed"):
        print(
            f"Studio: {studio.get('state')} | import {studio.get('installationState')} | "
            f"{studio.get('editableObjectCount', 0)} editable | r{studio.get('revision')} | applied r{studio.get('appliedRevision')}"
        )
    else:
        print("Studio: not installed")
    print(f"Source marker: {source.get('state')}")
    print(f"Project menu: {project_menu.get('state')} | {project_menu.get('menuCount', 0)} identities")
    print(
        f"QA: browser {qa['browser'].get('state')} | design {qa['design'].get('state')} | "
        f"roundtrip {qa['roundtrip'].get('state')} | delivery {qa['delivery'].get('state')}"
    )
    print(f"Next action: {action}")
    print(explanation)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
