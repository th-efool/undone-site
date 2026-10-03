#!/usr/bin/env python3
"""Deterministic smoke test for interaction and motion evidence validation."""

from __future__ import annotations

import copy
import hashlib
import json
import tempfile
from pathlib import Path

from compile_interaction_spec import compile_spec
from ui_job_status import capture_status, next_action
from validate_website_capture import validate_capture


def document() -> dict:
    return {
        "schemaVersion": 1,
        "status": "ready",
        "run": {
            "id": "run.smoke",
            "seedUrl": "https://example.com/",
            "allowedOrigins": ["https://example.com"],
            "profile": "blind-visual",
        },
        "viewports": [{"id": "vp-1440x900", "width": 1440, "height": 900}],
        "stateGraph": {
            "states": [
                {
                    "id": "state.studio.structure",
                    "pageId": "page.studio",
                    "evidenceId": "state-studio-structure",
                    "screenId": "screen.studio",
                    "viewportId": "vp-1440x900",
                    "screenshot": "screenshots/structure.png",
                    "stability": {"status": "settled", "observations": 2},
                },
                {
                    "id": "state.studio.icons",
                    "pageId": "page.studio",
                    "evidenceId": "state-studio-icons",
                    "screenId": "screen.studio",
                    "viewportId": "vp-1440x900",
                    "screenshot": "screenshots/icons.png",
                    "stability": {"status": "settled", "observations": 2},
                },
            ],
            "actions": [
                {
                    "id": "action.sidebar.icons.open",
                    "journeyId": "journey.icons",
                    "fromStateId": "state.studio.structure",
                    "toStateId": "state.studio.icons",
                    "risk": "safe",
                    "trigger": {
                        "kind": "click",
                        "targetNodeId": "sidebar.mode.icons",
                        "visibleLabel": "Icons",
                    },
                    "destination": {
                        "kind": "switch-workspace",
                        "stateId": "state.studio.icons",
                        "workspaceId": "workspace.icons",
                    },
                    "motionIds": ["motion.workspace.icons-enter"],
                    "evidence": {
                        "level": "confirmed",
                        "sources": ["browser-replay", "video"],
                        "videoSpans": [
                            {"recordingId": "recording.main-flow", "startMs": 100, "endMs": 340}
                        ],
                    },
                }
            ],
        },
        "recordings": [
            {
                "id": "recording.main-flow",
                "path": "recordings/main-flow.mp4",
                "viewportId": "vp-1440x900",
                "durationMs": 1000,
                "status": "available",
            }
        ],
        "motions": [
            {
                "id": "motion.workspace.icons-enter",
                "actionId": "action.sidebar.icons.open",
                "durationMs": 240,
                "delayMs": 0,
                "easing": "ease-out",
                "evidence": {
                    "recordingId": "recording.main-flow",
                    "startMs": 100,
                    "endMs": 340,
                },
                "tracks": [
                    {
                        "targetNodeId": "workspace.icons",
                        "property": "opacity",
                        "from": 0,
                        "to": 1,
                    }
                ],
            }
        ],
        "handoff": {
            "approvedStateIds": ["state.studio.structure", "state.studio.icons"]
        },
    }


