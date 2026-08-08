# Tooltip Implementation Specification: Play Page

## 1. Page Identification
- **Page Name**: Play / Video Player Workspace
- **Route**: `/play`
- **Source Files**:
  - Main Page: [`src/client/components/screens/dashboard/play/Play.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/play/Play.tsx)
  - Components:
    - [`PlayerToolbar.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/play/components/PlayerToolbar/PlayerToolbar.tsx)
    - [`PlaybackControls.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/play/components/PlaybackControls/PlaybackControls.tsx)
    - [`BookmarkButton.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/play/components/PlayerToolbar/components/BookmarkButton.tsx)
    - [`PlaybackSpeed.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/play/components/PlayerToolbar/components/PlaybackSpeed.tsx)

## 2. Tooltip Inventory

| Target Element | Current Purpose | Tooltip Text | Why Useful | Trigger | Placement | Icon Only | Keyboard Focus | Accessibility Notes |
|---|---|---|---|---|---|---|---|---|
| Complete Lesson Button (`CheckCircle2`) | Marks active lesson chunk as completed | "Mark lesson completed" | Explains checkmark action | Hover + Focus | Left | Yes | Yes | Replaces native `title="Mark Done"` |
| Bookmark Button | Toggles bookmark on current lesson | "Bookmark lesson" | Explains bookmark action | Hover + Focus | Left | Yes | Yes | `aria-label="Bookmark lesson"` |
| Playback Speed Button | Cycles playback speed (1x, 1.25x, 1.5x, 2x) | "Playback speed" | Explains speed toggle | Hover + Focus | Left | Yes | Yes | `aria-label="Playback speed"` |
| Play / Pause Control Button | Toggles video playback | "Play (Space)" / "Pause (Space)" | Clarifies playback toggle & shortcut | Hover + Focus | Top | Yes | Yes | Dynamic text based on state |
| Rewind 10s Button | Skips backward 10 seconds | "Rewind 10 seconds" | Explains skip backward | Hover + Focus | Top | Yes | Yes | `aria-label="Rewind 10 seconds"` |
| Forward 10s Button | Skips forward 10 seconds | "Forward 10 seconds" | Explains skip forward | Hover + Focus | Top | Yes | Yes | `aria-label="Forward 10 seconds"` |
| Fullscreen Toggle Button | Toggles fullscreen mode | "Fullscreen" / "Exit fullscreen" | Explains display mode toggle | Hover + Focus | Top | Yes | Yes | Dynamic text based on state |
| Volume Button / Slider | Controls volume | "Mute" / "Unmute" / "Volume" | Explains volume control | Hover + Focus | Top | Yes | Yes | Dynamic tooltip |

## 3. Visual Requirements
- Compact dark tooltip (`var(--gray-950)` / `#09090b`), white text, `var(--radius-md)` rounded corners, compact padding (`5px 9px`), subtle shadow (`0 4px 14px rgba(0,0,0,0.3)`).
- High z-index (`var(--z-tooltip)`: 800) to float seamlessly over video layer.

## 4. Interaction Requirements
- Show on hover or keyboard focus after 150ms delay.
- Hide when user becomes idle or leaves control area.

## 5. Accessibility Requirements
- Keyboard accessible controls.
- Correct `aria-label` matching tooltip context.

## 6. Implementation Notes
- Modify `PlayerToolbar.tsx` and child components (`BookmarkButton`, `PlaybackSpeed`).
- Modify `PlaybackControls.tsx` overlay buttons to wrap in `<Tooltip>`.

## 7. Acceptance Criteria
- [ ] No native `title` attributes remain in player toolbar or playback controls.
- [ ] All player overlay buttons show consistent dark tooltips on hover and keyboard focus.
- [ ] Type check and lint pass cleanly.
