#!/usr/bin/env python3
"""Scan a live loopback project, measure real UI roots, and atomically write project-menu.json."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from validate_project_menu import STUDIO_TREE_CONTRACT, validate


EXCLUDED_PARTS = {".git", ".ui-job", ".ui-studio", "node_modules", "dist", "build", "coverage", "artifacts"}
SOURCE_SUFFIXES = {".html", ".css", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".json"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def source_inventory(target: Path) -> tuple[str, list[dict]]:
    files: list[Path] = []
    marker = target / ".ui-job" / "source-generation.json"
    if marker.is_file():
        try:
            data = json.loads(marker.read_text(encoding="utf-8"))
            for entry in data.get("sourceFiles", []):
                relative = entry.get("path") if isinstance(entry, dict) else None
                candidate = (target / str(relative)).resolve() if relative else None
                if candidate and candidate.is_file() and target in candidate.parents:
                    files.append(candidate)
        except (OSError, json.JSONDecodeError):
            files = []
    if not files:
        for path in target.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
                continue
            relative = path.relative_to(target)
            if any(part in EXCLUDED_PARTS or part.startswith(".") for part in relative.parts):
                continue
            files.append(path)
    unique = sorted(set(files), key=lambda path: path.relative_to(target).as_posix())
    digest = hashlib.sha256()
    entries: list[dict] = []
    for path in unique:
        relative = path.relative_to(target).as_posix()
        content = path.read_bytes()
        sha = hashlib.sha256(content).hexdigest()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(content)
        digest.update(b"\0")
        entries.append({"path": relative, "sha256": sha})
    if not entries:
        raise ValueError("no production source files were found")
    return digest.hexdigest(), entries


def read_snapshot(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or not isinstance(value.get("menus"), list):
        raise ValueError("browser snapshot must be an object with menus[]")
    return value


def capture_snapshot(script: Path, url: str, browser: str, timeout_ms: int) -> dict:
    command = ["node", str(script), "--url", url, "--timeout-ms", str(timeout_ms)]
    if browser:
        command.extend(["--browser", browser])
    completed = subprocess.run(command, text=True, encoding="utf-8", capture_output=True, check=False)
    if completed.returncode:
        raise RuntimeError(completed.stderr.strip() or "browser scan failed")
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        detail = completed.stderr.strip() or "no browser output"
        raise RuntimeError(f"browser scan returned invalid JSON: {error}; {detail}") from error


def normalize(snapshot: dict, source_hash: str, source_files: list[dict], scan_url: str) -> dict:
    measured_at = now()
    raw_menus = snapshot.get("menus") if isinstance(snapshot.get("menus"), list) else []
    menus: list[dict] = []
    for order, raw in enumerate(raw_menus):
        if not isinstance(raw, dict):
            continue
        menu_id = str(raw.get("id") or "").strip()
        label = " ".join(str(raw.get("label") or "").split())
        if not menu_id or not label:
            continue
        target = str(raw.get("destinationId") or raw.get("target") or menu_id.removeprefix("project-menu.")).strip()
        bound = raw.get("bound") is True and int(raw.get("layerCount") or 0) > 0
        kind = "page" if bound or raw.get("target") else ("state" if raw.get("action") else "external" if raw.get("href") else "unknown")
        trigger_value = str(raw.get("selector") or raw.get("href") or raw.get("action") or "").strip()
        trigger_kind = "selector" if raw.get("selector") else "href" if raw.get("href") else "action"
        item: dict = {
            "id": menu_id,
            "label": label,
            "language": str(snapshot.get("language") or "und"),
            "order": order,
            "parentId": raw.get("parentId") or None,
            "current": bool(raw.get("current") and bound and kind == "page"),
            "trigger": {"kind": trigger_kind, "value": trigger_value},
            "destination": {"kind": kind, "id": target or menu_id},
            "bound": bound,
            "rootId": str(raw.get("rootId") or "") or None,
            "evidence": [f"browser:project-menu-scan:{menu_id}"],
        }
        if bound:
            item["layerCount"] = {
                "source": "isolated-browser",
                "count": int(raw["layerCount"]),
                "measuredAt": measured_at,
            }
        elif kind == "state":
            item["layerCount"] = {"source": "dynamic", "count": 0, "measuredAt": measured_at}
        menus.append(item)
    bound_pages = [item for item in menus if item["bound"] and item["destination"]["kind"] == "page"]
    if not bound_pages:
        raise ValueError("scan found no bound production page")
    current = [item for item in bound_pages if item["current"]]
    if len(current) != 1:
        for item in menus:
            item["current"] = item is bound_pages[0]
    return {
        "schemaVersion": 1,
        "status": "ready",
        "mode": "authorized-source-aware",
        "scannedAt": measured_at,
        "sourceHash": source_hash,
        "sourceFiles": source_files,
        "scan": {
            "engine": "playwright-safe-replay",
            "version": 1,
            "url": scan_url,
            "language": str(snapshot.get("language") or "und"),
            "isolated": True,
        },
        "studioTree": STUDIO_TREE_CONTRACT,
        "menus": menus,
    }


def atomic_write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix="project-menu-", suffix=".json", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_name, path)
    finally:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target_project", type=Path)
    parser.add_argument("--url", required=True, help="live loopback production URL")
    parser.add_argument("--browser", default="", help="optional Edge/Chrome/Chromium executable")
    parser.add_argument("--snapshot", type=Path, help="deterministic browser snapshot for CI/testing")
    parser.add_argument("--timeout-ms", type=int, default=8000)
    args = parser.parse_args()
    target = args.target_project.resolve()
    parsed = urlparse(args.url)
    if parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        print("project-menu scan: FAIL - --url must be loopback", file=sys.stderr)
        return 2
    try:
        source_hash, source_files = source_inventory(target)
        helper = Path(__file__).with_name("capture_project_menu_snapshot.mjs")
        snapshot = read_snapshot(args.snapshot.resolve()) if args.snapshot else capture_snapshot(helper, args.url, args.browser, args.timeout_ms)
        document = normalize(snapshot, source_hash, source_files, args.url)
        output = target / ".ui-job" / "project-menu.json"
        previous = output.read_bytes() if output.is_file() else None
        atomic_write(output, document)
        report = validate(target)
        if not report["ok"]:
            if previous is None:
                output.unlink(missing_ok=True)
            else:
                output.write_bytes(previous)
            raise ValueError("; ".join(report["errors"]))
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"project-menu scan: FAIL - {error}", file=sys.stderr)
        return 1
    print(f"project-menu scan: PASS ({report['menuCount']} live menu identities, {source_hash[:12]})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
