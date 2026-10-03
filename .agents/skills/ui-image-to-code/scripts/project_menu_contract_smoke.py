#!/usr/bin/env python3
"""Prove that project-menu layer-count truth is a blocking contract."""

from __future__ import annotations

import json
import hashlib
import tempfile
from pathlib import Path

from validate_project_menu import validate


def manifest(count: int | None, source: bytes = b"<main data-ui-id='page.home'>Home</main>") -> dict:
    item = {
        "id": "page.home",
        "label": "Home",
        "language": "en",
        "order": 0,
        "parentId": None,
        "current": True,
        "trigger": {"kind": "selector", "value": "[data-view-target='home']"},
        "destination": {"kind": "page", "id": "home"},
        "bound": True,
        "rootId": "page.home",
        "evidence": ["browser.state.home"],
    }
    if count is not None:
        item["layerCount"] = {
            "source": "live-dom",
            "count": count,
            "measuredAt": "2026-08-26T00:00:00Z",
        }
    return {
        "schemaVersion": 1,
        "status": "ready",
        "mode": "authorized-source-aware",
        "scannedAt": "2026-08-26T00:00:00Z",
        "sourceHash": hashlib.sha256(b"index.html\0" + source + b"\0").hexdigest(),
        "sourceFiles": [{"path": "index.html", "sha256": hashlib.sha256(source).hexdigest()}],
        "scan": {
            "engine": "playwright-safe-replay",
            "version": 1,
            "url": "http://127.0.0.1:4173/",
            "language": "en",
            "isolated": True,
        },
        "studioTree": {
            "mode": "persistent-inline",
            "activation": "single-click-switch-ui-only",
            "drilldown": "double-click-or-disclosure",
            "selection": "independent",
            "camera": "preserve",
            "counts": "live-truth",
            "labels": "visible-ui-language",
            "currentPage": "exactly-one",
        },
        "menus": [item],
    }


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="ui-project-menu-") as directory:
        target = Path(directory)
        job = target / ".ui-job"
        job.mkdir()
        path = job / "project-menu.json"
        source = b"<main data-ui-id='page.home'>Home</main>"
        (target / "index.html").write_bytes(source)

        path.write_text(json.dumps(manifest(None, source), ensure_ascii=False), encoding="utf-8")
        missing_count = validate(target)
        if missing_count["ok"] or not any("layerCount" in error for error in missing_count["errors"]):
            raise SystemExit("project-menu smoke: FAIL - missing real layer count was accepted")

        missing_tree_contract = manifest(42, source)
        missing_tree_contract.pop("studioTree")
        path.write_text(json.dumps(missing_tree_contract, ensure_ascii=False), encoding="utf-8")
        missing_tree = validate(target)
        if missing_tree["ok"] or not any("studioTree" in error for error in missing_tree["errors"]):
            raise SystemExit("project-menu smoke: FAIL - missing persistent tree contract was accepted")

        path.write_text(json.dumps(manifest(42, source), ensure_ascii=False), encoding="utf-8")
        measured = validate(target)
        if not measured["ok"] or measured["menuCount"] != 1:
            raise SystemExit(f"project-menu smoke: FAIL - valid measured menu rejected: {measured['errors']}")

    print("project-menu smoke: PASS (live counts and persistent inline tree are mandatory)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
