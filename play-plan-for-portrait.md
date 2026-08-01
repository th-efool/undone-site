# Play Page — Portrait Mode Fix Plan

## Problem Statement

The /play page is built entirely for landscape desktop viewing: elements are absolutely positioned over the video, and on mobile portrait mode things overlap, overflow, and become unusable. We also forced-locked screen orientation to landscape which broke on phones (the rotation prompt was a bandaid that never worked).

**Goal:** Build a clean, native-feeling portrait layout for /play where all controls are accessible, nothing overlaps, and the experience is comfortable with one hand.

---

## What's Broken Right Now

| Issue | Root Cause |
|-------|-----------|
| LessonCard has `min-width: 390px` — overflows on 360-412px phones | Hardcoded width in `LessonCard.module.css` |
| Controls row (left/center/right) is too wide for portrait | Horizontal flex with 3 sections, no wrapping |
| Timeline positioned at `right: 36px; left: 36px` — squished on mobile | Absolute positioning from desktop layout |
| Toolbar floating right-center overlaps controls area | No awareness of vertical space constraints |
| Video `top: -80px` extends beyond viewport, looks clipped | Cinematic zoom effect designed for landscape |
| Notes panel & queue drawer absolutely positioned off-screen in portrait | Same absolute-position architecture |
| Rotation prompt overlay — always rendered, never conditioned | Removed in this PR (dead code + CSS also cleaned up) ✓ |

---

## Target Layout: Portrait (≤768px)

```
┌──────────────────────────────┐
│           VIDEO              │  ← ~50% height, rounded corners, cinematic top/bottom bars
│         (16:9 or 4:3)        │     positioned with `object-fit: contain` in a fixed box
├──────────────────────────────┤
│ 🎬 Title          🔖 ⏱️    │  ← compact header row (lesson info + toolbar actions merged)
│ S1 V2/5 • Chunk 3/7         │     smaller text, no separate card container
├──────────────────────────────┤
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  │  ← full-width timeline scrubber (touch-friendly)
├──────────────────────────────┤
│   ⏪  ◁     ▶     ▷        │  ← prev/skip row, large touch targets (48px min)
│      03:21 / 12:45          │  ← compact time display centered below
├──────────────────────────────┤
│         ✅ Mark Done         │  ← full-width primary action button
│     ⏸ Play/Pause (big)      │  ← center play/pause as the biggest button
└──────────────────────────────┘
```

---

## Changes Required

### Phase 1: Structural CSS Overhaul (`Play.module.css`)

**Remove all absolute positioning for mobile.** The entire overlay approach needs to become a vertical scroll layout below the video.

#### Current (desktop-absolute):
```css
.lessonCard { position: absolute; top: 36px; left: 36px; }
.toolbar    { position: absolute; top: 50%; right: 32px; transform: translateY(-50%); }
.timeline   { position: absolute; right: 36px; bottom: 84px; left: 36px; }
.controls   { position: absolute; right: 36px; bottom: 28px; left: 36px; }
```

#### New (portrait flex-column):
```css
@media (max-width: 768px) {
  .play {
    height: auto;
    min-height: 100dvh;
    padding: 0;
  }

  /* Video container — fixed aspect ratio box */
  .lessonCard, .toolbar, .timeline, .controls {
    position: static !important;       /* remove absolute positioning */
    transform: none !important;        /* remove transforms */
  }

  /* Stack everything vertically */
  .play > * {
    width: 100%;
  }

  /* Hide queue drawer & notes panel in portrait */
  .queueDrawer, .notesPanel {
    display: none !important;
  }
}
```

### Phase 2: Video Container Fix (`PlayerSurface.module.css`)

**Fix the video overflow.** The `-80px top` + `+160px height` on `.videoWrapper` creates a cinematic zoom that clips badly in portrait.

- In portrait, set `top: 0; height: 100%` so video fills the container properly
- Keep the overlay gradient for text readability on mobile only
- Add `object-fit: contain` to prevent stretching

```css
@media (max-width: 768px) {
  .videoWrapper {
    top: 0 !important;
    height: 100% !important;
  }
}
```

### Phase 3: LessonCard Compact Mode (`LessonCard.module.css`)

**Remove the `min-width: 390px` constraint.** This is the single biggest bug for mobile.

- Remove `min-width: 390px`, change to `width: 100%`
- Reduce padding from `14px 18px` to `12px 14px`
- Scale down title font from `1.25rem` → `1rem`
- Hide the subtitle row (S1 V2/5 • Chunk 3/7) on mobile — keep only the title
- Make platform icon smaller: `30×30` instead of `36×36`

### Phase 4: Controls Layout (`PlaybackControls.module.css`)

**Reorganize from horizontal left/center/right to a vertical touch-friendly layout.**

Current structure:
```
┌─────────────────────────────────────┐
│ ⏸ ◁ ▷       Done Prev Next    🔊 ⛶ │  ← too many elements for ~360px width
│     03:21 / 12:45                   │
└─────────────────────────────────────┘
```

