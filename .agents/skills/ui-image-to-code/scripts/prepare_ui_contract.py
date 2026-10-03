#!/usr/bin/env python3
"""Create the mandatory project contract used by the UI delivery hard gates."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


ID_PATTERN = re.compile(r"[^a-z0-9.-]+")
DEFAULT_COMPANION_SKILLS = ["frontend-skill", "emil-design-eng", "qinglu-ui-parity"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path, help="Target frontend project")
    parser.add_argument("--project-id", help="Stable project ID; defaults to the target directory name")
    parser.add_argument("--page", action="append", default=[], metavar="ID[:LABEL]", help="Required page; repeat as needed")
    parser.add_argument("--journey", action="append", default=[], metavar="ID[:LABEL]", help="Required interaction journey; repeat as needed")
    parser.add_argument("--viewport", action="append", default=[], help="Required WIDTHxHEIGHT viewport; repeat as needed")
    parser.add_argument("--no-studio", action="store_true", help="Exceptional opt-out: do not require the professional Studio")
    parser.add_argument("--no-roundtrip", action="store_true", help="Exceptional opt-out: do not require Studio-to-source roundtrip proof")
    parser.add_argument("--no-browser-e2e", action="store_true", help="Exceptional opt-out: do not require browser journey replay proof")
    parser.add_argument("--no-design-review", action="store_true", help="Exceptional opt-out: do not require visual director review")
    parser.add_argument("--exception-reason", help="Required explanation when any hard-gate requirement is disabled")
    parser.add_argument("--allow-source-inspection", action="store_true", help="Allow semantic source inspection of the reference")
    parser.add_argument("--companion-skill", action="append", default=[], help="Required design/parity skill sign-off")
    parser.add_argument("--force", action="store_true", help="Replace an existing contract")
    return parser.parse_args()


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def stable_id(value: str, prefix: str) -> str:
    cleaned = ID_PATTERN.sub("-", value.strip().lower()).strip("-.")
    if not cleaned:
        raise ValueError(f"{prefix} ID must contain a letter or digit")
    return cleaned if cleaned.startswith(f"{prefix}.") else f"{prefix}.{cleaned}"


def parse_named(value: str, prefix: str) -> dict[str, str]:
    raw_id, separator, label = value.partition(":")
    item_id = stable_id(raw_id, prefix)
    return {"id": item_id, "label": label.strip() if separator and label.strip() else raw_id.strip()}


def parse_viewport(value: str) -> dict[str, int | str]:
    match = re.fullmatch(r"\s*(\d{2,5})\s*[xX脳]\s*(\d{2,5})\s*", value)
    if not match:
        raise ValueError(f"invalid viewport {value!r}; expected WIDTHxHEIGHT")
    width, height = map(int, match.groups())
    if width < 240 or height < 240 or width * height > 100_000_000:
        raise ValueError(f"viewport out of range: {width}x{height}")
    return {"id": f"vp-{width}x{height}", "width": width, "height": height}


def unique(items: list[dict], kind: str) -> list[dict]:
    seen: set[str] = set()
    result: list[dict] = []
    for item in items:
        item_id = str(item["id"])
        if item_id in seen:
            raise ValueError(f"duplicate {kind} ID: {item_id}")
        seen.add(item_id)
        result.append(item)
    return result


def main() -> int:
    args = parse_args()
    try:
        target = args.target.resolve()
        project_id = stable_id(args.project_id or target.name, "project")
        pages = unique([parse_named(value, "page") for value in (args.page or ["home:Homepage"])], "page")
        journeys = unique([parse_named(value, "journey") for value in args.journey], "journey")
        viewports = unique([parse_viewport(value) for value in (args.viewport or ["1440x900", "390x844"])], "viewport")
        companion_skills = list(dict.fromkeys([*DEFAULT_COMPANION_SKILLS, *args.companion_skill]))
        disabled = [
            name
            for name, value in (
                ("studio", args.no_studio),
                ("roundtrip", args.no_roundtrip),
                ("browserE2E", args.no_browser_e2e),
                ("designReview", args.no_design_review),
            )
            if value
        ]
        exception_reason = (args.exception_reason or "").strip()
        if disabled and not exception_reason:
            raise ValueError("disabling a hard gate requires --exception-reason")
        if args.no_studio and not args.no_roundtrip:
            raise ValueError("--no-studio also requires --no-roundtrip because roundtrip depends on Studio")
    except (OSError, ValueError) as error:
        print(f"Prepare UI contract: FAIL - {error}", file=sys.stderr)
        return 1

    path = target / ".ui-job" / "job-contract.json"
    if path.exists() and not args.force:
        print(f"Prepare UI contract: FAIL - contract already exists: {path}; use --force to replace it", file=sys.stderr)
        return 1
    path.parent.mkdir(parents=True, exist_ok=True)

    timestamp = now()
    document = {
        "schemaVersion": 1,
        "status": "ready",
        "project": {
            "id": project_id,
            "root": ".",
            "createdAt": timestamp,
            "updatedAt": timestamp,
        },
        "scope": {
            "pages": pages,
            "journeys": journeys,
            "viewports": viewports,
        },
        "requirements": {
            "sourceBlindReference": not args.allow_source_inspection,
            "captureContract": True,
            "approvedStateEvidence": True,
            "atomicIconEvidence": True,
            "uniformVectorIconSystem": True,
            "browserE2E": not args.no_browser_e2e,
            "studio": not args.no_studio,
            "roundtrip": not args.no_roundtrip,
            "designReview": not args.no_design_review,
            "p0IssuesMustBeZero": True,
            "requiredCompanionSkills": companion_skills,
        },
        "exceptions": [
            {
                "requirements": disabled,
                "reason": exception_reason,
                "recordedAt": timestamp,
            }
        ] if disabled else [],
        "deliverables": {
            "captureRoot": "artifacts/ui-capture",
            "evidenceRoot": "artifacts/ui-evidence",
            "specRoot": "artifacts/ui-spec",
            "sourceMarker": ".ui-job/source-generation.json",
            "iconInventory": ".ui-job/icon-inventory.json",
            "browserQa": ".ui-job/browser-qa.json",
            "designReview": ".ui-job/design-review.json",
            "roundtripQa": ".ui-job/roundtrip-qa.json",
            "studioInstallation": ".ui-job/studio-installation.json",
            "deliveryReport": ".ui-job/delivery-gate.json",
            "studioRoot": ".ui-studio",
        },
    }
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Prepare UI contract: PASS")
    print(f"Contract: {path}")
    print(f"Pages: {len(pages)}; journeys: {len(journeys)}; viewports: {len(viewports)}")
    print("Next: prepare capture/evidence jobs against this contract. Generation and handoff remain blocked until the delivery gate passes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
