#!/usr/bin/env python3
"""Validate a Codex-driven website capture manifest before UI generation."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from urllib.parse import urlsplit


ACTION_KINDS = {"click", "hover", "input", "keyboard", "scroll", "drag", "time"}
DESTINATION_KINDS = {
    "open-menu", "expand-submenu", "switch-workspace", "navigate-route",
    "open-dialog", "toggle-state", "external", "download", "no-change",
}
EVIDENCE_LEVELS = {"observed", "confirmed", "inferred", "unknown"}
MOTION_PROPERTIES = {
    "opacity", "translate-x", "translate-y", "scale", "scale-x", "scale-y",
    "rotate", "width", "height", "clip-path", "background-color", "color",
    "border-color", "border-radius", "box-shadow", "filter", "custom",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--allow-draft", action="store_true", help="Validate structure without requiring approved states")
    return parser.parse_args()


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def finite_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def project_root(manifest: Path) -> Path:
    for parent in manifest.parents:
        if parent.name == "artifacts":
            return parent.parent
    raise ValueError("capture manifest must live below TARGET/artifacts/ui-capture")


def load_contract(data: dict, manifest: Path, errors: list[str]) -> tuple[dict, set[str], set[str]]:
    link = data.get("contract") if isinstance(data.get("contract"), dict) else {}
    relative = link.get("path")
    if not isinstance(relative, str) or not relative.strip():
        fail(errors, "contract.path is required; create TARGET/.ui-job/job-contract.json before capture")
        return {}, set(), set()
    try:
        target = project_root(manifest)
        path = (target / relative).resolve()
        path.relative_to(target.resolve())
        raw = path.read_bytes()
        contract = json.loads(raw.decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        fail(errors, f"cannot load contract {relative!r}: {error}")
        return {}, set(), set()
    if not isinstance(contract, dict) or contract.get("schemaVersion") != 1 or contract.get("status") != "ready":
        fail(errors, "linked contract must be a ready schemaVersion 1 object")
        return {}, set(), set()
    expected_hash = link.get("sha256")
    actual_hash = hashlib.sha256(raw).hexdigest()
    if expected_hash != actual_hash:
        fail(errors, "capture contract hash is stale; reattach the latest UI job contract before continuing")
    scope = contract.get("scope") if isinstance(contract.get("scope"), dict) else {}
    pages = scope.get("pages") if isinstance(scope.get("pages"), list) else []
    journeys = scope.get("journeys") if isinstance(scope.get("journeys"), list) else []
    page_ids = {str(item.get("id")) for item in pages if isinstance(item, dict) and str(item.get("id") or "").startswith("page.")}
    journey_ids = {str(item.get("id")) for item in journeys if isinstance(item, dict) and str(item.get("id") or "").startswith("journey.")}
    if not page_ids:
        fail(errors, "contract.scope.pages must contain at least one page.* ID")
    declared_pages = set(link.get("requiredPageIds", [])) if isinstance(link.get("requiredPageIds"), list) else set()
    declared_journeys = set(link.get("requiredJourneyIds", [])) if isinstance(link.get("requiredJourneyIds"), list) else set()
    if not declared_pages or not declared_pages <= page_ids or not declared_journeys <= journey_ids:
        fail(errors, "capture contract scope snapshot is stale or outside the latest contract")
    return contract, declared_pages, declared_journeys


def validate_capture(data: dict, manifest: Path, allow_draft: bool = False) -> dict:
    """Validate a capture document and return reusable counts for compilers/tests."""
    errors: list[str] = []
    warnings: list[str] = []
    if data.get("schemaVersion") != 1:
        fail(errors, "schemaVersion must be 1")
    if data.get("status") not in {"draft", "ready", "complete"}:
        fail(errors, "status must be draft, ready, or complete")

    contract, required_page_ids, required_journey_ids = load_contract(data, manifest, errors)

    run = data.get("run") if isinstance(data.get("run"), dict) else {}
    seed = run.get("seedUrl")
    if not isinstance(run.get("id"), str) or not run.get("id", "").startswith("run."):
        fail(errors, "run.id must start with run.")
    if not isinstance(seed, str) or urlsplit(seed).scheme not in {"http", "https"}:
        fail(errors, "run.seedUrl must be an HTTP(S) URL")
    if run.get("profile") not in {"blind-visual", "authorized-semantic"}:
        fail(errors, "run.profile must be blind-visual or authorized-semantic")
    origins = run.get("allowedOrigins")
    if not isinstance(origins, list) or not origins or not all(isinstance(item, str) for item in origins):
        fail(errors, "run.allowedOrigins must be a non-empty string array")

    viewports = data.get("viewports")
    viewport_ids: set[str] = set()
    if not isinstance(viewports, list) or not viewports:
        fail(errors, "viewports must be non-empty")
    else:
        for index, viewport in enumerate(viewports):
            if not isinstance(viewport, dict):
                fail(errors, f"viewports[{index}] must be an object")
                continue
            viewport_id = viewport.get("id")
            if not isinstance(viewport_id, str) or viewport_id in viewport_ids:
                fail(errors, f"viewports[{index}].id must be unique")
            else:
                viewport_ids.add(viewport_id)
            if not isinstance(viewport.get("width"), int) or not isinstance(viewport.get("height"), int):
                fail(errors, f"viewports[{index}] requires integer width and height")

    recordings = data.get("recordings", [])
    if not isinstance(recordings, list):
        fail(errors, "recordings must be an array")
        recordings = []
    recording_ids: set[str] = set()
    root = manifest.parent
    for index, recording in enumerate(recordings):
        if not isinstance(recording, dict):
            fail(errors, f"recordings[{index}] must be an object")
            continue
        recording_id = recording.get("id")
        if not isinstance(recording_id, str) or not recording_id.startswith("recording.") or recording_id in recording_ids:
            fail(errors, f"recordings[{index}].id must be a unique recording.* ID")
        else:
            recording_ids.add(recording_id)
        path = recording.get("path")
        if not isinstance(path, str) or not path:
            fail(errors, f"recording {recording_id!r} requires path")
        elif not (root / path).is_file():
            fail(errors, f"recording {recording_id!r} file does not exist: {path}")
        if recording.get("viewportId") not in viewport_ids:
            fail(errors, f"recording {recording_id!r} references an unknown viewport")
        if not finite_number(recording.get("durationMs")) or float(recording.get("durationMs", 0)) <= 0:
            fail(errors, f"recording {recording_id!r} requires positive durationMs")
        if "fps" in recording and (not finite_number(recording.get("fps")) or float(recording.get("fps", 0)) <= 0):
            fail(errors, f"recording {recording_id!r} fps must be positive when present")
        if recording.get("status") not in {"available", "partial", "unavailable"}:
            fail(errors, f"recording {recording_id!r} requires status available, partial, or unavailable")

    graph = data.get("stateGraph") if isinstance(data.get("stateGraph"), dict) else {}
    states = graph.get("states") if isinstance(graph.get("states"), list) else []
    actions = graph.get("actions") if isinstance(graph.get("actions"), list) else []
    state_ids: set[str] = set()
    settled_state_ids: set[str] = set()
    state_page_ids: dict[str, str] = {}
    state_evidence_ids: dict[str, str] = {}
    action_ids: set[str] = set()
    settled_count = 0
    for index, state in enumerate(states):
        if not isinstance(state, dict):
            fail(errors, f"stateGraph.states[{index}] must be an object")
            continue
        state_id = state.get("id")
        if not isinstance(state_id, str) or not state_id.startswith("state.") or state_id in state_ids:
            fail(errors, f"stateGraph.states[{index}].id must be a unique state.* ID")
        else:
            state_ids.add(state_id)
        page_id = state.get("pageId")
        if page_id not in required_page_ids:
            fail(errors, f"state {state_id!r} requires a contract pageId")
        elif isinstance(state_id, str):
            state_page_ids[state_id] = str(page_id)
        evidence_id = state.get("evidenceId")
        if evidence_id is not None and (not isinstance(evidence_id, str) or not evidence_id.strip()):
            fail(errors, f"state {state_id!r} evidenceId must be a non-empty string when present")
        elif isinstance(state_id, str) and isinstance(evidence_id, str):
            state_evidence_ids[state_id] = evidence_id
        if state.get("viewportId") not in viewport_ids:
            fail(errors, f"state {state_id!r} references an unknown viewport")
        screenshot = state.get("screenshot")
        if not isinstance(screenshot, str) or not screenshot:
            fail(errors, f"state {state_id!r} requires screenshot")
        elif not (root / screenshot).is_file():
            fail(errors, f"state {state_id!r} screenshot does not exist: {screenshot}")
        stability = state.get("stability") if isinstance(state.get("stability"), dict) else {}
        if stability.get("status") == "settled" and isinstance(stability.get("observations"), int) and stability["observations"] >= 2:
            settled_count += 1
            if isinstance(state_id, str):
                settled_state_ids.add(state_id)

    for index, action in enumerate(actions):
        if not isinstance(action, dict):
            fail(errors, f"stateGraph.actions[{index}] must be an object")
            continue
        action_id = action.get("id")
        if not isinstance(action_id, str) or not action_id.startswith("action.") or action_id in action_ids:
            fail(errors, f"stateGraph.actions[{index}].id must be a unique action.* ID")
        else:
            action_ids.add(action_id)
        from_state = action.get("fromStateId")
        to_state = action.get("toStateId")
        if from_state not in state_ids or to_state not in state_ids:
            fail(errors, f"action {action_id!r} must reference existing from/to states")
        elif from_state not in settled_state_ids or to_state not in settled_state_ids:
            fail(errors, f"action {action_id!r} must connect two settled states")
        journey_id = action.get("journeyId")
        if required_journey_ids and journey_id not in required_journey_ids:
            fail(errors, f"action {action_id!r} requires a contract journeyId")
        elif journey_id is not None and not str(journey_id).startswith("journey."):
            fail(errors, f"action {action_id!r} journeyId must start with journey.")
        if action.get("risk") not in {"safe", "approved", "blocked"}:
            fail(errors, f"action {action_id!r} requires risk safe, approved, or blocked")
        trigger = action.get("trigger") if isinstance(action.get("trigger"), dict) else {}
        if trigger.get("kind") not in ACTION_KINDS:
            fail(errors, f"action {action_id!r} trigger.kind is invalid")
        if not str(trigger.get("targetNodeId") or trigger.get("visibleLabel") or "").strip():
            fail(errors, f"action {action_id!r} trigger requires targetNodeId or visibleLabel")
        destination = action.get("destination") if isinstance(action.get("destination"), dict) else {}
        if destination.get("kind") not in DESTINATION_KINDS:
            fail(errors, f"action {action_id!r} destination.kind is invalid")
        if destination.get("stateId") != to_state:
            fail(errors, f"action {action_id!r} destination.stateId must equal toStateId")
        if destination.get("kind") in {"open-menu", "expand-submenu"} and not str(destination.get("menuId") or "").startswith("menu."):
            fail(errors, f"action {action_id!r} menu destination requires menu.* menuId")
        if destination.get("kind") == "switch-workspace" and not str(destination.get("workspaceId") or "").startswith("workspace."):
            fail(errors, f"action {action_id!r} workspace destination requires workspace.* workspaceId")
        if destination.get("kind") == "open-dialog" and not str(destination.get("dialogId") or "").startswith("dialog."):
            fail(errors, f"action {action_id!r} dialog destination requires dialog.* dialogId")
        if destination.get("kind") == "navigate-route" and not str(destination.get("routeId") or "").startswith("route."):
            fail(errors, f"action {action_id!r} route destination requires route.* routeId")
        if destination.get("kind") == "external" and not str(destination.get("url") or "").startswith(("http://", "https://")):
            fail(errors, f"action {action_id!r} external destination requires HTTP(S) url")
        evidence = action.get("evidence") if isinstance(action.get("evidence"), dict) else {}
        if evidence.get("level") not in EVIDENCE_LEVELS:
            fail(errors, f"action {action_id!r} evidence.level is invalid")
        sources = evidence.get("sources")
        if not isinstance(sources, list) or not sources:
            fail(errors, f"action {action_id!r} evidence.sources must be non-empty")
        spans = evidence.get("videoSpans", [])
        if not isinstance(spans, list):
            fail(errors, f"action {action_id!r} evidence.videoSpans must be an array")
        else:
            for span_index, span in enumerate(spans):
                if not isinstance(span, dict):
                    fail(errors, f"action {action_id!r} videoSpans[{span_index}] must be an object")
                    continue
                if span.get("recordingId") not in recording_ids:
                    fail(errors, f"action {action_id!r} video span references unknown recording")
                if not finite_number(span.get("startMs")) or not finite_number(span.get("endMs")) or float(span.get("endMs", 0)) <= float(span.get("startMs", 0)):
                    fail(errors, f"action {action_id!r} video span requires endMs > startMs")

    motions = data.get("motions", [])
    if not isinstance(motions, list):
        fail(errors, "motions must be an array")
        motions = []
    motion_ids: set[str] = set()
    for index, motion in enumerate(motions):
        if not isinstance(motion, dict):
            fail(errors, f"motions[{index}] must be an object")
            continue
        motion_id = motion.get("id")
        if not isinstance(motion_id, str) or not motion_id.startswith("motion.") or motion_id in motion_ids:
            fail(errors, f"motions[{index}].id must be a unique motion.* ID")
        else:
            motion_ids.add(motion_id)
        if motion.get("actionId") not in action_ids:
            fail(errors, f"motion {motion_id!r} references unknown actionId")
        for key in ("durationMs", "delayMs"):
            if not finite_number(motion.get(key)) or float(motion.get(key, 0)) < 0:
                fail(errors, f"motion {motion_id!r} requires non-negative {key}")
        if not isinstance(motion.get("easing"), str) or not motion.get("easing", "").strip():
            fail(errors, f"motion {motion_id!r} requires easing")
        motion_evidence = motion.get("evidence") if isinstance(motion.get("evidence"), dict) else {}
        if motion_evidence:
            if motion_evidence.get("recordingId") not in recording_ids:
                fail(errors, f"motion {motion_id!r} evidence references unknown recording")
            if (
                not finite_number(motion_evidence.get("startMs"))
                or not finite_number(motion_evidence.get("endMs"))
                or float(motion_evidence.get("endMs", 0)) <= float(motion_evidence.get("startMs", 0))
            ):
                fail(errors, f"motion {motion_id!r} evidence requires endMs > startMs")
        tracks = motion.get("tracks")
        if not isinstance(tracks, list) or not tracks:
            fail(errors, f"motion {motion_id!r} requires at least one track")
        else:
            for track_index, track in enumerate(tracks):
                if not isinstance(track, dict):
                    fail(errors, f"motion {motion_id!r} tracks[{track_index}] must be an object")
                    continue
                if not str(track.get("targetNodeId") or "").strip():
                    fail(errors, f"motion {motion_id!r} track requires targetNodeId")
                if track.get("property") not in MOTION_PROPERTIES:
                    fail(errors, f"motion {motion_id!r} track has unsupported property")
                if "from" not in track or "to" not in track:
                    fail(errors, f"motion {motion_id!r} track requires from and to")

    action_motion_ids: set[str] = set()
    for action in actions:
        if isinstance(action, dict):
            refs = action.get("motionIds", [])
            if not isinstance(refs, list):
                fail(errors, f"action {action.get('id')!r} motionIds must be an array")
                continue
            for motion_id in refs:
                action_motion_ids.add(str(motion_id))
                if motion_id not in motion_ids:
                    fail(errors, f"action {action.get('id')!r} references unknown motionId {motion_id!r}")
    orphaned = motion_ids - action_motion_ids
    for motion_id in sorted(orphaned):
        warnings.append(f"motion {motion_id!r} is linked by actionId but missing from action.motionIds")

    handoff = data.get("handoff") if isinstance(data.get("handoff"), dict) else {}
    approved = handoff.get("approvedStateIds") if isinstance(handoff.get("approvedStateIds"), list) else []
    for state_id in approved:
        if state_id not in state_ids:
            fail(errors, f"handoff approves unknown state: {state_id}")
        elif state_id not in settled_state_ids:
            fail(errors, f"handoff state {state_id!r} is not settled with at least two observations")
        if state_id not in state_evidence_ids:
            fail(errors, f"approved state {state_id!r} requires evidenceId for downstream coverage")

    observed_page_ids = set(state_page_ids.values())
    for page_id in sorted(required_page_ids - observed_page_ids):
        fail(errors, f"contract page has no captured state: {page_id}")
    journey_destinations: dict[str, set[str]] = {journey_id: set() for journey_id in required_journey_ids}
    for action in actions:
        if not isinstance(action, dict):
            continue
        journey_id = action.get("journeyId")
        to_state = action.get("toStateId")
        evidence = action.get("evidence") if isinstance(action.get("evidence"), dict) else {}
        if journey_id in journey_destinations and evidence.get("level") in {"observed", "confirmed"} and isinstance(to_state, str):
            journey_destinations[str(journey_id)].add(to_state)
            if to_state not in approved:
                fail(errors, f"journey {journey_id!r} destination {to_state!r} must be approved")
    for journey_id, destinations in sorted(journey_destinations.items()):
        if not destinations:
            fail(errors, f"contract journey has no observed/confirmed action edge: {journey_id}")
    non_empty_destinations = [next(iter(value)) for value in journey_destinations.values() if value]
    if len(non_empty_destinations) != len(set(non_empty_destinations)):
        fail(errors, "each contract journey must lead to a distinct approved destination state")

    if not allow_draft:
        if data.get("status") not in {"ready", "complete"}:
            fail(errors, "manifest must be ready or complete before generation")
        if not states or settled_count < 1:
            fail(errors, "at least one state must have two settled observations")
        if not approved:
            fail(errors, "handoff.approvedStateIds must contain at least one state")

    if errors:
        raise ValueError("\n".join(errors))
    return {
        "states": len(states), "actions": len(actions), "settled": settled_count,
        "approved": len(approved), "recordings": len(recordings), "motions": len(motions),
        "requiredPages": len(required_page_ids), "requiredJourneys": len(required_journey_ids),
        "warnings": warnings,
    }


def main() -> int:
    args = parse_args()
    manifest = args.manifest.resolve()
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"Validate website capture: FAIL - {error}", file=sys.stderr)
        return 1

    try:
        counts = validate_capture(data, manifest, allow_draft=args.allow_draft)
    except ValueError as error:
        print("Validate website capture: FAIL", file=sys.stderr)
        for message in str(error).splitlines():
            print(f"- {message}", file=sys.stderr)
        return 1

    print("Validate website capture: PASS")
    print(
        f"States: {counts['states']}; actions: {counts['actions']}; settled: {counts['settled']}; "
        f"approved: {counts['approved']}; recordings: {counts['recordings']}; motions: {counts['motions']}"
    )
    for warning in counts["warnings"]:
        print(f"Warning: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
