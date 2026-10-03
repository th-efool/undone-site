#!/usr/bin/env python3
"""Prove automatic menu generation, localized labels, nesting, live counts, and stale-source blocking."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from ui_job_status import next_action
from validate_project_menu import validate


def main() -> int:
    script = Path(__file__).with_name("scan_project_menu.py")
    with tempfile.TemporaryDirectory(prefix="ui-project-menu-scan-") as directory:
        target = Path(directory)
        (target / "index.html").write_text("<main data-ui-id='page.home'>首页</main>", encoding="utf-8")
        snapshot = target / "snapshot.json"
        snapshot.write_text(json.dumps({
            "language": "zh-CN",
            "menus": [
                {
                    "id": "project-menu.home",
                    "label": "首页",
                    "selector": "[data-ui-id='project-menu.home']",
                    "target": "home",
                    "current": True,
                    "bound": True,
                    "rootId": "page.home",
                    "destinationId": "home",
                    "layerCount": 42,
                },
                {
                    "id": "project-menu.editor",
                    "label": "创建设计",
                    "selector": "[data-ui-id='project-menu.editor']",
                    "target": "editor",
                    "current": False,
                    "bound": True,
                    "rootId": "page.editor",
                    "destinationId": "editor",
                    "layerCount": 29,
                },
                {
                    "id": "project-menu.editor.text",
                    "label": "文字",
                    "parentId": "project-menu.editor",
                    "selector": "[data-ui-id='project-menu.editor.text']",
                    "action": "open-text",
                    "current": False,
                    "bound": False,
                    "destinationId": "editor.text",
                },
            ],
        }, ensure_ascii=False), encoding="utf-8")
        completed = subprocess.run([
            sys.executable,
            str(script),
            str(target),
            "--url",
            "http://127.0.0.1:4173/",
            "--snapshot",
            str(snapshot),
        ], text=True, capture_output=True, check=False)
        if completed.returncode:
            raise SystemExit(f"project-menu scan smoke: FAIL - {completed.stderr}")
        report = validate(target)
        if not report["ok"]:
            raise SystemExit(f"project-menu scan smoke: FAIL - {report['errors']}")
        document = json.loads((target / ".ui-job" / "project-menu.json").read_text(encoding="utf-8"))
        if [item["label"] for item in document["menus"]] != ["首页", "创建设计", "文字"]:
            raise SystemExit("project-menu scan smoke: FAIL - localized visible labels were not preserved")
        if document["menus"][2]["parentId"] != "project-menu.editor":
            raise SystemExit("project-menu scan smoke: FAIL - nested menu identity was lost")
        if [item["layerCount"]["count"] for item in document["menus"][:2]] != [42, 29]:
            raise SystemExit("project-menu scan smoke: FAIL - measured counts were not preserved")
        action, _ = next_action(
            [],
            [{"id": "evidence.home", "status": "ready", "compiled": True}],
            {"installed": False, "state": "not-installed"},
            {"state": "ready", "requirements": {"studio": True}},
            {"state": "current"},
            {"state": "missing"},
            {},
        )
        if action != "scan-project-menu":
            raise SystemExit("project-menu scan smoke: FAIL - missing manifest did not block Studio import")
        (target / "index.html").write_text("<main data-ui-id='page.home'>已变化</main>", encoding="utf-8")
        stale = validate(target)
        if stale["ok"] or not any("stale" in error for error in stale["errors"]):
            raise SystemExit("project-menu scan smoke: FAIL - source changes did not invalidate the manifest")
    print("project-menu scan smoke: PASS (automatic localized hierarchy, truth counts, and stale-source gate)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
