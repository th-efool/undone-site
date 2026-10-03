#!/usr/bin/env python3
"""Attach the bundled Studio to the current generated UI and prove the import."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from verify_studio_contract import verify as verify_studio


SCRIPT_ROOT = Path(__file__).resolve().parent
SOURCE_MARKER = Path(".ui-job/source-generation.json")
RECEIPT = Path(".ui-job/studio-installation.json")
STUDIO_STATE_FILES = (
    ".ui-studio/ui-document.json",
    ".ui-studio/sync-state.json",
    ".ui-studio/source-map.json",
    ".ui-studio/identity-registry.json",
    ".ui-studio/handoff.json",
    ".ui-studio/evidence.json",
    ".ui-studio/operations.jsonl",
)
IDENTITY_PATTERN = re.compile(r"\bdata-ui-id\s*=\s*([\"'])(?P<id>[^\"']+)\1")
SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path, help="Generated frontend project")
    parser.add_argument(
        "--force-template",
        action="store_true",
        help="Refresh Studio engine files without overwriting production UI or source-connected edits",
    )
    return parser.parse_args()


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def resolve_inside(target: Path, relative: str) -> Path:
    path = (target / relative).resolve()
    path.relative_to(target)
    return path


def current_generated_sources(target: Path, marker: dict) -> tuple[list[dict], dict[str, list[dict]]]:
    entries = marker.get("sourceFiles") if isinstance(marker.get("sourceFiles"), list) else []
    if not entries:
        raise ValueError("source-generation.json contains no production source files")
    identities: dict[str, list[dict]] = {}
    current_entries: list[dict] = []
    for item in entries:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            raise ValueError("source-generation.json contains an invalid source file entry")
        relative = str(item["path"])
        path = resolve_inside(target, relative)
        if not path.is_file():
            raise ValueError(f"generated source is missing: {relative}")
        digest = sha256(path)
        if item.get("sha256") != digest:
            raise ValueError(f"generated source is stale: {relative}; refresh the source marker first")
        current_entries.append({"path": relative.replace("\\", "/"), "sha256": digest, "bytes": path.stat().st_size})
        if path.suffix.lower() not in {".html", ".js", ".jsx", ".ts", ".tsx", ".vue"}:
            continue
        text = path.read_text(encoding="utf-8")
        for match in IDENTITY_PATTERN.finditer(text):
            identity = match.group("id").strip()
            if not SAFE_ID_PATTERN.fullmatch(identity):
                raise ValueError(f"unsafe or dynamic data-ui-id in {relative}: {identity}")
            line = text.count("\n", 0, match.start()) + 1
            identities.setdefault(identity, []).append({"file": relative.replace("\\", "/"), "line": line})
    if not identities:
        raise ValueError("generated UI has no stable data-ui-id objects to edit in Studio")
    duplicates = sorted(identity for identity, locations in identities.items() if len(locations) > 1)
    if duplicates:
        raise ValueError("duplicate data-ui-id values block Studio import: " + ", ".join(duplicates))
    return current_entries, identities


def run(command: list[str], target: Path) -> None:
    result = subprocess.run(command, cwd=target, text=True, capture_output=True, encoding="utf-8", errors="replace")
    if result.returncode:
        detail = (result.stderr or result.stdout).strip()
        raise RuntimeError(f"command failed ({' '.join(command)}): {detail}")


def install_template(target: Path, force: bool) -> None:
    report = verify_studio(target)
    if report.get("ok") and not force:
        return
    command = [sys.executable, str(SCRIPT_ROOT / "scaffold_studio.py"), str(target)]
    if force:
        command.append("--force")
    run(command, target)


def write_receipt(target: Path, document: dict, sync: dict, source_map: dict, identity: dict,
                  source_entries: list[dict], source_marker_path: Path) -> Path:
    identity_ids = sorted(str(item.get("id")) for item in identity.get("entries", []) if isinstance(item, dict) and item.get("id"))
    identity_digest = hashlib.sha256("\n".join(identity_ids).encode("utf-8")).hexdigest()
    receipt = {
        "schemaVersion": 1,
        "status": "ready",
        "installedAt": now(),
        "importMode": "live-production-dom",
        "productionEntry": "index.html",
        "studioEntry": "studio.html",
        "sourceMarker": str(SOURCE_MARKER).replace("\\", "/"),
        "sourceMarkerSha256": sha256(source_marker_path),
        "sourceFiles": source_entries,
        "uiDocument": ".ui-studio/ui-document.json",
        "syncState": ".ui-studio/sync-state.json",
        "sourceMap": ".ui-studio/source-map.json",
        "identityRegistry": ".ui-studio/identity-registry.json",
        "documentVersion": int(document.get("version") or 0),
        "documentRevision": int(document.get("revision") or 0),
        "editableObjectCount": int(identity.get("identityCount") or 0),
        "identityIdsSha256": identity_digest,
        "checks": {
            "realGeneratedSourcePreserved": "passed",
            "studioContract": "passed",
            "projectStateInitialized": "passed",
            "stableIdentityRegistry": "passed",
            "sourceMappingInitialized": "passed" if source_map.get("selectors") == "data-ui-id" else "failed",
            "cleanInitialSync": "passed" if sync.get("state") == "clean" else "failed",
        },
    }
    path = target / RECEIPT
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    return path


def main() -> int:
    args = parse_args()
    target = args.target.resolve()
    try:
        source_marker_path = target / SOURCE_MARKER
        marker = read_json(source_marker_path)
        if marker.get("schemaVersion") != 1 or marker.get("status") != "generated":
            raise ValueError("source-generation.json must be generated schemaVersion 1")
        source_entries, source_identities = current_generated_sources(target, marker)
        before = {entry["path"]: entry["sha256"] for entry in source_entries}

        install_template(target, args.force_template)
        after_entries, _ = current_generated_sources(target, marker)
        after = {entry["path"]: entry["sha256"] for entry in after_entries}
        if before != after:
            raise ValueError("Studio installation changed generated production source")

        node = shutil.which("node")
        if not node:
            raise RuntimeError("Node.js is required to initialize the Studio source bridge")
        run([node, "ui-sync.mjs", "init"], target)
        run([node, "ui-sync.mjs", "context"], target)

        report = verify_studio(target)
        if not report.get("ok"):
            raise ValueError("Studio contract failed after installation: " + json.dumps(report, ensure_ascii=False))
        for relative in STUDIO_STATE_FILES:
            if not (target / relative).is_file():
                raise ValueError(f"Studio did not initialize project state: {relative}")

        document = read_json(target / ".ui-studio/ui-document.json")
        sync = read_json(target / ".ui-studio/sync-state.json")
        source_map = read_json(target / ".ui-studio/source-map.json")
        identity = read_json(target / ".ui-studio/identity-registry.json")
        registry_ids = {
            str(item.get("id")) for item in identity.get("entries", [])
            if isinstance(item, dict) and item.get("id")
        }
        missing = sorted(set(source_identities) - registry_ids)
        if missing:
            raise ValueError(
                "Studio source adapter did not import all generated identities: " + ", ".join(missing)
                + "; use the dependency-free index.html/app.js adapter or add a framework adapter"
            )
        if identity.get("duplicateIds") or identity.get("unresolvedTargetIds"):
            raise ValueError("Studio identity registry contains duplicate or unresolved IDs")
        if int(identity.get("identityCount") or 0) < 1:
            raise ValueError("Studio imported zero editable objects")
        if document.get("version") != 4:
            raise ValueError("Studio did not initialize UI Document V4")
        if sync.get("state") != "clean" or int(sync.get("documentRevision") or 0) != int(sync.get("appliedRevision") or 0):
            raise ValueError("Studio initial sync state is not clean")

        receipt = write_receipt(target, document, sync, source_map, identity, source_entries, source_marker_path)
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"Finalize UI to Studio: FAIL - {error}", file=sys.stderr)
        return 1

    print("Finalize UI to Studio: PASS")
    print(f"Production UI: {target / 'index.html'}")
    print(f"Studio: {target / 'studio.html'}")
    print(f"Editable objects: {identity.get('identityCount')}")
    print(f"Receipt: {receipt}")
    print("Next: npm run studio:start")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
