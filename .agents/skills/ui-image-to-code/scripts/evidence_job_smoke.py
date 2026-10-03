#!/usr/bin/env python3
"""End-to-end smoke test for screenshot job preparation and evidence gating."""

from __future__ import annotations

import json
import hashlib
import os
import shutil
import struct
import subprocess
import sys
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / ".evidence-job-smoke"
REFERENCE = WORK / "sample.png"
TARGET = WORK / "project"
PREPARE = ROOT / "scripts" / "prepare_ui_job.py"
PREPARE_CONTRACT = ROOT / "scripts" / "prepare_ui_contract.py"
VALIDATE = ROOT / "scripts" / "validate_evidence_map.py"
COMPILE = ROOT / "scripts" / "compile_ui_spec.py"
STATUS = ROOT / "scripts" / "ui_job_status.py"


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int) -> None:
    rows = b"".join(b"\x00" + b"\xff\xff\xff" * width for _ in range(height))
    data = b"\x89PNG\r\n\x1a\n"
    data += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    data += png_chunk(b"IDAT", zlib.compress(rows))
    data += png_chunk(b"IEND", b"")
    path.write_bytes(data)


def run(*args: str, expected: int = 0) -> subprocess.CompletedProcess[str]:
    environment = {**os.environ, "PYTHONUTF8": "1"}
    result = subprocess.run([sys.executable, *args], cwd=ROOT, text=True, capture_output=True, encoding="utf-8", env=environment)
    if result.returncode != expected:
        raise AssertionError(f"Expected exit {expected}, got {result.returncode}:\n{result.stdout}\n{result.stderr}")
    return result


