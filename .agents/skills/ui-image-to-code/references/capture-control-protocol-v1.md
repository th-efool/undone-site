# UI Capture Control Protocol v1

Protocol name: `uccp/1`

## Contents

1. Goals and boundaries
2. Architecture
3. Transport and framing
4. Envelope types
5. Session state machine
6. Methods
7. Events
8. Identity and timing
9. Files and integrity
10. Safety and privacy
11. Failure recovery
12. End-to-end exchange
13. Acceptance criteria

## Goals and boundaries

Use UCCP/1 to let Codex coordinate a local capture adapter such as QingLu without automating its GUI. Codex plans and drives the authorized browser. The adapter records pixels, screenshots, markers, and health. It never decides what to click and never injects browser or operating-system input.

Design for:

- Deterministic request/response behavior.
- Append-only audit events.
- Stable identities across retries and resumed Codex turns.
- Exact viewport and native-pixel evidence.
- Recorder failure without loss of the whole UI reconstruction.
- Source-blind capture that returns pixels, not DOM/source/network data.

Do not expose the service over a LAN or public network. Do not make the recorder a remote-control agent.

## Architecture

```text
User request
  -> Codex controller
      -> Browser actuator: navigate/click/hover/scroll
      -> UCCP/1 client
          -> QingLu capture adapter: record/screenshot/mark/status
      -> Capture manifest + state graph
      -> UI evidence/spec/code compiler
      -> Browser replay + Studio
```

The browser screenshot remains the geometry authority because it is captured at the exact CSS viewport. QingLu provides native-pixel cross-checks, videos, pointer/keystroke overlays, and independent evidence.

## Transport and framing

### Required transport

Start a child process in standard-I/O mode:

```text
QingLu.exe --control-stdio --protocol uccp/1
```

- Encode every message as one UTF-8 JSON object followed by `\n`.
- Reserve stdout for protocol messages only; send human logs to stderr.
- Limit one message to 1 MiB. Store images/video as files and send metadata, never base64 media.
- Allow exactly one active capture session per channel in v1.
- Exit only after `session.stop`, `session.abort`, parent-process loss, or fatal protocol error.

### Optional transport

A long-lived Windows build may use a per-user named pipe. Apply the same envelopes and state machine. Bind the pipe ACL to the current user, require a random session token from the spawning Codex process, and never open a TCP listener.

## Envelope types

Every envelope requires:

```json
{
  "protocol": "uccp/1",
  "kind": "request|response|event"
}
```

### Request

```json
{
  "protocol": "uccp/1",
  "kind": "request",
  "id": "req.000004",
  "method": "frame.capture",
  "sessionId": "session.run.example-4ea17f.01",
  "params": {}
}
```

- Make `id` unique within a channel.
- Retrying the exact same request ID and payload must return the cached response without repeating side effects.
- Reusing an ID with a different payload returns `ID_CONFLICT`.

### Response

```json
{
  "protocol": "uccp/1",
  "kind": "response",
  "id": "req.000004",
  "ok": true,
  "result": {}
}
```

Failure response:

```json
{
  "protocol": "uccp/1",
  "kind": "response",
  "id": "req.000004",
  "ok": false,
  "error": {
    "code": "CAPTURE_TIMEOUT",
    "message": "Frame was not committed within 5000ms",
    "retryable": true,
    "details": {}
  }
}
```

### Event

```json
{
  "protocol": "uccp/1",
  "kind": "event",
  "event": "frame.saved",
  "sessionId": "session.run.example-4ea17f.01",
  "seq": 6,
  "tsMonotonicMs": 53241,
  "tsUtc": "2026-08-14T05:00:00.000Z",
  "data": {}
}
```

Sequence numbers start at 1 and increase without reuse. `tsMonotonicMs` is the synchronization authority; UTC is for human audit only.

## Session state machine

```text
process-start
  -> idle
  -> session-ready      session.start
  -> recording          recorder.start
  -> session-ready      recorder.stop
  -> complete           session.stop

session-ready|recording
  -> aborted            session.abort

any active state
  -> degraded           recoverable adapter failure
  -> fatal              unsafe output, protocol mismatch, or unrecoverable encoder failure
```

Rules:

