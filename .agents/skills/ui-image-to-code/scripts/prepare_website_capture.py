#!/usr/bin/env python3
"""Initialize a Codex-driven black-box website capture job."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


ID_PATTERN = re.compile(r"[^a-z0-9-]+")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Authorized HTTP(S) seed URL")
    parser.add_argument("target", type=Path, help="Target frontend project")
    parser.add_argument("--id", dest="run_id", help="Stable capture run ID")
    parser.add_argument("--profile", choices=("blind-visual", "authorized-semantic"), default="blind-visual")
    parser.add_argument("--viewport", action="append", default=[], help="WIDTHxHEIGHT; repeat for multiple viewports")
    parser.add_argument("--max-states", type=int, default=60)
    parser.add_argument("--max-depth", type=int, default=4)
    parser.add_argument("--contract", type=Path, help="UI job contract; defaults to TARGET/.ui-job/job-contract.json")
    parser.add_argument("--page-id", action="append", default=[], help="Contract page ID covered by this capture run; repeat as needed")
    parser.add_argument("--journey-id", action="append", default=[], help="Contract journey ID covered by this capture run; repeat as needed")
    parser.add_argument("--force", action="store_true", help="Replace an empty draft job with the same ID")
    return parser.parse_args()


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_url(value: str) -> tuple[str, str]:
    parsed = urlsplit(value.strip())
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError("URL must use http or https and include a host")
    host = parsed.hostname.lower()
    port = parsed.port
    netloc = host if port is None else f"{host}:{port}"
    path = parsed.path or "/"
    return urlunsplit((parsed.scheme.lower(), netloc, path, parsed.query, "")), f"{parsed.scheme.lower()}://{netloc}"


def normalized_id(value: str) -> str:
    result = ID_PATTERN.sub("-", value.lower()).strip("-")[:64]
    if not result:
        raise ValueError("run ID must contain a letter or digit")
    return result


def parse_viewport(value: str) -> dict[str, int | str]:
    match = re.fullmatch(r"\s*(\d{2,5})\s*[xX×]\s*(\d{2,5})\s*", value)
    if not match:
        raise ValueError(f"invalid viewport {value!r}; expected WIDTHxHEIGHT")
    width, height = map(int, match.groups())
    if width < 240 or height < 240 or width * height > 100_000_000:
        raise ValueError(f"viewport out of range: {width}x{height}")
    return {"id": f"vp-{width}x{height}", "width": width, "height": height}


def load_contract(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot read UI job contract {path}: {error}") from error
    if not isinstance(value, dict) or value.get("schemaVersion") != 1 or value.get("status") != "ready":
        raise ValueError("UI job contract must be a ready schemaVersion 1 object")
    scope = value.get("scope") if isinstance(value.get("scope"), dict) else {}
    pages = scope.get("pages") if isinstance(scope.get("pages"), list) else []
    journeys = scope.get("journeys") if isinstance(scope.get("journeys"), list) else []
    if not pages:
        raise ValueError("UI job contract must declare at least one required page")
    return value


def main() -> int:
    args = parse_args()
    try:
        seed_url, origin = normalize_url(args.url)
        if not 1 <= args.max_states <= 500:
            raise ValueError("--max-states must be between 1 and 500")
        if not 0 <= args.max_depth <= 20:
            raise ValueError("--max-depth must be between 0 and 20")
        viewports = [parse_viewport(value) for value in (args.viewport or ["1440x900"])]
        if len({item["id"] for item in viewports}) != len(viewports):
            raise ValueError("duplicate viewport")
        default_slug = normalized_id(urlsplit(seed_url).hostname or "website")
        digest = hashlib.sha256(f"{seed_url}|{args.profile}".encode("utf-8")).hexdigest()[:8]
        run_id = normalized_id(args.run_id or f"{default_slug}-{digest}")
        target = args.target.resolve()
        contract_path = (args.contract.resolve() if args.contract else target / ".ui-job" / "job-contract.json")
        contract = load_contract(contract_path)
        contract_bytes = contract_path.read_bytes()
        contract_relative = contract_path.relative_to(target)
        scope = contract.get("scope") if isinstance(contract.get("scope"), dict) else {}
        contract_page_ids = {str(item.get("id")) for item in scope.get("pages", []) if isinstance(item, dict)}
        contract_journey_ids = {str(item.get("id")) for item in scope.get("journeys", []) if isinstance(item, dict)}
        selected_page_ids = set(args.page_id) if args.page_id else contract_page_ids
        selected_journey_ids = set(args.journey_id) if args.journey_id else contract_journey_ids
        if not selected_page_ids or not selected_page_ids <= contract_page_ids:
            raise ValueError("capture --page-id values must be a non-empty subset of contract pages")
        if not selected_journey_ids <= contract_journey_ids:
            raise ValueError("capture --journey-id values must be a subset of contract journeys")
    except (OSError, ValueError) as error:
        print(f"Prepare website capture: FAIL - {error}", file=sys.stderr)
        return 1

    run_dir = target / "artifacts" / "ui-capture" / run_id
    manifest_path = run_dir / "capture-manifest.json"
    if manifest_path.exists() and not args.force:
        print(f"Prepare website capture: FAIL - job already exists: {run_id}; resume it or use --force", file=sys.stderr)
        return 1
    if args.force and run_dir.exists():
        non_manifest = [path for path in run_dir.rglob("*") if path.is_file() and path != manifest_path]
        if non_manifest:
            print("Prepare website capture: FAIL - refusing to replace a job that already contains evidence", file=sys.stderr)
            return 1

    for name in ("screenshots", "recordings", "actions", "states", "motion", "masks", "reports"):
        (run_dir / name).mkdir(parents=True, exist_ok=True)

    created_at = now()
    document = {
        "schemaVersion": 1,
        "status": "draft",
        "contract": {
            "path": str(contract_relative).replace("\\", "/"),
            "sha256": hashlib.sha256(contract_bytes).hexdigest(),
            "requiredPageIds": sorted(selected_page_ids),
            "requiredJourneyIds": sorted(selected_journey_ids),
        },
        "run": {
            "id": f"run.{run_id}",
            "seedUrl": seed_url,
            "allowedOrigins": [origin],
            "profile": args.profile,
            "createdAt": created_at,
            "updatedAt": created_at,
        },
        "policy": {
            "sameOriginOnly": True,
            "readOnlyExploration": True,
            "maxStates": args.max_states,
            "maxDepth": args.max_depth,
            "approvalRequired": [
                "authentication", "payment", "purchase", "delete", "publish", "submit",
                "upload-private-data", "send-message", "account-mutation", "cross-origin",
            ],
        },
        "viewports": viewports,
        "adapters": {
            "controller": {"kind": "codex", "status": "ready"},
            "browser": {"kind": "visible-ui-actuator", "status": "pending"},
            "recorder": {
                "kind": "optional-motion-observer",
                "status": "not-requested",
                "supports": ["video", "pointer-evidence", "transition-timing"],
                "requiredForStaticCapture": False,
            },
        },
        "stateGraph": {"states": [], "actions": []},
        "recordings": [],
        "motions": [],
        "interactionEvidence": {
            "status": "draft",
            "compiledSpec": f"../../ui-spec/run.{run_id}.interaction.json",
            "nextAction": "record-first-action-edge",
        },
        "coverage": {"visitedStateIds": [], "skipped": [], "blocked": []},
        "dynamicMasks": [],
        "handoff": {"stage": "codex-explore", "approvedStateIds": [], "nextAction": "open-seed-and-capture-initial-state"},
    }
    manifest_path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("Prepare website capture: PASS")
    print(f"Run: run.{run_id}")
    print(f"Manifest: {manifest_path}")
    print("Next: Codex opens the seed URL, captures every contract page and journey as settled approved states and action edges, validates the manifest, then compiles the interaction spec.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
