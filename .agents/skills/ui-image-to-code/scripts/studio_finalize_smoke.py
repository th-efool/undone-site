#!/usr/bin/env python3
"""End-to-end smoke test for generated-UI to Studio finalization."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from validate_delivery_gate import validate_studio_installation


SCRIPT = Path(__file__).resolve().parent / "finalize_ui_to_studio.py"


def entry(path: Path, target: Path) -> dict:
    raw = path.read_bytes()
    return {
        "path": str(path.relative_to(target)).replace("\\", "/"),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
    }


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="ui-studio-finalize-") as directory:
        target = Path(directory)
        (target / ".ui-job").mkdir()
        index = target / "index.html"
        styles = target / "styles.css"
        app = target / "app.js"
        index.write_text(
            '<!doctype html><html lang="zh-CN"><link rel="stylesheet" href="styles.css">'
            '<aside data-ui-id="newsite.sidebar">'
            '<button data-view-target="dashboard" data-ui-id="newsite.nav.dashboard">数据看板</button>'
            '<button data-view-target="tasks" data-ui-id="newsite.nav.tasks">任务中心</button>'
            '<button data-view-target="settings" data-ui-id="newsite.nav.settings">系统设置</button>'
            '</aside><main data-ui-id="newsite.workspace">'
            '<section data-view="dashboard" data-ui-id="newsite.page.dashboard">'
            '<h1 data-ui-id="newsite.dashboard.title">运营数据</h1></section>'
            '<section data-view="tasks" data-ui-id="newsite.page.tasks" hidden>'
            '<h1 data-ui-id="newsite.tasks.title">任务中心</h1></section>'
            '<section data-view="settings" data-ui-id="newsite.page.settings" hidden>'
            '<h1 data-ui-id="newsite.settings.title">系统设置</h1></section></main>'
            '<script src="app.js"></script>\n',
            encoding="utf-8",
        )
        styles.write_text('main { min-height: 100vh; }\n', encoding="utf-8")
        app.write_text(
            'document.querySelectorAll("[data-view-target]").forEach((item) => '
            'item.addEventListener("click", () => { document.body.dataset.currentView = item.dataset.viewTarget; }));\n',
            encoding="utf-8",
        )
        original_sources = {path.name: path.read_bytes() for path in (index, styles, app)}
        marker = {
            "schemaVersion": 1,
            "status": "generated",
            "sourceFiles": [entry(index, target), entry(styles, target), entry(app, target)],
            "compiledUiSpecs": [],
            "compiledInteractionSpecs": [],
        }
        marker_path = target / ".ui-job/source-generation.json"
        marker_path.write_text(json.dumps(marker, indent=2) + "\n", encoding="utf-8")

        result = subprocess.run(
            [sys.executable, str(SCRIPT), str(target), "--force-template"],
            text=True,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
        )
        assert result.returncode == 0, result.stderr or result.stdout
        for name, raw in original_sources.items():
            assert (target / name).read_bytes() == raw, f"Studio overwrote production source: {name}"
        assert "UI Studio Starter" not in index.read_text(encoding="utf-8")
        receipt_path = target / ".ui-job/studio-installation.json"
        errors: list[str] = []
        validate_studio_installation(target, receipt_path, marker_path, errors)
        assert not errors, errors
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        assert receipt["editableObjectCount"] == 11, receipt
        assert (target / ".ui-studio/ui-document.json").is_file()
        assert (target / ".ui-studio/identity-registry.json").is_file()
        generic_tree = subprocess.run(
            ["node", "scripts/generic-layer-tree-contract.mjs"],
            cwd=target,
            text=True,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
        )
        assert generic_tree.returncode == 0, generic_tree.stderr or generic_tree.stdout

        studio_engine = target / "studio.js"
        studio_engine.write_text(
            studio_engine.read_text(encoding="utf-8") + "\n// stale-engine-marker\n",
            encoding="utf-8",
        )
        refresh = subprocess.run(
            [sys.executable, str(SCRIPT), str(target), "--force-template"],
            text=True,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
        )
        assert refresh.returncode == 0, refresh.stderr or refresh.stdout
        assert "stale-engine-marker" not in studio_engine.read_text(encoding="utf-8"), "Forced refresh did not refresh Studio engine"
        for name, raw in original_sources.items():
            assert (target / name).read_bytes() == raw, f"Template refresh overwrote production source: {name}"

        index.write_text(index.read_text(encoding="utf-8") + "<!-- stale -->\n", encoding="utf-8")
        stale = subprocess.run(
            [sys.executable, str(SCRIPT), str(target)],
            text=True,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
        )
        assert stale.returncode != 0
        assert "stale" in (stale.stderr + stale.stdout).lower()

    print("Generated UI to Studio finalization: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
