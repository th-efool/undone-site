#!/usr/bin/env python3
"""Validate a UCCP/1 JSONL control transcript."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


PROTOCOL = "uccp/1"
REQUEST_ID = re.compile(r"^req\.[A-Za-z0-9._-]+$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
METHODS = {
    "protocol.hello",
    "session.start",
    "session.status",
    "recorder.start",
    "marker.add",
    "frame.capture",
    "recorder.stop",
    "session.stop",
    "session.abort",
}
PHASES = {"before", "press", "release", "transition", "settled", "blocked", "manual"}
EVENTS = {
    "session.ready",
    "recorder.started",
    "marker.accepted",
    "frame.saved",
    "recorder.stopped",
    "health.changed",
    "session.completed",
    "session.aborted",
    "adapter.warning",
    "adapter.fatal",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("transcript", type=Path)
    parser.add_argument("--allow-partial", action="store_true")
    return parser.parse_args()


def add(errors: list[str], line: int, message: str) -> None:
    errors.append(f"line {line}: {message}")


def canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def positive_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def validate_request(message: dict, line: int, errors: list[str]) -> None:
    method = message.get("method")
    params = message.get("params")
    if method not in METHODS:
        add(errors, line, f"unsupported method {method!r}")
        return
    if not isinstance(params, dict):
        add(errors, line, "params must be an object")
        return
    session_id = message.get("sessionId")
    if method not in {"protocol.hello", "session.start"} and not isinstance(session_id, str):
        add(errors, line, f"{method} requires sessionId")
    if method == "protocol.hello" and params.get("requestedProtocol") != PROTOCOL:
        add(errors, line, "protocol.hello must request uccp/1")
    if method == "session.start":
        if not isinstance(params.get("runId"), str) or not params["runId"].startswith("run."):
            add(errors, line, "session.start requires run.* runId")
        if not isinstance(params.get("outputRoot"), str) or not params["outputRoot"]:
            add(errors, line, "session.start requires outputRoot")
        if params.get("profile") not in {"blind-visual", "authorized-semantic"}:
            add(errors, line, "session.start requires a supported profile")
        if not isinstance(params.get("target"), dict):
            add(errors, line, "session.start requires target")
    if method == "marker.add":
        if not isinstance(params.get("actionId"), str) or not params["actionId"].startswith("action."):
            add(errors, line, "marker.add requires action.* actionId")
        if params.get("phase") not in PHASES - {"manual"}:
            add(errors, line, "marker.add phase is invalid")
    if method == "frame.capture":
        if not isinstance(params.get("stateId"), str) or not params["stateId"].startswith("state."):
            add(errors, line, "frame.capture requires state.* stateId")
        if not isinstance(params.get("frameId"), str) or not params["frameId"].startswith("frame."):
            add(errors, line, "frame.capture requires frame.* frameId")
        if params.get("phase") not in PHASES:
            add(errors, line, "frame.capture phase is invalid")
        path = params.get("relativePath")
        if not isinstance(path, str) or not path or Path(path).is_absolute() or ".." in Path(path).parts:
            add(errors, line, "frame.capture relativePath must remain under outputRoot")


def validate_frame_event(message: dict, line: int, errors: list[str]) -> None:
    data = message.get("data")
    if not isinstance(data, dict):
        add(errors, line, "frame.saved data must be an object")
        return
    if not isinstance(data.get("stateId"), str) or not data["stateId"].startswith("state."):
        add(errors, line, "frame.saved requires stateId")
    if not isinstance(data.get("frameId"), str) or not data["frameId"].startswith("frame."):
        add(errors, line, "frame.saved requires frameId")
    if data.get("phase") not in PHASES:
        add(errors, line, "frame.saved phase is invalid")
    if not isinstance(data.get("relativePath"), str) or not data["relativePath"]:
        add(errors, line, "frame.saved requires relativePath")
    if not isinstance(data.get("sha256"), str) or not SHA256.fullmatch(data["sha256"]):
        add(errors, line, "frame.saved requires lowercase SHA-256")
    for field in ("bytes", "width", "height"):
        if not positive_int(data.get(field)):
            add(errors, line, f"frame.saved requires positive {field}")
    bounds = data.get("captureBounds")
    if not isinstance(bounds, dict) or not positive_int(bounds.get("width")) or not positive_int(bounds.get("height")):
        add(errors, line, "frame.saved requires valid captureBounds")


def main() -> int:
    args = parse_args()
    try:
        raw_lines = args.transcript.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        print(f"Validate capture protocol: FAIL - {error}", file=sys.stderr)
        return 1

    errors: list[str] = []
    requests: dict[str, tuple[int, dict, str]] = {}
    responses: set[str] = set()
    session_state = "idle"
    active_session: str | None = None
    saw_hello = False
    saw_complete = False
    last_seq: dict[str, int] = {}
    last_time: dict[str, int | float] = {}

    for line_number, raw in enumerate(raw_lines, 1):
        if not raw.strip():
            continue
        try:
            message = json.loads(raw)
        except json.JSONDecodeError as error:
            add(errors, line_number, f"invalid JSON: {error.msg}")
            continue
        if not isinstance(message, dict):
            add(errors, line_number, "message must be an object")
            continue
        if message.get("protocol") != PROTOCOL:
            add(errors, line_number, "protocol must be uccp/1")
        kind = message.get("kind")

        if kind == "request":
            request_id = message.get("id")
            if not isinstance(request_id, str) or not REQUEST_ID.fullmatch(request_id):
                add(errors, line_number, "request id must match req.*")
                continue
            fingerprint = canonical(message)
            if request_id in requests:
                if requests[request_id][2] != fingerprint:
                    add(errors, line_number, f"request id conflict: {request_id}")
            else:
                requests[request_id] = (line_number, message, fingerprint)
            validate_request(message, line_number, errors)

        elif kind == "response":
            request_id = message.get("id")
            if request_id not in requests:
                add(errors, line_number, f"orphan response {request_id!r}")
                continue
            if request_id in responses:
                add(errors, line_number, f"duplicate response {request_id}")
                continue
            responses.add(request_id)
            if not isinstance(message.get("ok"), bool):
                add(errors, line_number, "response ok must be boolean")
                continue
            request = requests[request_id][1]
            method = request.get("method")
            if not message["ok"]:
                error = message.get("error")
                if not isinstance(error, dict) or not isinstance(error.get("code"), str):
                    add(errors, line_number, "failed response requires error.code")
                continue
            result = message.get("result")
            if not isinstance(result, dict):
                add(errors, line_number, "successful response requires result object")
                continue
            if method == "protocol.hello":
                saw_hello = True
                if result.get("protocol") != PROTOCOL:
                    add(errors, line_number, "hello response must confirm uccp/1")
            elif method == "session.start":
                if session_state != "idle":
                    add(errors, line_number, f"session.start invalid in {session_state}")
                active_session = result.get("sessionId")
                if not isinstance(active_session, str) or not active_session.startswith("session."):
                    add(errors, line_number, "session.start result requires sessionId")
                session_state = "session-ready"
            elif method == "recorder.start":
                if session_state != "session-ready":
                    add(errors, line_number, f"recorder.start invalid in {session_state}")
                session_state = "recording"
            elif method == "recorder.stop":
                if session_state != "recording":
                    add(errors, line_number, f"recorder.stop invalid in {session_state}")
                session_state = "session-ready"
            elif method in {"marker.add", "frame.capture"} and session_state not in {"session-ready", "recording"}:
                add(errors, line_number, f"{method} invalid in {session_state}")
            elif method == "session.stop":
                if session_state != "session-ready":
                    add(errors, line_number, f"session.stop invalid in {session_state}")
                session_state = "complete"
                saw_complete = True
            elif method == "session.abort":
                session_state = "aborted"

        elif kind == "event":
            event = message.get("event")
            if event not in EVENTS:
                add(errors, line_number, f"unsupported event {event!r}")
            session_id = message.get("sessionId")
            if not isinstance(session_id, str):
                add(errors, line_number, "event requires sessionId")
                continue
            if active_session is not None and session_id != active_session:
                add(errors, line_number, "event sessionId differs from active session")
            seq = message.get("seq")
            timestamp = message.get("tsMonotonicMs")
            if not positive_int(seq):
                add(errors, line_number, "event seq must be positive integer")
            elif seq <= last_seq.get(session_id, 0):
                add(errors, line_number, "event seq must increase")
            else:
                last_seq[session_id] = seq
            if not isinstance(timestamp, (int, float)) or isinstance(timestamp, bool) or timestamp < last_time.get(session_id, 0):
                add(errors, line_number, "event monotonic time must not decrease")
            else:
                last_time[session_id] = timestamp
            if event == "frame.saved":
                validate_frame_event(message, line_number, errors)
        else:
            add(errors, line_number, f"kind must be request, response, or event; got {kind!r}")

    for request_id, (line_number, _, _) in requests.items():
        if request_id not in responses:
            add(errors, line_number, f"request has no response: {request_id}")
    if not args.allow_partial:
        if not saw_hello:
            errors.append("transcript has no successful protocol.hello")
        if not saw_complete or session_state != "complete":
            errors.append("transcript does not complete session.stop")

    if errors:
        print("Validate capture protocol: FAIL", file=sys.stderr)
        for message in errors:
            print(f"- {message}", file=sys.stderr)
        return 1

    print("Validate capture protocol: PASS")
    print(f"Messages: {sum(1 for line in raw_lines if line.strip())}; requests: {len(requests)}; events: {sum(last_seq.values()) if last_seq else 0}; state: {session_state}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