- Allow `frame.capture`, `marker.add`, and `session.status` in `session-ready` or `recording`.
- Allow `recorder.start` only in `session-ready`.
- Allow `recorder.stop` only in `recording`.
- Reject invalid transitions with `INVALID_STATE`; do not silently reinterpret them.
- Flush and hash every committed artifact before reporting `complete`.
- A degraded recorder may still capture browser screenshots outside UCCP/1; record that fallback in the website manifest.

## Methods

### `protocol.hello`

Request before all other methods:

```json
{"client":{"name":"codex","version":"1"},"requestedProtocol":"uccp/1"}
```

Return adapter name/version, protocol version, supported methods, screenshot modes, video codecs, maximum dimensions, and whether recording, original-pixel screenshot, pointer assist, and keystroke assist are available.

### `session.start`

Required parameters:

```json
{
  "runId": "run.example-4ea17f",
  "outputRoot": "C:\\project\\artifacts\\ui-capture\\example-4ea17f",
  "profile": "blind-visual",
  "target": {
    "kind": "window",
    "titleHint": "Codex Browser",
    "bounds": {"x": 0, "y": 0, "width": 1920, "height": 1080}
  },
  "privacy": {"excludeRecorderUi": true, "captureAudio": false}
}
```

Return `sessionId`, resolved target bounds, monitor/DPI metadata, and output root. Refuse an output root outside the supplied authorized task directory.

### `session.status`

Return current state, target health, recording health, dropped frames, disk availability, last sequence, committed artifact count, and recoverable warnings.

### `recorder.start`

Parameters include video profile, frame rate, pointer assist, keystroke assist, and an optional relative output path. Audio defaults off for UI evidence. Return the future recording ID and path before recording events begin.

### `marker.add`

Use markers to align browser actions and video:

```json
{
  "actionId": "action.state.home.open.menu",
  "phase": "before",
  "browserTsMonotonicMs": 52780,
  "visibleLabel": "产品"
}
```

Allowed phases are `before`, `press`, `release`, `transition`, `settled`, and `blocked`. A marker is metadata only and must not execute the action.

### `frame.capture`

```json
{
  "stateId": "state.home.menu-open",
  "frameId": "frame.state.home.menu-open.settled.001",
  "actionId": "action.state.home.open.menu",
  "phase": "settled",
  "mode": "original-pixels",
  "relativePath": "screenshots/state-home-menu-open.png"
}
```

Return the committed artifact metadata. `actionId` may be null only for the initial state or explicit manual calibration frames.

### `recorder.stop`

Finalize the video atomically, return its duration, dimensions, frame rate, dropped-frame count, relative path, byte length, and SHA-256.

### `session.stop`

Flush pending artifacts, emit a final health summary, and transition to `complete`. Refuse success while a recording is still active.

### `session.abort`

Stop capture safely, preserve already committed artifacts, write an aborted-session report, and return which artifacts remain usable. It is idempotent.

## Events

Required events:

| Event | Meaning |
| --- | --- |
| `session.ready` | Target and output root are bound |
| `recorder.started` | Video writer is accepting frames |
| `marker.accepted` | Marker is durably journaled |
| `frame.saved` | Screenshot is committed and hashed |
| `recorder.stopped` | Video is committed and hashed |
| `health.changed` | Target, disk, encoder, or frame-drop health changed |
| `session.completed` | All final artifacts are flushed |
| `session.aborted` | Session ended with preserved partial evidence |
| `adapter.warning` | Recoverable issue needs controller attention |
| `adapter.fatal` | Adapter cannot safely continue |

`frame.saved` data requires:

```json
{
  "stateId": "state.home.menu-open",
  "frameId": "frame.state.home.menu-open.settled.001",
  "phase": "settled",
  "relativePath": "screenshots/state-home-menu-open.png",
  "sha256": "64 lowercase hex characters",
  "bytes": 204800,
  "width": 1920,
  "height": 1080,
  "captureBounds": {"x": 0, "y": 0, "width": 1920, "height": 1080},
  "dpi": {"x": 96, "y": 96}
}
```

## Identity and timing