New portrait layout (two-row flex + grid):
```
Row 1: ◁   ⏸(large)   ▷        ← play centered, prev/next on sides
Row 2: ─03:21 / 12:45─          ← time display, compact
Row 3: ✅ Mark Done (full width)← primary action button

Skip buttons (◁ ▷ 10s rewind/forward): hide in portrait — use swipe gestures instead.
Volume: show as small toggle icon only, hide the slider in portrait.
```

Implementation approach:
- Keep the component structure but override with CSS Grid for mobile
- Use `display: grid; grid-template-columns: auto 1fr auto` for the main control row
- Move Done button to its own full-width row
- Hide skip buttons (`<576px`) — rely on swipe-to-skip gesture already in Play.tsx

### Phase 5: Timeline Compact Mode (`LearningTimeline.module.css`)

**Make it full-width and touch-friendly.**

- Remove absolute positioning from parent (Phase 1 handles this)
- Increase track height for better touch targets: `height: 24px` → `32px`
- Make the thumb larger in portrait: `width/height: 16px` → `20px`
- Ensure it spans full width with proper padding

### Phase 6: Toolbar Merge (`PlayerToolbar.module.css`)

**Merge toolbar into the lesson info header for mobile.** Instead of floating on the right side, show bookmark and speed buttons inline next to the title.

Implementation options:
1. **CSS-only merge:** Show a second row in LessonCard's metadata area with bookmark + speed icons
2. **Component change:** Pass `compactMode` prop to LessonCard to render inline toolbar
3. **New mobile header component:** A simple `<PlayHeader />` that combines lesson info + toolbar actions

Recommend option 1 (CSS-only) since it requires the least code change and keeps all data in the existing components. Just add a second flex row inside `.metadata` for the toolbar buttons on mobile:
```css
@media (max-width: 768px) {
  .metadata {
    gap: 4px;
  }
  /* Show bookmark + speed as small icon buttons below title */
}
```

### Phase 7: Touch Gesture Enhancements (`Play.tsx`)

The touch swipe gesture already exists (swipe up = next, swipe down = prev). For portrait mode:
- Add left/right swipe for rewind/forward 10s (mirrors the skip buttons)
- Ensure all interactive elements have `min-height: 48px` touch targets
- Consider adding a bottom-safe-area padding for phones with home indicators

---

## Files to Modify

| File | Changes |
|------|---------|
| `Play.module.css` | Remove absolute positioning in mobile media query; new flex-column layout |
| `PlayerSurface.module.css` | Fix video wrapper overflow in portrait |
| `LessonCard.module.css` | Remove min-width, scale down for mobile |
| `PlaybackControls.module.css` | Reorganize into grid/touch-friendly layout for mobile |
| `LearningTimeline.module.css` | Full-width, larger touch targets on mobile |
| `PlayerToolbar.module.css` | Compact icon-only mode for mobile header merge |
| `Play.tsx` | Remove rotation prompt (done), add right-swipe gesture for skip |

---

## Implementation Order

1. **Remove absolute positioning in Play.module.css** — this is the foundation, everything else depends on it being a normal document flow in portrait
2. **Fix LessonCard min-width** — prevents horizontal overflow immediately  
3. **Rebuild Controls layout** — the biggest UX win; makes the page actually usable
4. **Fix video wrapper** — ensures the content area looks right
5. **Compact timeline + toolbar merge** — polish steps

---

## Validation Checklist

- [ ] LessonCard fits on a 360px-wide screen without horizontal scroll
- [ ] All buttons have ≥44px touch targets (Apple HIG / Material Design standard)
- [ ] No overlapping elements in portrait mode at any viewport width ≤768px
- [ ] Mark Done button is the most prominent action on the page
- [ ] Play/Pause button is large and centered (primary interaction)
- [ ] Timeline scrubber spans full width, thumb is ≥16px for easy grabbing
- [ ] Swipe gestures still work correctly after layout changes
- [ ] Video doesn't clip or extend beyond viewport in portrait
- [ ] No rotation prompt visible anywhere (removed permanently ✓)
- [ ] Layout looks good on both 320px (small Android), 375px (iPhone SE), and 430px (iPhone Pro Max)

---

## Notes & Trade-offs

**What we're NOT doing in this plan:**
- Full-screen mode handling — keep existing behavior
- Queue drawer / notes panel for mobile — hide them, they can be accessed via a bottom sheet later if needed
- Changing the video player component itself (YouTube embed, etc.)
- Adding new features — purely layout/UX fixes

**Why no `orientation.lock()`:**
Phone users don't want their device locked to landscape. The old code tried to force it with both Web API and Capacitor plugin, but:
1. iOS Safari doesn't reliably support screen.orientation.lock()
2. Android webviews behave inconsistently
3. It creates a jarring UX where the user can't rotate back to portrait

The solution is making the layout work in BOTH orientations rather than fighting the device's natural behavior.
