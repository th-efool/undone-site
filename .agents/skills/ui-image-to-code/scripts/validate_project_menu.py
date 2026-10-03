#!/usr/bin/env python3
"""Validate the mandatory latest-project menu manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


STUDIO_TREE_CONTRACT = {
    "mode": "persistent-inline",
    "activation": "single-click-switch-ui-only",
    "drilldown": "double-click-or-disclosure",
    "selection": "independent",
    "camera": "preserve",
    "counts": "live-truth",
    "labels": "visible-ui-language",
    "currentPage": "exactly-one",
}


def validate(target_project: Path | str) -> dict:
    target = Path(target_project).resolve()
    path = target / ".ui-job" / "project-menu.json"
    errors: list[str] = []
    if not path.is_file():
        return {"ok": False, "path": str(path), "menuCount": 0, "errors": [f"missing {path}"]}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return {"ok": False, "path": str(path), "menuCount": 0, "errors": [f"invalid JSON: {error}"]}
    if data.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if data.get("status") != "ready":
        errors.append("status must be ready")
    if data.get("mode") not in {"authorized-source-aware", "blind-visual"}:
        errors.append("mode must be authorized-source-aware or blind-visual")
    if not data.get("scannedAt") or not data.get("sourceHash"):
        errors.append("scannedAt and sourceHash are required")
    source_files = data.get("sourceFiles")
    if data.get("mode") == "authorized-source-aware":
        if not isinstance(source_files, list) or not source_files:
            errors.append("authorized source-aware scan requires sourceFiles")
            source_files = []
        scan = data.get("scan") if isinstance(data.get("scan"), dict) else {}
        if scan.get("engine") != "playwright-safe-replay" or scan.get("version") != 1 or scan.get("isolated") is not True:
            errors.append("authorized source-aware scan requires isolated playwright-safe-replay version 1 metadata")
        scan_url = str(scan.get("url") or "")
        if urlparse(scan_url).hostname not in {"127.0.0.1", "localhost", "::1"}:
            errors.append("authorized source-aware scan URL must be loopback")
        digest = hashlib.sha256()
        for index, entry in enumerate(source_files):
            if not isinstance(entry, dict) or not isinstance(entry.get("path"), str) or not isinstance(entry.get("sha256"), str):
                errors.append(f"sourceFiles[{index}] must contain path and sha256")
                continue
            relative = str(entry["path"])
            try:
                source = (target / relative).resolve()
                source.relative_to(target)
                content = source.read_bytes()
            except (OSError, ValueError):
                errors.append(f"sourceFiles[{index}] is missing or escapes the project: {relative}")
                continue
            actual = hashlib.sha256(content).hexdigest()
            if actual != entry["sha256"]:
                errors.append(f"sourceFiles[{index}] is stale: {relative}")
            digest.update(relative.replace("\\", "/").encode("utf-8"))
            digest.update(b"\0")
            digest.update(content)
            digest.update(b"\0")
        if source_files and digest.hexdigest() != data.get("sourceHash"):
            errors.append("sourceHash is stale or does not match sourceFiles")
    studio_tree = data.get("studioTree")
    if studio_tree != STUDIO_TREE_CONTRACT:
        errors.append("studioTree must lock the persistent inline menu/layer interaction contract")
    menus = data.get("menus")
    if not isinstance(menus, list) or not menus:
        errors.append("menus must contain at least one entry")
        menus = []
    seen: set[str] = set()
    current_pages: list[str] = []
    parents: dict[str, str | None] = {}
    orders: set[int] = set()
    for index, item in enumerate(menus):
        prefix = f"menus[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{prefix} must be an object")
            continue
        menu_id = str(item.get("id") or "").strip()
        if not menu_id or menu_id in seen:
            errors.append(f"{prefix}.id is missing or duplicated")
        seen.add(menu_id)
        parent_id = item.get("parentId")
        if parent_id is not None and not isinstance(parent_id, str):
            errors.append(f"{prefix}.parentId must be a string or null")
            parent_id = None
        parents[menu_id] = parent_id
        order = item.get("order")
        if not isinstance(order, int) or order < 0:
            errors.append(f"{prefix}.order must be a non-negative integer")
        elif order in orders:
            errors.append(f"{prefix}.order is duplicated")
        else:
            orders.add(order)
        if not str(item.get("label") or "").strip():
            errors.append(f"{prefix}.label is required")
        if not str(item.get("language") or "").strip():
            errors.append(f"{prefix}.language is required")
        trigger = item.get("trigger") or {}
        if trigger.get("kind") not in {"selector", "action", "href", "visible-interaction"} or not trigger.get("value"):
            errors.append(f"{prefix}.trigger must have a supported kind and value")
        destination = item.get("destination") or {}
        if destination.get("kind") not in {"page", "state", "external", "unknown"} or not destination.get("id"):
            errors.append(f"{prefix}.destination must have a supported kind and id")
        if not isinstance(item.get("bound"), bool):
            errors.append(f"{prefix}.bound must be boolean")
        if not isinstance(item.get("current"), bool):
            errors.append(f"{prefix}.current must be boolean")
        elif item.get("current"):
            if destination.get("kind") != "page" or item.get("bound") is not True:
                errors.append(f"{prefix}.current is only valid for a bound page")
            else:
                current_pages.append(menu_id)
        if destination.get("kind") in {"page", "state"} and item.get("bound") and not item.get("rootId"):
            errors.append(f"{prefix}.rootId is required for bound page/state destinations")
        layer_count = item.get("layerCount")
        if destination.get("kind") == "page" and item.get("bound"):
            if not isinstance(layer_count, dict):
                errors.append(f"{prefix}.layerCount is required for a bound page")
            else:
                if layer_count.get("source") not in {"live-dom", "isolated-browser"}:
                    errors.append(f"{prefix}.layerCount.source must be live-dom or isolated-browser")
                if not isinstance(layer_count.get("count"), int) or layer_count.get("count") < 1:
                    errors.append(f"{prefix}.layerCount.count must be a positive integer")
                if not layer_count.get("measuredAt"):
                    errors.append(f"{prefix}.layerCount.measuredAt is required")
        if destination.get("kind") == "state" and item.get("bound") and layer_count is not None:
            if not isinstance(layer_count, dict) or layer_count.get("source") not in {"live-dom", "isolated-browser", "dynamic"}:
                errors.append(f"{prefix}.layerCount must explicitly use live-dom, isolated-browser, or dynamic")
        if not item.get("evidence"):
            errors.append(f"{prefix}.evidence is required")
    for menu_id, parent_id in parents.items():
        if parent_id and parent_id not in seen:
            errors.append(f"{menu_id}.parentId does not resolve: {parent_id}")
        visited: set[str] = set()
        cursor = menu_id
        while cursor in parents and parents.get(cursor):
            if cursor in visited:
                errors.append(f"menu hierarchy contains a cycle at {menu_id}")
                break
            visited.add(cursor)
            cursor = str(parents[cursor])
    if len(current_pages) != 1:
        errors.append(f"exactly one bound page must be current; found {len(current_pages)}")
    return {"ok": not errors, "path": str(path), "menuCount": len(menus), "errors": errors}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("target_project")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()
    report = validate(args.target_project)
    if args.as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    elif report["ok"]:
        print(f"project-menu: PASS ({report['menuCount']} menu identities)")
    else:
        print("project-menu: FAIL")
        for error in report["errors"]:
            print(f"- {error}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