- Codex owns `runId`, `journeyId`, `screenId`, `stateId`, `actionId`, and `frameId`.
- The adapter owns `sessionId`, `recordingId`, event `seq`, and artifact hashes.
- Never replace identities with timestamps or array indexes.
- Send Codex monotonic timestamps in `marker.add`; the adapter stores both client and adapter monotonic time so drift can be measured.
- Emit `health.changed` when absolute clock drift exceeds 100ms or video/screenshot alignment drift exceeds one video frame.

## Files and integrity

- Resolve every relative path under `outputRoot`; reject traversal and absolute child paths.
- Write to a unique `.partial` file, flush, close, compute SHA-256, then atomically rename.
- Never report `frame.saved` or `recorder.stopped` before the final file exists.
- Never overwrite a committed artifact. Return `ID_CONFLICT` if identity/path/hash disagrees.
- Store media outside JSONL. Include relative path, bytes, SHA-256, dimensions, capture bounds, DPI, and capture mode.
- Keep a local append-only event journal so a parent-process crash can be reconciled on the next Codex turn.

## Safety and privacy

- Bind to stdio or a current-user named pipe only.
- Require output roots inside the authorized task directory.
- Capture pixels only in `blind-visual`; do not enumerate DOM, source, network, cookies, credentials, or hidden accessibility data.
- Default microphone, system audio, camera, and clipboard capture off.
- Exclude recorder chrome and secret overlays when supported.
- Let Codex enforce action risk gates. The adapter records a `blocked` marker but never approves high-risk actions.
- Redact authorization tokens from logs and never place them in filenames.

## Failure recovery

Use these error codes:

| Code | Retryable | Controller behavior |
| --- | --- | --- |
| `PROTOCOL_MISMATCH` | No | Stop adapter; use compatible version or browser fallback |
| `INVALID_REQUEST` | No | Fix request; do not retry unchanged |
| `INVALID_STATE` | Maybe | Query status and resume from reported state |
| `ID_CONFLICT` | No | Preserve evidence and create a new identity only after audit |
| `TARGET_NOT_FOUND` | Yes | Rebind visible browser target |
| `TARGET_CHANGED` | Yes | Pause, verify bounds/DPI, then resume |
| `OUTPUT_NOT_WRITABLE` | No | Choose an authorized writable root |
| `CAPTURE_TIMEOUT` | Yes | Retry once, then browser screenshot fallback |
| `ENCODER_UNAVAILABLE` | Yes | Disable video; keep screenshots |
| `DISK_LOW` | No | Stop recording cleanly and preserve committed files |
| `BUSY` | Yes | Wait with bounded backoff |
| `UNSUPPORTED` | No | Remove optional feature or use fallback |
| `INTERNAL` | Maybe | Query status; abort if integrity is uncertain |

Require a heartbeat through `session.status` at least every five seconds while recording. After two missed heartbeats, stop issuing recorder commands, mark the adapter degraded, continue browser screenshots, and attempt one clean reconnect. Never repeat browser actions merely to recover the recorder unless the action is proven reversible.

## End-to-end exchange

Minimum valid order:

```text
protocol.hello -> response
session.start -> response -> session.ready
recorder.start -> response -> recorder.started
marker.add(before) -> response -> marker.accepted
[Codex performs browser action]
marker.add(settled) -> response -> marker.accepted
frame.capture(settled) -> response -> frame.saved
recorder.stop -> response -> recorder.stopped
session.stop -> response -> session.completed
```

Validate a captured JSONL exchange with:

```text
python <skill>/scripts/validate_capture_protocol.py <transcript.jsonl>
```

## Acceptance criteria

Accept an adapter only when:

- Protocol handshake rejects incompatible versions.
- Repeated identical request IDs are idempotent; conflicting payloads fail.
- State transitions reject out-of-order operations.
- Screenshot and video events occur only after atomic commit and SHA-256.
- Event sequence and monotonic time never go backward.
- Parent or adapter crashes leave recoverable append-only evidence.
- Recorder UI is excluded from evidence when supported.
- A recorder failure automatically degrades to browser screenshots without losing state IDs.
- `blind-visual` produces no DOM/source/network data.
- `validate_capture_protocol.py` passes a complete transcript and rejects corrupted ordering, missing responses, duplicate identities, and malformed frame metadata.
