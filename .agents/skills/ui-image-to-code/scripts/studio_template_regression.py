#!/usr/bin/env python3
"""Prove that a fresh Studio install is generic and cannot overwrite an existing site."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parent
SCAFFOLD = SCRIPT_ROOT / "scaffold_studio.py"
SOURCE_FILES = (
    "index.html",
    "styles.css",
    "app.js",
    "ui-studio-overrides.css",
    "ui-studio-structure.js",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command: list[str], cwd: Path, expect: int = 0) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, encoding="utf-8")
    if result.returncode != expect:
        details = "\n".join(part for part in (result.stdout, result.stderr) if part)
        raise SystemExit(f"studio template regression: FAIL\ncommand: {' '.join(command)}\n{details}")
    return result


def valid_menu_manifest() -> dict:
    return {
        "schemaVersion": 1,
        "status": "ready",
        "mode": "authorized-source-aware",
        "scannedAt": "2026-08-26T00:00:00Z",
        "sourceHash": "fixture-source-hash",
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
        "menus": [
            {
                "id": "menu.home",
                "label": "首页",
                "trigger": {"kind": "selector", "value": "[data-view-target='home']"},
                "destination": {"kind": "page", "id": "home"},
                "bound": True,
                "rootId": "page.custom",
                "layerCount": {
                    "source": "live-dom",
                    "count": 1,
                    "measuredAt": "2026-08-26T00:00:00Z",
                },
                "evidence": ["fixture-browser-state"],
            }
        ],
    }


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="ui-studio-existing-site-") as directory:
        target = Path(directory)
        fixtures = {
            "index.html": '<!doctype html><html lang="zh-CN"><body><main data-ui-id="page.custom">CUSTOM EXISTING SITE</main><script src="app.js"></script></body></html>\n',
            "styles.css": ':root { --fixture-proof: "keep-me"; }\n',
            "app.js": "document.body.dataset.fixture = 'existing-site-must-survive';\n",
            "ui-studio-overrides.css": "/* project-owned generated overrides connector */\n",
            "ui-studio-structure.js": "window.__UI_STUDIO_PROJECT_CONNECTOR__ = true;\n",
            "package.json": json.dumps(
                {
                    "name": "custom-existing-site-fixture",
                    "private": True,
                    "scripts": {"fixture:keep": "node -e \"console.log('keep')\""},
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
        }
        for name, value in fixtures.items():
            (target / name).write_text(value, encoding="utf-8")

        before = {name: digest(target / name) for name in SOURCE_FILES}
        run([sys.executable, str(SCAFFOLD), str(target)], cwd=target)
        run([sys.executable, str(SCAFFOLD), str(target), "--force"], cwd=target)

        changed = [name for name in SOURCE_FILES if digest(target / name) != before[name]]
        if changed:
            raise SystemExit(f"studio template regression: FAIL - production files changed: {changed}")
        package = json.loads((target / "package.json").read_text(encoding="utf-8"))
        if package.get("name") != "custom-existing-site-fixture" or "fixture:keep" not in package.get("scripts", {}):
            raise SystemExit("studio template regression: FAIL - package metadata was overwritten")

        run(["node", "--check", "studio.js"], cwd=target)
        run(["node", "scripts/project-menu-contract.mjs"], cwd=target)
        missing = run(["node", "scripts/project-menu-contract.mjs", "--require-project"], cwd=target, expect=1)
        if ".ui-job/project-menu.json" not in missing.stderr:
            raise SystemExit("studio template regression: FAIL - missing manifest did not produce a clear block")

        job = target / ".ui-job"
        job.mkdir()
        (job / "project-menu.json").write_text(
            json.dumps(valid_menu_manifest(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        run(["node", "scripts/project-menu-contract.mjs", "--require-project"], cwd=target)
        run(["node", "scripts/studio-foundation-contract.mjs"], cwd=target)
        run(["node", "scripts/sync-reliability-smoke.mjs"], cwd=target)

    print("studio template regression: PASS (generic menu engine, hard manifest gate, source preserved)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
