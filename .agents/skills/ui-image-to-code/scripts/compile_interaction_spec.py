#!/usr/bin/env python3
"""Compile a ready website capture manifest into interaction and motion source contracts."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from validate_website_capture import validate_capture


def project_relative_manifest(manifest: Path) -> str:
    parts = list(manifest.parts)
    try:
        index = parts.index("artifacts")
    except ValueError:
        return manifest.name
    return Path(*parts[index:]).as_posix()


def default_output(manifest: Path, run_id: str) -> Path:
    capture_dir = manifest.parent
    if capture_dir.parent.name == "ui-capture" and capture_dir.parent.parent.name == "artifacts":
        return capture_dir.parent.parent / "ui-spec" / f"{run_id}.interaction.json"
    return manifest.with_name(f"{manifest.stem}.interaction.json")


def issue_list(actions: list[dict], motions: list[dict]) -> list[dict]:
    issues: list[dict] = []
    motion_by_action: dict[str, list[dict]] = {}
    for motion in motions:
        motion_by_action.setdefault(str(motion["actionId"]), []).append(motion)
    for action in actions:
        action_id = str(action["id"])
        evidence = action.get("evidence", {})
        level = evidence.get("level")
        if level in {"inferred", "unknown"}:
            issues.append({
                "severity": "warning",
                "code": "unconfirmed-action-semantics",
                "actionId": action_id,
                "message": "Replay the visible action before treating its destination as confirmed behavior.",
            })
        if not motion_by_action.get(action_id):
            issues.append({
                "severity": "info",
                "code": "no-observed-motion",
                "actionId": action_id,
                "message": "Generate the state change without decorative motion unless later video evidence proves it.",
            })
        if not str(action.get("trigger", {}).get("targetNodeId") or "").strip():
            issues.append({
                "severity": "warning",
                "code": "target-node-unresolved",
                "actionId": action_id,
                "message": "Bind the visible label to one stable data-ui-id before source generation.",
            })
    return issues


def compile_spec(data: dict, manifest: Path) -> dict:
    counts = validate_capture(data, manifest, allow_draft=False)
    graph = data["stateGraph"]
    states = graph["states"]
    actions = graph["actions"]
    motions = data.get("motions", [])
    issues = issue_list(actions, motions)

    compiled_states = [
        {
            "id": state["id"],
            "screenId": state.get("screenId"),
            "variant": state.get("variant", "default"),
            "viewportId": state["viewportId"],
            "visibleUrl": state.get("visibleUrl"),
            "screenshot": state["screenshot"],
            "stability": state.get("stability", {}),
        }
        for state in states
    ]

    compiled_actions: list[dict] = []
    for action in actions:
        trigger = action["trigger"]
        compiled_actions.append({
            "id": action["id"],
            "fromStateId": action["fromStateId"],
            "toStateId": action["toStateId"],
            "trigger": trigger,
            "destination": action["destination"],
            "feedback": action.get("feedback", {}),
            "motionIds": action.get("motionIds", []),
            "risk": action["risk"],
            "evidence": action["evidence"],
            "sourceBinding": {
                "dataUiId": trigger.get("targetNodeId"),
                "dataUiAction": action["id"],
                "requiredElement": (
                    "a" if action["destination"]["kind"] in {"navigate-route", "external", "download"}
                    else "button"
                ),
            },
        })

    compiled_motions = [
        {
            "id": motion["id"],
            "actionId": motion["actionId"],
            "durationMs": motion["durationMs"],
            "delayMs": motion["delayMs"],
            "easing": motion["easing"],
            "tracks": motion["tracks"],
            "interruptBehavior": motion.get("interruptBehavior", "complete"),
            "reducedMotion": motion.get("reducedMotion", "instant-state-change"),
            "evidence": motion.get("evidence", {}),
        }
        for motion in motions
    ]

    destination_registry = {
        "menuIds": sorted({
            action["destination"]["menuId"]
            for action in actions
            if action["destination"].get("menuId")
        }),
        "workspaceIds": sorted({
            action["destination"]["workspaceId"]
            for action in actions
            if action["destination"].get("workspaceId")
        }),
        "dialogIds": sorted({
            action["destination"]["dialogId"]
            for action in actions
            if action["destination"].get("dialogId")
        }),
        "routeIds": sorted({
            action["destination"]["routeId"]
            for action in actions
            if action["destination"].get("routeId")
        }),
    }

    return {
        "schemaVersion": 1,
        "kind": "interaction-generation-spec",
        "status": "ready-for-source-generation",
        "sourceEvidence": project_relative_manifest(manifest),
        "runId": data["run"]["id"],
        "states": compiled_states,
        "actions": compiled_actions,
        "motions": compiled_motions,
        "identityRegistry": {
            "stateIds": [item["id"] for item in compiled_states],
            "actionIds": [item["id"] for item in compiled_actions],
            "motionIds": [item["id"] for item in compiled_motions],
            **destination_registry,
        },
        "quality": {
            "issueCount": len(issues),
            "warningCount": sum(1 for item in issues if item["severity"] == "warning"),
            "counts": counts,
            "issues": issues,
        },
        "sourceContract": {
            "required": [
                "Bind each action to the exact stable data-ui-id in sourceBinding; do not bind by display order.",
                "Implement the declared destination kind and final state before adding motion polish.",
                "Use semantic buttons or links, keyboard access, focus feedback, and appropriate ARIA state.",
                "Treat video spans as timing evidence only; never render the recording as production UI.",
                "Do not invent motion for an action with no observed motion specification.",
                "Keep state, action, destination, menu/workspace/dialog/route, and motion identities stable across Studio revisions.",
            ],
            "replayGate": {
                "criticalRequirement": "Every observed or confirmed safe action must replay to its declared destination state.",
                "motionRequirement": "Compare start, meaningful intermediate, and settled frames only when video evidence exists.",
            },
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Ready capture-manifest.json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    manifest = args.manifest.resolve()
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
        run_id = str(data.get("run", {}).get("id") or manifest.parent.name)
        output = args.output.resolve() if args.output else default_output(manifest, run_id)
        spec = compile_spec(data, manifest)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
        print(f"Compile interaction spec: FAIL - {error}", file=sys.stderr)
        return 1
    print(
        f"Compile interaction spec: PASS ({len(spec['states'])} states, "
        f"{len(spec['actions'])} actions, {len(spec['motions'])} motions, "
        f"{spec['quality']['issueCount']} issues)"
    )
    print(f"Interaction generation spec: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
