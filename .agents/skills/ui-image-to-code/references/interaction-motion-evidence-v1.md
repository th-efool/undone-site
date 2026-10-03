# Interaction and motion evidence V1

Use this contract when a screenshot or live website includes buttons, menus, route changes, dialogs, workspace switches, or observable transitions. Static screenshots define geometry. Browser actions define destinations. Video is optional timing and transition evidence.

## Contents

1. Identity model
2. Action edge
3. Recording and video spans
4. Motion tracks
5. Evidence levels
6. Compilation and replay

## Identity model

Keep these IDs stable within a run and across generated source or Studio revisions:

```text
screen.*
state.*
node.*
menu.*
workspace.*
dialog.*
route.*
action.*
motion.*
recording.*
```

A visual geometry edit may change a node's bounds, but it must not silently replace its action, destination, state, or motion identity.

## Action edge

Store action edges in `capture-manifest.json` under `stateGraph.actions`:

```json
{
  "id": "action.sidebar.icons.open",
  "fromStateId": "state.studio.structure",
  "toStateId": "state.studio.icons",
  "risk": "safe",
  "trigger": {
    "kind": "click",
    "targetNodeId": "sidebar.mode.icons",
    "visibleLabel": "Icons"
  },
  "destination": {
    "kind": "switch-workspace",
    "stateId": "state.studio.icons",
    "workspaceId": "workspace.icons"
  },
  "feedback": {
    "pressed": true,
    "selectedAfter": true
  },
  "motionIds": ["motion.workspace.icons-enter"],
  "evidence": {
    "level": "confirmed",
    "sources": ["browser-replay", "video"],
    "frameIds": ["frame.structure.before", "frame.icons.settled"],
    "videoSpans": [
      {"recordingId": "recording.main-flow", "startMs": 12420, "endMs": 12880}
    ]
  }
}
```

Allowed trigger kinds are `click`, `hover`, `input`, `keyboard`, `scroll`, `drag`, and `time`.

Allowed destination kinds are:

- `open-menu`
- `expand-submenu`
- `switch-workspace`
- `navigate-route`
- `open-dialog`
- `toggle-state`
- `external`
- `download`
- `no-change`

Require `menuId` for menu destinations, `workspaceId` for workspace destinations, `dialogId` for dialog destinations, and `routeId` for route destinations. External destinations require an HTTP(S) `url`. `destination.stateId` must equal the action's `toStateId`.

## Recording and video spans

Recordings are supplemental and never block static reconstruction:

```json
{
  "id": "recording.main-flow",
  "path": "recordings/main-flow.mp4",
  "viewportId": "vp-1440x900",
  "durationMs": 18400,
  "fps": 60,
  "status": "available",
  "source": "qinglu",
  "purpose": "interaction-and-motion-evidence"
}
```

Use browser action timestamps, before/after screenshots, visible pointer evidence, and visual changes to align video spans. If the click cause cannot be repeated or directly confirmed, keep the edge `inferred`; a scene cut is not proof of a click.

Do not require a recorder control protocol for the normal website workflow. Codex controls the browser and writes the action graph. QingLu may record one bounded flow manually or through any available supported capture command.

## Motion tracks

Store observable motion under top-level `motions`:

```json
{
  "id": "motion.workspace.icons-enter",
  "actionId": "action.sidebar.icons.open",
  "durationMs": 240,
  "delayMs": 0,
  "easing": "cubic-bezier(0.2, 0.8, 0.2, 1)",
  "tracks": [
    {
      "targetNodeId": "workspace.icons",
      "property": "opacity",
      "from": 0,
      "to": 1
    }
  ],
  "interruptBehavior": "reverse",
  "reducedMotion": "instant-state-change",
  "evidence": {
    "recordingId": "recording.main-flow",
    "startMs": 12420,
    "endMs": 12880
  }
}
```

Do not add decorative motion when video does not prove it. Capture intermediate tracks only when the property change is visibly distinguishable.

## Evidence levels

- `observed`: directly visible, but the cause may not be confirmed.
- `confirmed`: reproduced in an authorized live browser or explicitly confirmed by the user.
- `inferred`: plausible from a transition or recording cut.
- `unknown`: required information is missing.

Only observed and confirmed details become parity requirements without an uncertainty note.

## Compilation and replay

Validate the capture first, then compile the source contract:

```text
python scripts/validate_website_capture.py <capture-manifest.json>
python scripts/compile_interaction_spec.py <capture-manifest.json>
```

The compiled spec binds each `action.*` to a stable `data-ui-id`, declares the destination and semantic element type, and carries only evidenced motion. Replay every observed or confirmed safe action at the recorded viewport. Validate the final state first; only then compare motion start, meaningful intermediate frames, and settled output.