def studio_source_hash(target: Path) -> str:
    digest = hashlib.sha256()
    for relative in ("index.html", "styles.css", "app.js"):
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update((target / relative).read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def main() -> int:
    if WORK.exists():
        shutil.rmtree(WORK)
    try:
        WORK.mkdir()
        write_png(REFERENCE, 320, 180)
        contract = run(
            str(PREPARE_CONTRACT),
            str(TARGET),
            "--page", "desktop:Desktop",
            "--viewport", "320x240",
            "--no-studio",
            "--no-roundtrip",
            "--no-browser-e2e",
            "--no-design-review",
            "--exception-reason", "Smoke fixture exercises evidence compilation only",
            "--companion-skill", "example-extra-review",
        )
        assert "Prepare UI contract: PASS" in contract.stdout
        contract_document = json.loads((TARGET / ".ui-job" / "job-contract.json").read_text(encoding="utf-8"))
        assert set(contract_document["requirements"]["requiredCompanionSkills"]) == {
            "frontend-skill", "emil-design-eng", "qinglu-ui-parity", "example-extra-review"
        }
        assert contract_document["exceptions"][0]["reason"]
        prepared = run(str(PREPARE), str(REFERENCE), str(TARGET), "--id", "desktop-main", "--viewport", "320x180")
        assert "Prepare UI job: PASS" in prepared.stdout
        map_path = TARGET / "artifacts" / "ui-evidence" / "desktop-main.json"
        stored_reference = TARGET / "artifacts" / "ui-evidence" / "references" / "desktop-main.png"
        assert map_path.is_file() and stored_reference.is_file()

        draft = json.loads(map_path.read_text(encoding="utf-8"))
        assert draft["status"] == "draft"
        assert draft["reference"]["width"] == 320 and draft["reference"]["height"] == 180
        assert draft["reference"]["path"] == "artifacts/ui-evidence/references/desktop-main.png"
        run(str(VALIDATE), str(map_path), "--allow-draft")
        blocked = run(str(VALIDATE), str(map_path), expected=1)
        assert "still draft" in blocked.stderr
        compile_blocked = run(str(COMPILE), str(map_path), expected=1)
        assert "still draft" in compile_blocked.stderr
        draft_status = run(str(STATUS), str(TARGET), "--json")
        assert json.loads(draft_status.stdout)["nextAction"] == "complete-position-evidence"

        draft["status"] = "ready"
        draft["unresolved"] = []
        draft["nodes"].append({
            "id": "page.header",
            "name": "Header",
            "type": "section",
            "parentId": "page.root",
            "bounds": {"x": 0, "y": 0, "width": 320, "height": 36},
            "layout": {"mode": "flow", "role": "header"},
            "anchors": ["viewport.left", "viewport.top", "viewport.right"],
            "confidence": {"level": "observed", "score": 0.98, "sources": ["screenshot", "alignment"]},
        })
        draft["nodes"].extend([
            {
                "id": "page.header.title",
                "name": "Header title",
                "type": "text",
                "parentId": "page.header",
                "bounds": {"x": 12, "y": 10, "width": 80, "height": 16},
                "layout": {"mode": "free", "role": "title"},
                "anchors": ["page.header.left", "page.header.center-y"],
                "content": {"text": "UI Studio"},
                "confidence": {"level": "observed", "score": 0.99, "sources": ["screenshot", "ocr"]},
            },
            {
                "id": "page.header.action",
                "name": "Header action icon",
                "type": "icon",
                "parentId": "page.header",
                "bounds": {"x": 104, "y": 10, "width": 16, "height": 16},
                "layout": {"mode": "free", "role": "action-icon"},
                "anchors": ["page.header.center-y"],
                "confidence": {"level": "strong-inference", "score": 0.9, "sources": ["screenshot", "shape"]},
            },
        ])
        map_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        passed = run(str(VALIDATE), str(map_path))
        assert "Evidence map: PASS" in passed.stdout
        compile_status = run(str(STATUS), str(TARGET), "--json")
        assert json.loads(compile_status.stdout)["nextAction"] == "compile-ui-spec"
        compiled = run(str(COMPILE), str(map_path))
        assert "Compile UI spec: PASS" in compiled.stdout
        spec_path = TARGET / "artifacts" / "ui-spec" / "desktop-main.json"
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        assert spec["sourceEvidence"] == "artifacts/ui-evidence/desktop-main.json"
        assert spec["generationOrder"] == ["page.root", "page.header", "page.header.title", "page.header.action"]
        header = next(item for item in spec["nodes"] if item["id"] == "page.header")
        assert header["layoutHint"]["mode"] == "row"
        assert header["responsive"]["horizontal"] == "stretch"
        title = next(item for item in spec["nodes"] if item["id"] == "page.header.title")
        assert title["boundsNormalized"]["x"] == 0.0375
        assert any(item["code"] == "missing-icon-asset" for item in spec["quality"]["issues"])
        ready_status = run(str(STATUS), str(TARGET), "--json")
        assert json.loads(ready_status.stdout)["nextAction"] == "generate-and-record-source"

        studio_target = WORK / "studio-status"
        studio_directory = studio_target / ".ui-studio"
        studio_directory.mkdir(parents=True)
        contract_directory = studio_target / ".ui-job"
        contract_directory.mkdir(parents=True)
        (contract_directory / "job-contract.json").write_text(json.dumps({
            "schemaVersion": 1,
            "status": "ready",
            "scope": {"pages": [{"id": "page.studio"}], "journeys": [], "viewports": []},
            "requirements": {},
        }) + "\n", encoding="utf-8")
        (studio_target / "index.html").write_text('<main data-ui-id="page"></main>\n', encoding="utf-8")
        (studio_target / "styles.css").write_text("main { display: block; }\n", encoding="utf-8")
        (studio_target / "app.js").write_text("// app\n", encoding="utf-8")
        base_hash = studio_source_hash(studio_target)
        (studio_directory / "ui-document.json").write_text(json.dumps({"revision": 2}) + "\n", encoding="utf-8")
        (studio_directory / "sync-state.json").write_text(json.dumps({
            "state": "pending-codex",
            "documentRevision": 2,
            "appliedRevision": 1,
            "baseSourceHash": base_hash,
            "lastWriter": "studio",
        }) + "\n", encoding="utf-8")
        (studio_directory / "identity-registry.json").write_text(json.dumps({
            "identityCount": 1,
            "duplicateIds": [],
            "unresolvedTargetIds": [],
        }) + "\n", encoding="utf-8")
        (contract_directory / "studio-installation.json").write_text(json.dumps({
            "schemaVersion": 1,
            "status": "ready",
            "editableObjectCount": 1,
        }) + "\n", encoding="utf-8")
        pending_status = json.loads(run(str(STATUS), str(studio_target), "--json").stdout)
        assert pending_status["studio"]["state"] == "pending-codex"
        (studio_target / "styles.css").write_text("main { display: grid; }\n", encoding="utf-8")
        conflict_status = json.loads(run(str(STATUS), str(studio_target), "--json").stdout)
        assert conflict_status["studio"]["state"] == "conflict"
        assert conflict_status["nextAction"] == "resolve-studio-state"

        draft["nodes"][-1]["bounds"]["width"] = 321
        map_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        rejected = run(str(VALIDATE), str(map_path), expected=1)
        assert "exceed the reference" in rejected.stderr
        print("Evidence job workflow: PASS")
        return 0
    finally:
        if WORK.exists():
            shutil.rmtree(WORK)


if __name__ == "__main__":
    raise SystemExit(main())
