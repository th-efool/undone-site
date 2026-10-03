#!/usr/bin/env python3
"""Run the final evidence, source, design, browser, and Studio delivery hard gate."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from validate_evidence_map import validate as validate_evidence
from validate_project_menu import validate as validate_project_menu
from validate_website_capture import validate_capture
from verify_studio_contract import verify as verify_studio


SUSPICIOUS_UNICODE = set("⌂⠿▣◷▱◫⌘♧▦▤▶♥◈◔◇➤🎁♙◯♢")
EMOJI_PATTERN = re.compile("[\U0001F300-\U0001FAFF]")
DEFAULT_DELIVERABLES = {
    "sourceMarker": ".ui-job/source-generation.json",
    "iconInventory": ".ui-job/icon-inventory.json",
    "browserQa": ".ui-job/browser-qa.json",
    "designReview": ".ui-job/design-review.json",
    "roundtripQa": ".ui-job/roundtrip-qa.json",
    "studioInstallation": ".ui-job/studio-installation.json",
    "deliveryReport": ".ui-job/delivery-gate.json",
}
REQUIRED_COMPANION_SKILLS = {"frontend-skill", "emil-design-eng", "qinglu-ui-parity"}
NON_OPTIONAL_REQUIREMENTS = {
    "captureContract",
    "approvedStateEvidence",
    "atomicIconEvidence",
    "uniformVectorIconSystem",
    "p0IssuesMustBeZero",
}
EXCEPTIONAL_REQUIREMENTS = {"browserE2E", "studio", "roundtrip", "designReview"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def resolve_inside(target: Path, relative: str) -> Path:
    path = (target / relative).resolve()
    path.relative_to(target)
    return path


def hash_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_file(target: Path, relative: str, errors: list[str]) -> Path | None:
    try:
        path = resolve_inside(target, relative)
    except ValueError:
        errors.append(f"deliverable escapes project root: {relative}")
        return None
    if not path.is_file():
        errors.append(f"missing deliverable: {relative}")
        return None
    return path


def validate_evidence_files(target: Path, values: object, label: str, errors: list[str], minimum: int = 1) -> None:
    if not isinstance(values, list) or len(values) < minimum:
        errors.append(f"{label} must contain at least {minimum} evidence file(s)")
        return
    for value in values:
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{label} contains an invalid evidence path")
            continue
        require_file(target, value, errors)


def validate_contract(contract: dict, errors: list[str]) -> None:
    requirements = contract.get("requirements") if isinstance(contract.get("requirements"), dict) else {}
    exceptions = contract.get("exceptions") if isinstance(contract.get("exceptions"), list) else []
    exception_reasons: dict[str, str] = {}
    for item in exceptions:
        if not isinstance(item, dict) or not isinstance(item.get("requirements"), list):
            errors.append("contract contains an invalid hard-gate exception")
            continue
        reason = str(item.get("reason") or "").strip()
        if not reason:
            errors.append("contract hard-gate exception has no reason")
        for name in item["requirements"]:
            if isinstance(name, str):
                exception_reasons[name] = reason
    for name in sorted(NON_OPTIONAL_REQUIREMENTS):
        if requirements.get(name) is not True:
            errors.append(f"non-optional hard-gate requirement is disabled: {name}")
    for name in sorted(EXCEPTIONAL_REQUIREMENTS):
        if requirements.get(name) is not True and not exception_reasons.get(name):
            errors.append(f"disabled hard-gate requirement has no recorded exception: {name}")
    if requirements.get("studio") is not True and requirements.get("roundtrip") is True:
        errors.append("roundtrip cannot be required when Studio is disabled")
    required_skills = set(requirements.get("requiredCompanionSkills", [])) if isinstance(requirements.get("requiredCompanionSkills"), list) else set()
    for skill in sorted(REQUIRED_COMPANION_SKILLS - required_skills):
        errors.append(f"contract omits mandatory companion skill: {skill}")


def scope_ids(contract: dict, key: str, prefix: str) -> set[str]:
    scope = contract.get("scope") if isinstance(contract.get("scope"), dict) else {}
    items = scope.get(key) if isinstance(scope.get(key), list) else []
    return {str(item.get("id")) for item in items if isinstance(item, dict) and str(item.get("id") or "").startswith(prefix)}


def collect_capture_coverage(target: Path, errors: list[str]) -> tuple[set[str], set[str], dict[str, str], list[str]]:
    pages: set[str] = set()
    journeys: set[str] = set()
    state_evidence: dict[str, str] = {}
    interaction_specs: list[str] = []
    manifests = sorted((target / "artifacts" / "ui-capture").glob("*/capture-manifest.json"))
    if not manifests:
        errors.append("no website capture manifest exists")
        return pages, journeys, state_evidence, interaction_specs
    for manifest in manifests:
        try:
            document = read_json(manifest)
            validate_capture(document, manifest)
        except (OSError, json.JSONDecodeError, ValueError) as error:
            errors.append(f"invalid capture {manifest.relative_to(target)}: {error}")
            continue
        graph = document.get("stateGraph") if isinstance(document.get("stateGraph"), dict) else {}
        states = graph.get("states") if isinstance(graph.get("states"), list) else []
        actions = graph.get("actions") if isinstance(graph.get("actions"), list) else []
        handoff = document.get("handoff") if isinstance(document.get("handoff"), dict) else {}
        approved = set(handoff.get("approvedStateIds", [])) if isinstance(handoff.get("approvedStateIds"), list) else set()
        for state in states:
            if not isinstance(state, dict):
                continue
            page_id = state.get("pageId")
            if isinstance(page_id, str):
                pages.add(page_id)
            state_id = state.get("id")
            evidence_id = state.get("evidenceId")
            if state_id in approved and isinstance(state_id, str) and isinstance(evidence_id, str):
                state_evidence[state_id] = evidence_id
        for action in actions:
            if isinstance(action, dict) and isinstance(action.get("journeyId"), str):
                journeys.add(str(action["journeyId"]))
        run = document.get("run") if isinstance(document.get("run"), dict) else {}
        run_id = str(run.get("id") or "")
        relative = f"artifacts/ui-spec/{run_id}.interaction.json"
        if require_file(target, relative, errors):
            interaction_specs.append(relative)
    return pages, journeys, state_evidence, interaction_specs


def validate_evidence_coverage(target: Path, state_evidence: dict[str, str], errors: list[str]) -> list[str]:
    specs: list[str] = []
    for state_id, evidence_id in sorted(state_evidence.items()):
        map_relative = f"artifacts/ui-evidence/{evidence_id}.json"
        spec_relative = f"artifacts/ui-spec/{evidence_id}.json"
        map_path = require_file(target, map_relative, errors)
        spec_path = require_file(target, spec_relative, errors)
        if map_path:
            try:
                validate_evidence(read_json(map_path))
            except (OSError, json.JSONDecodeError, ValueError) as error:
                errors.append(f"invalid evidence for {state_id}: {error}")
        if spec_path:
            specs.append(spec_relative)
    return specs


def validate_source_marker(target: Path, path: Path | None, expected_specs: set[str], expected_interactions: set[str], errors: list[str]) -> list[str]:
    if path is None:
        return []
    try:
        marker = read_json(path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        errors.append(f"invalid source marker: {error}")
        return []
    if marker.get("schemaVersion") != 1 or marker.get("status") != "generated":
        errors.append("source marker must be generated schemaVersion 1")
    source_files = marker.get("sourceFiles") if isinstance(marker.get("sourceFiles"), list) else []
    recorded_specs = {str(item.get("path")) for item in marker.get("compiledUiSpecs", []) if isinstance(item, dict)}
    recorded_interactions = {str(item.get("path")) for item in marker.get("compiledInteractionSpecs", []) if isinstance(item, dict)}
    missing_specs = expected_specs - recorded_specs
    missing_interactions = expected_interactions - recorded_interactions
    if missing_specs:
        errors.append("source marker omits UI specs: " + ", ".join(sorted(missing_specs)))
    if missing_interactions:
        errors.append("source marker omits interaction specs: " + ", ".join(sorted(missing_interactions)))
    relative_sources: list[str] = []
    if not source_files:
        errors.append("source marker contains no source files")
    for item in source_files:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            errors.append("source marker has an invalid source file entry")
            continue
        relative = str(item["path"])
        source = require_file(target, relative, errors)
        if source:
            relative_sources.append(relative)
            if item.get("sha256") != hash_path(source):
                errors.append(f"production source changed after generation marker: {relative}")
    for collection_name in ("compiledUiSpecs", "compiledInteractionSpecs"):
        entries = marker.get(collection_name) if isinstance(marker.get(collection_name), list) else []
        for item in entries:
            if not isinstance(item, dict) or not isinstance(item.get("path"), str):
                errors.append(f"source marker has an invalid {collection_name} entry")
                continue
            artifact = require_file(target, str(item["path"]), errors)
            if artifact and item.get("sha256") != hash_path(artifact):
                errors.append(f"compiled artifact changed after source generation: {item['path']}")
    return relative_sources


def validate_browser_qa(target: Path, contract: dict, path: Path | None, errors: list[str]) -> None:
    if path is None:
        return
    try:
        qa = read_json(path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        errors.append(f"invalid browser QA: {error}")
        return
    if qa.get("schemaVersion") != 1 or qa.get("status") != "passed":
        errors.append("browser QA must be passed schemaVersion 1")
    required = scope_ids(contract, "journeys", "journey.")
    journeys = qa.get("journeys") if isinstance(qa.get("journeys"), list) else []
    passed: set[str] = set()
    for item in journeys:
        if not isinstance(item, dict) or item.get("status") != "passed":
            continue
        journey_id = str(item.get("id") or "")
        validate_evidence_files(target, item.get("evidence"), f"browser QA {journey_id}", errors)
        if not isinstance(item.get("steps"), list) or not item.get("steps"):
            errors.append(f"browser QA {journey_id} has no replay steps")
        else:
            passed.add(journey_id)
    for journey_id in sorted(required - passed):
        errors.append(f"browser QA has no passing evidence for {journey_id}")
    required_viewports = scope_ids(contract, "viewports", "vp-")
    checked_viewports = set(qa.get("viewportIds", [])) if isinstance(qa.get("viewportIds"), list) else set()
    for viewport_id in sorted(required_viewports - checked_viewports):
        errors.append(f"browser QA did not cover required viewport {viewport_id}")


def validate_design_review(target: Path, contract: dict, path: Path | None, source_files: list[str], errors: list[str]) -> None:
    if path is None:
        return
    try:
        review = read_json(path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        errors.append(f"invalid design review: {error}")
        return
    if review.get("schemaVersion") != 1 or review.get("status") != "passed":
        errors.append("design review must be passed schemaVersion 1")
    if int(review.get("p0IssueCount") or 0) != 0:
        errors.append("design review still contains P0 issues")
    requirements = contract.get("requirements") if isinstance(contract.get("requirements"), dict) else {}
    required_skills = set(requirements.get("requiredCompanionSkills", [])) if isinstance(requirements.get("requiredCompanionSkills"), list) else set()
    signed_skills = set(review.get("skillSignoffs", [])) if isinstance(review.get("skillSignoffs"), list) else set()
    for skill in sorted(required_skills - signed_skills):
        errors.append(f"missing required design/parity sign-off: {skill}")
    reviews = review.get("reviews") if isinstance(review.get("reviews"), dict) else {}
    for skill in sorted(required_skills):
        item = reviews.get(skill)
        if not isinstance(item, dict) or item.get("status") != "passed":
            errors.append(f"missing passed review record for: {skill}")
            continue
        if not isinstance(item.get("reviewedAt"), str) or not str(item.get("reviewedAt")).strip():
            errors.append(f"review record has no timestamp: {skill}")
        validate_evidence_files(target, item.get("evidence"), f"design review {skill}", errors)
    checks = review.get("checks") if isinstance(review.get("checks"), dict) else {}
    for key in ("hierarchy", "responsive", "iconSystem", "interactionPolish", "visualParity"):
        if checks.get(key) != "passed":
            errors.append(f"design review check did not pass: {key}")
    allowed = set(review.get("allowedUnicodeIcons", [])) if isinstance(review.get("allowedUnicodeIcons"), list) else set()
    for relative in source_files:
        path = target / relative
        if path.suffix.lower() not in {".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".vue"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as error:
            errors.append(f"cannot scan icon quality in {relative}: {error}")
            continue
        suspects = (set(text) & SUSPICIOUS_UNICODE) | set(EMOJI_PATTERN.findall(text))
        suspects -= allowed
        if suspects:
            errors.append(f"Unicode/Emoji product icons are forbidden in {relative}: {' '.join(sorted(suspects))}")


def validate_icon_inventory(target: Path, path: Path | None, source_files: list[str], errors: list[str]) -> None:
    if path is None:
        return
    try:
        inventory = read_json(path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        errors.append(f"invalid icon inventory: {error}")
        return
    if inventory.get("schemaVersion") != 1 or inventory.get("status") != "passed":
        errors.append("icon inventory must be passed schemaVersion 1")
    items = inventory.get("items") if isinstance(inventory.get("items"), list) else []
    if not items:
        errors.append("icon inventory contains no independently addressable icons")
        return
    source_text = "\n".join(
        (target / relative).read_text(encoding="utf-8")
        for relative in source_files
        if (target / relative).suffix.lower() in {".html", ".js", ".jsx", ".ts", ".tsx", ".vue"}
    )
    ids: set[str] = set()
    families: set[str] = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            errors.append(f"icon inventory item {index} must be an object")
            continue
        icon_id = item.get("id")
        if not isinstance(icon_id, str) or not icon_id.strip():
            errors.append(f"icon inventory item {index} has no stable id")
            continue
        if icon_id in ids:
            errors.append(f"duplicate icon identity in inventory: {icon_id}")
        ids.add(icon_id)
        if item.get("assetType") != "svg":
            errors.append(f"product icon must use SVG: {icon_id}")
        if item.get("status") != "verified":
            errors.append(f"icon is not verified: {icon_id}")
        family = item.get("family")
        if not isinstance(family, str) or not family.strip():
            errors.append(f"icon has no family: {icon_id}")
        else:
            families.add(family)
        if f'data-ui-id="{icon_id}"' not in source_text and f"data-ui-id='{icon_id}'" not in source_text:
            errors.append(f"icon identity is not present in production source: {icon_id}")
    if len(families) > 1:
        errors.append("mixed icon families are forbidden without an explicit regional exception: " + ", ".join(sorted(families)))


def validate_roundtrip(target: Path, path: Path | None, errors: list[str]) -> None:
    if path is None:
        return
    try:
        qa = read_json(path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        errors.append(f"invalid roundtrip QA: {error}")
        return
    if qa.get("schemaVersion") != 1 or qa.get("status") != "passed":
        errors.append("roundtrip QA must be passed schemaVersion 1")
    if not isinstance(qa.get("appliedRevision"), int) or int(qa.get("appliedRevision") or 0) < 1:
        errors.append("roundtrip QA must prove at least one applied Studio revision")
    if qa.get("realPreviewVerified") is not True:
        errors.append("roundtrip QA must verify the real project preview")
    if qa.get("rollbackVerified") is not True:
        errors.append("roundtrip QA must verify rollback")
    validate_evidence_files(target, qa.get("evidence"), "roundtrip QA", errors, minimum=2)


def validate_studio_installation(target: Path, path: Path | None, source_marker_path: Path | None,
                                 errors: list[str]) -> None:
    if path is None:
        return
    try:
        receipt = read_json(path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        errors.append(f"invalid Studio installation receipt: {error}")
        return
    if receipt.get("schemaVersion") != 1 or receipt.get("status") != "ready":
        errors.append("Studio installation must be ready schemaVersion 1")
    if receipt.get("importMode") != "live-production-dom":
        errors.append("Studio must import the real generated UI through the live production DOM")
    for field, expected in (
        ("productionEntry", "index.html"),
        ("studioEntry", "studio.html"),
        ("uiDocument", ".ui-studio/ui-document.json"),
        ("syncState", ".ui-studio/sync-state.json"),
        ("sourceMap", ".ui-studio/source-map.json"),
        ("identityRegistry", ".ui-studio/identity-registry.json"),
    ):
        if receipt.get(field) != expected:
            errors.append(f"Studio installation has an unexpected {field}: {receipt.get(field)}")
        else:
            require_file(target, expected, errors)
    checks = receipt.get("checks") if isinstance(receipt.get("checks"), dict) else {}
    for name in (
        "realGeneratedSourcePreserved",
        "studioContract",
        "projectStateInitialized",
        "stableIdentityRegistry",
        "sourceMappingInitialized",
        "cleanInitialSync",
    ):
        if checks.get(name) != "passed":
            errors.append(f"Studio installation check did not pass: {name}")

    marker = None
    if source_marker_path is None:
        errors.append("Studio installation cannot be tied to a missing source-generation marker")
    else:
        try:
            marker = read_json(source_marker_path)
            if receipt.get("sourceMarkerSha256") != hash_path(source_marker_path):
                errors.append("Studio installation receipt is stale for the current source-generation marker")
        except (OSError, json.JSONDecodeError, ValueError) as error:
            errors.append(f"cannot verify Studio source marker: {error}")

    marker_files = {
        str(item.get("path")): str(item.get("sha256"))
        for item in (marker.get("sourceFiles", []) if isinstance(marker, dict) and isinstance(marker.get("sourceFiles"), list) else [])
        if isinstance(item, dict) and isinstance(item.get("path"), str)
    }
    receipt_files = receipt.get("sourceFiles") if isinstance(receipt.get("sourceFiles"), list) else []
    recorded_files: dict[str, str] = {}
    source_ids: set[str] = set()
    for item in receipt_files:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            errors.append("Studio installation contains an invalid source file record")
            continue
        relative = str(item["path"])
        recorded_files[relative] = str(item.get("sha256") or "")
        source = require_file(target, relative, errors)
        if source is None:
            continue
        if item.get("sha256") != hash_path(source):
            errors.append(f"Studio installation source hash is stale: {relative}")
        if source.suffix.lower() in {".html", ".js", ".jsx", ".ts", ".tsx", ".vue"}:
            try:
                source_text = source.read_text(encoding="utf-8")
                source_ids.update(match.group(2).strip() for match in re.finditer(r"\bdata-ui-id\s*=\s*([\"'])([^\"']+)\1", source_text))
            except (OSError, UnicodeDecodeError) as error:
                errors.append(f"cannot inspect Studio identities in {relative}: {error}")
    if marker_files != recorded_files:
        errors.append("Studio installation does not cover exactly the current generated source files")

    identity_path = target / ".ui-studio" / "identity-registry.json"
    if identity_path.is_file():
        try:
            identity = read_json(identity_path)
            registry_ids = sorted(
                str(item.get("id")) for item in identity.get("entries", [])
                if isinstance(item, dict) and item.get("id")
            )
            identity_digest = hashlib.sha256("\n".join(registry_ids).encode("utf-8")).hexdigest()
            identity_count = int(identity.get("identityCount") or 0)
            if identity_count < 1 or int(receipt.get("editableObjectCount") or 0) != identity_count:
                errors.append("Studio installation did not import a non-empty matching editable-object registry")
            if receipt.get("identityIdsSha256") != identity_digest:
                errors.append("Studio installation identity receipt is stale")
            if set(registry_ids) != source_ids:
                errors.append("Studio editable identities do not exactly match generated source identities")
        except (OSError, json.JSONDecodeError, ValueError) as error:
            errors.append(f"cannot verify Studio identity import: {error}")


def validate_studio_state(target: Path, errors: list[str]) -> None:
    report = verify_studio(target)
    if not report.get("ok"):
        errors.append("Studio contract failed: " + json.dumps(report, ensure_ascii=False))
        return
    for relative in (".ui-studio/identity-registry.json", ".ui-studio/sync-state.json", ".ui-studio/handoff.json"):
        if not (target / relative).is_file():
            errors.append(f"missing Studio state: {relative}")
    identity_path = target / ".ui-studio" / "identity-registry.json"
    sync_path = target / ".ui-studio" / "sync-state.json"
    if identity_path.is_file():
        try:
            identity = read_json(identity_path)
            if identity.get("duplicateIds") or identity.get("unresolvedTargetIds") or int(identity.get("identityCount") or 0) < 1:
                errors.append("Studio identity registry is not uniquely resolvable")
        except (OSError, json.JSONDecodeError, ValueError) as error:
            errors.append(f"invalid Studio identity registry: {error}")
    if sync_path.is_file():
        try:
            sync = read_json(sync_path)
            if sync.get("state") != "clean":
                errors.append("Studio sync state must be clean")
            if int(sync.get("documentRevision") or 0) != int(sync.get("appliedRevision") or -1):
                errors.append("Studio document revision has not been fully applied")
        except (OSError, json.JSONDecodeError, ValueError) as error:
            errors.append(f"invalid Studio sync state: {error}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path)
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()
    target = args.target.resolve()
    errors: list[str] = []
    warnings: list[str] = []
    contract_path = target / ".ui-job" / "job-contract.json"
    try:
        contract = read_json(contract_path)
        if contract.get("schemaVersion") != 1 or contract.get("status") != "ready":
            errors.append("UI job contract must be ready schemaVersion 1")
        validate_contract(contract, errors)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        contract = {}
        errors.append(f"missing or invalid UI job contract: {error}")

    requirements = contract.get("requirements") if isinstance(contract.get("requirements"), dict) else {}
    deliverables = {**DEFAULT_DELIVERABLES, **(contract.get("deliverables") if isinstance(contract.get("deliverables"), dict) else {})}
    pages, journeys, state_evidence, interaction_specs = collect_capture_coverage(target, errors)
    for page_id in sorted(scope_ids(contract, "pages", "page.") - pages):
        errors.append(f"capture coverage is missing page {page_id}")
    for journey_id in sorted(scope_ids(contract, "journeys", "journey.") - journeys):
        errors.append(f"capture coverage is missing journey {journey_id}")
    ui_specs = validate_evidence_coverage(target, state_evidence, errors)
    project_menu_report = validate_project_menu(target)
    errors.extend(f"project-menu: {message}" for message in project_menu_report["errors"])

    source_marker_path = require_file(target, str(deliverables["sourceMarker"]), errors)
    source_files = validate_source_marker(target, source_marker_path, set(ui_specs), set(interaction_specs), errors)
    if requirements.get("atomicIconEvidence") or requirements.get("uniformVectorIconSystem"):
        validate_icon_inventory(target, require_file(target, str(deliverables["iconInventory"]), errors), source_files, errors)
    if requirements.get("browserE2E"):
        validate_browser_qa(target, contract, require_file(target, str(deliverables["browserQa"]), errors), errors)
    if requirements.get("designReview"):
        validate_design_review(target, contract, require_file(target, str(deliverables["designReview"]), errors), source_files, errors)
    if requirements.get("studio"):
        validate_studio_installation(
            target,
            require_file(target, str(deliverables["studioInstallation"]), errors),
            source_marker_path,
            errors,
        )
        validate_studio_state(target, errors)
    if requirements.get("roundtrip"):
        validate_roundtrip(target, require_file(target, str(deliverables["roundtripQa"]), errors), errors)

    report = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "checkedAt": now(),
        "target": str(target),
        "coverage": {
            "pages": sorted(pages),
            "journeys": sorted(journeys),
            "approvedStateEvidence": len(state_evidence),
            "compiledUiSpecs": len(ui_specs),
            "compiledInteractionSpecs": len(interaction_specs),
            "projectMenuIdentities": project_menu_report["menuCount"],
        },
        "errors": errors,
        "warnings": warnings,
    }
    report_relative = str(deliverables.get("deliveryReport") or DEFAULT_DELIVERABLES["deliveryReport"])
    try:
        report_path = resolve_inside(target, report_relative)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError) as error:
        errors.append(f"cannot write delivery report: {error}")
        report["status"] = "failed"

    if args.as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print("UI delivery gate: " + ("PASS" if report["status"] == "passed" else "FAIL"))
        print(f"Pages: {len(pages)}; journeys: {len(journeys)}; approved evidence: {len(state_evidence)}; UI specs: {len(ui_specs)}")
        for message in errors:
            print(f"- {message}", file=sys.stderr)
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
