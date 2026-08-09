# Canvas UI Change Plan

## 1. Current behavior

### Grid styles
- **Component**: `HamburgerGridControls.tsx` renders the Grid Style, Line Style, and Spacing options.
- **State**: The selected grid style lives in `gridConfig` inside `NotesCanvas.tsx`.
- **Action**: When icons are clicked, they are supposed to update the `gridConfig` state.
- **Bug**: The other icons appear clickable but do nothing because the container `div` (`className={styles.inlineGridSection}`) has capture-phase event listeners (`onClickCapture`, `onPointerDownCapture`) that call `e.stopPropagation()` and `e.nativeEvent.stopImmediatePropagation()`. This intercepts the event in the capture phase, preventing the child buttons from ever receiving the `onClick` event.

### Canvas Background
- **Origin**: There are two options because one is Excalidraw's built-in background picker, and the other is a custom UI injected via a React Portal inside `HamburgerGridControls.tsx` specifically tailored with preset premium colors and inversion logic for dark mode.
- **Duplicate**: Excalidraw's default picker is unnecessarily showing because `changeViewBackgroundColor: true` is implicitly or explicitly enabled in Excalidraw.

### Width
- **Conceptual location**: Line width (stroke width) belongs to the SVG grid rendering engine inside `NotesCanvas.tsx`. 
- **Existing state**: There is currently NO state for grid line width. It is hardcoded as `stroke-width="1"` in the SVG string inside `paintCustomGrid`.
- **Control UI**: The UI controls dimension using the "Spacing" slider for the size of grid cells, but lacks one for the line thickness. 
- **Rendering layer**: Consumed by the SVG overlay `<div ref={gridOverlayRef}>` as background images encoded in SVG strings.
- **Persistence**: Managed through the overarching `gridConfig` object.

## 2. Dependency and data-flow map

```text
HamburgerGridControls UI (Buttons/Sliders)
   ↓ (triggers onChange callback)
NotesCanvas State (setGridConfig)
   ↓ (derived values for strokeWidth, layout, style)
paintCustomGrid (SVG background generation)
   ↓ (updates DOM immediately)
gridOverlayRef.current.style.backgroundImage
```

**Affected Components:**
- `src/client/components/screens/dashboard/notes/NotesCanvas.tsx`
- `src/client/components/screens/dashboard/notes/HamburgerGridControls.tsx`

## 3. Root cause analysis

- **Grid Styles Bug**: Capture-phase event stoppers (`onClickCapture`) on the parent container are swallowing clicks before they bubble down to the Grid Style and Line Style buttons.
- **Duplicate Canvas Background**: Excalidraw's default UI option is enabled by default. It co-exists with our custom Portal-injected background selector. 
- **Width Control**: There is no existing state or UI component to adjust line thickness; the width is currently hardcoded to `1`.

## 4. Proposed implementation

**Grid style**:
- Component: `HamburgerGridControls.tsx`
- State: Unchanged.
- Handler: Change `onClickCapture` and `onPointerDownCapture` on the container to `onClick` and `onPointerDown` so they intercept in the bubbling phase, allowing children to trigger first.

**Canvas Background**:
- Source: `NotesCanvas.tsx` `UIOptions`.
- Duplicate: Native Excalidraw picker.
- Safe removal point: Set `changeViewBackgroundColor: false` in `<Excalidraw UIOptions={{ canvasActions: { changeViewBackgroundColor: false } }} />`.

**Width**:
- Control: `HamburgerGridControls.tsx` (Add a range slider matching the Spacing slider).
- State: Add `strokeWidth?: number` to `GridSettingsConfig`.
- Value: `1` to `5`.
- Rendering: Pass `config.strokeWidth || 1` to the `stroke-width="${...}"` attribute inside `paintCustomGrid` in `NotesCanvas.tsx`.
- Persistence: Handled via the existing `gridConfig` flow.
- Constraints: Min `1`, Max `5`, Default `1`.

## 5. Width-control design

- **Location**: In `HamburgerGridControls.tsx`, below the "Spacing" slider.
- **UI Control**: A slider (range input) identical to the Spacing slider for visual consistency.
- **Minimum width**: `1`
- **Maximum width**: `5`
- **Default behavior**: Default width is `1`.
- **Increment/Step**: `0.5` or `1`.
- **Validation**: Fall back to `1` if undefined.

## 6. Regression analysis

### Grid-style risks
- Changing `Capture` to bubbling might cause Excalidraw to close the menu if the click bubbles all the way up. We will ensure we still call `stopPropagation()` in the bubbling phase to prevent Excalidraw's outside-click detectors from closing the menu.

### Canvas Background risks
- Setting `changeViewBackgroundColor: false` only hides the UI button in Excalidraw; it does not disable the underlying API (`appState.viewBackgroundColor`). Existing persistence relies on `handleChange` and `currentBg`, which operate programmatically via `updateScene` and are unaffected by UI visibility.

### Width risks
- Expanding `GridSettingsConfig` might break existing serialized configs if they strictly check object shapes, though typically missing keys map to `undefined`. We will provide a fallback (`config.strokeWidth || 1`).

## 7. Cautions / Things We Must NOT Do

- **Do not duplicate state**: Width will live purely in `gridConfig`.
- **Do not bypass existing abstractions**: The custom grid is painted via `paintCustomGrid()`. We will integrate width directly there.
- **Do not change unrelated behavior**: The canvas background inversion trick for dark mode must not be modified.
- **Do not redesign the UI**: The new width slider will strictly reuse the existing slider styles found in `HamburgerGridControls.tsx`.

## 8. Files likely to change

- **Modify**: `src/client/components/screens/dashboard/notes/HamburgerGridControls.tsx`
- **Modify**: `src/client/components/screens/dashboard/notes/NotesCanvas.tsx`
- **Do NOT Change**: `Notes.tsx`, `useNotes.ts`

## 9. Validation plan

- Run `npx tsc --noEmit` to ensure the extended `GridSettingsConfig` type is handled everywhere.
- Run `npx eslint src/client/components/screens/dashboard/notes` to ensure no linting regressions.
- Validate visually in the browser.

## 10. Manual acceptance checklist

### Grid styles
- [ ] Existing selected grid style still renders correctly.
- [ ] Clicking each other grid-style icon changes the selected style.
- [ ] Clicking the active style behaves correctly.
- [ ] Grid rendering corresponds to the selected style.

### Canvas Background
- [ ] Only one Canvas Background option remains (the custom one).
- [ ] Existing valid background selections still work.
- [ ] Default behavior remains unchanged.

### Width
- [ ] Width control is visible below Spacing.
- [ ] Width can be changed and updates rendering.
- [ ] Width cannot enter invalid values.
- [ ] Default width behavior is correct.