def expect_invalid(data: dict, manifest: Path, expected: str) -> None:
    try:
        validate_capture(data, manifest)
    except ValueError as error:
        if expected not in str(error):
            raise AssertionError(f"expected {expected!r}, got {error!s}") from error
        return
    raise AssertionError(f"expected validation failure containing {expected!r}")


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="interaction-evidence-") as temp:
        root = Path(temp)
        capture_root = root / "artifacts" / "ui-capture" / "smoke"
        (capture_root / "screenshots").mkdir(parents=True)
        (capture_root / "recordings").mkdir()
        (capture_root / "screenshots" / "structure.png").write_bytes(b"smoke")
        (capture_root / "screenshots" / "icons.png").write_bytes(b"smoke")
        (capture_root / "recordings" / "main-flow.mp4").write_bytes(b"smoke")
        manifest = capture_root / "capture-manifest.json"
        data = document()
        contract_path = root / ".ui-job" / "job-contract.json"
        contract_path.parent.mkdir(parents=True)
        contract = {
            "schemaVersion": 1,
            "status": "ready",
            "scope": {
                "pages": [{"id": "page.studio", "label": "Studio"}],
                "journeys": [{"id": "journey.icons", "label": "Icons"}],
                "viewports": [{"id": "vp-1440x900", "width": 1440, "height": 900}],
            },
            "requirements": {},
        }
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        contract_hash = hashlib.sha256(contract_path.read_bytes()).hexdigest()
        data["contract"] = {
            "path": ".ui-job/job-contract.json",
            "sha256": contract_hash,
            "requiredPageIds": ["page.studio"],
            "requiredJourneyIds": ["journey.icons"],
        }
        manifest.write_text(json.dumps(data), encoding="utf-8")

        counts = validate_capture(data, manifest)
        assert counts["states"] == 2
        assert counts["actions"] == 1
        assert counts["recordings"] == 1
        assert counts["motions"] == 1

        spec = compile_spec(data, manifest)
        assert spec["actions"][0]["sourceBinding"]["dataUiId"] == "sidebar.mode.icons"
        assert spec["actions"][0]["destination"]["workspaceId"] == "workspace.icons"
        assert spec["motions"][0]["actionId"] == "action.sidebar.icons.open"

        captures = capture_status(root)
        assert len(captures) == 1
        assert captures[0]["compiled"] is False
        contract_state = {"installed": True, "state": "ready", "requirements": {}}
        source_state = {"installed": False, "state": "missing"}
        qa_state = {"browser": {"state": "missing"}, "design": {"state": "missing"}, "roundtrip": {"state": "missing"}, "delivery": {"state": "missing"}}
        action, _ = next_action(captures, [], {"installed": False, "state": "not-installed"}, contract_state, source_state, {"state": "current"}, qa_state)
        assert action == "compile-interaction-spec"
        spec_path = root / "artifacts" / "ui-spec" / "run.smoke.interaction.json"
        spec_path.parent.mkdir(parents=True)
        spec_path.write_text(json.dumps(spec), encoding="utf-8")
        captures = capture_status(root)
        assert captures[0]["compiled"] is True
        action, _ = next_action(captures, [], {"installed": False, "state": "not-installed"}, contract_state, source_state, {"state": "current"}, qa_state)
        assert action == "prepare-approved-state-evidence"

        invalid_destination = copy.deepcopy(data)
        invalid_destination["stateGraph"]["actions"][0]["destination"].pop("workspaceId")
        expect_invalid(invalid_destination, manifest, "workspace.* workspaceId")

        invalid_video = copy.deepcopy(data)
        invalid_video["stateGraph"]["actions"][0]["evidence"]["videoSpans"][0]["recordingId"] = "recording.missing"
        expect_invalid(invalid_video, manifest, "unknown recording")

        invalid_motion_video = copy.deepcopy(data)
        invalid_motion_video["motions"][0]["evidence"]["recordingId"] = "recording.missing"
        expect_invalid(invalid_motion_video, manifest, "evidence references unknown recording")

        invalid_route = copy.deepcopy(data)
        destination = invalid_route["stateGraph"]["actions"][0]["destination"]
        destination["kind"] = "navigate-route"
        destination.pop("workspaceId")
        expect_invalid(invalid_route, manifest, "route.* routeId")

        invalid_fps = copy.deepcopy(data)
        invalid_fps["recordings"][0]["fps"] = 0
        expect_invalid(invalid_fps, manifest, "fps must be positive")

        invalid_motion = copy.deepcopy(data)
        invalid_motion["motions"][0]["tracks"][0]["property"] = "unbounded-css"
        expect_invalid(invalid_motion, manifest, "unsupported property")

    print("Interaction evidence smoke: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
