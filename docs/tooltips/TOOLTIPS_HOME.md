# Tooltip Implementation Specification: Home Page

## 1. Page Identification
- **Page Name**: Home Dashboard
- **Route**: `/home`
- **Source Files**:
  - Main Page: [`src/client/components/screens/dashboard/home/Home.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/home/Home.tsx)
  - Components:
    - [`HomeHero.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/home/components/HomeHero/HomeHero.tsx)
    - [`ActiveCohortRow.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/home/components/ActiveCohortRow/ActiveCohortRow.tsx)
    - [`HomeSummaryBar.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/home/components/HomeSummaryBar/HomeSummaryBar.tsx)

## 2. Tooltip Inventory

| Target Element | Current Purpose | Tooltip Text | Why Useful | Trigger | Placement | Icon Only | Keyboard Focus | Accessibility Notes |
|---|---|---|---|---|---|---|---|---|
| Sidebar Navigation Items (`Play`, `Home`, `Messages`, `Explore`, `Notes`) | Sidebar navigation links | Item label ("Play", "Home", "Messages", "Explore", "Notes") | Explains icon-only sidebar links | Hover + Focus | Right | Yes | Yes | Ensures `aria-label` matches tooltip text |
| New Cohort CTA Button | Link to `/create-cohort` | "Create a new learning cohort" | Provides additional context on primary hero action | Hover + Focus | Bottom | No | Yes | `aria-label` on Link |
| Streak Stat Badge | Displays current streak | "Current streak: Consecutive days active" | Explains streak counter semantics | Hover + Focus | Top | Icon + Text | Yes | Replaces browser-native `title` attribute |
| Today's Goal Stat Badge | Displays goal progress | "Today's Goal: Daily target progress" | Clarifies circular chart goal status | Hover + Focus | Top | Icon + Text | Yes | Replaces browser-native `title` attribute |
| Active Cohort Row Drag Handle | Grip handle for reordering | "Drag to reorder cohorts" | Explains drag interaction | Hover + Focus | Top | Yes | Yes | `aria-label="Drag to reorder"` |
| Active Cohort Pause Button | Pauses an active cohort | "Pause cohort" | Identifies icon-only pause action | Hover + Focus | Top | Yes | Yes | Replaces browser-native `title` attribute |
| Active Cohort Order Style Selector | Controls lesson order mode | "Order style: Sequential / Random" | Clarifies icon-only mode indicator | Hover + Focus | Top | Yes | Yes | Replaces browser-native `title` attribute |
| Home Summary Bar Toggle Arrows | Expand/collapse paused & finished lists | "Toggle list visibility" | Clarifies expand arrow function | Hover + Focus | Top | Yes | Yes | Replaces browser-native `title` attribute |

## 3. Visual Requirements
- Follow the global dark tooltip styling: dark surface (`var(--gray-950)` / `#09090b`), white text (`#ffffff`), `var(--radius-md)` rounded corners, compact padding (`5px 9px`), subtle shadow (`0 4px 14px rgba(0,0,0,0.3)`).
- Natural adjacent placement with a 6px gap from the trigger element.
- Restrained 120ms fade-in transition.

## 4. Interaction Requirements
- Show on hover or keyboard focus after a short 150ms delay.
- Hide immediately on mouse leave or blur.
- Position collision-aware to prevent overflow off viewport edges.
- Non-blocking layout (`pointer-events: none`).

## 5. Accessibility Requirements
- Supplementary UI only: underlying elements retain explicit `aria-label` or visible text.
- Keyboard focusable elements (`button`, `a`) trigger tooltip display.
- Tooltip element uses `role="tooltip"`.

## 6. Implementation Notes
- Modify `HomeHero.tsx` to replace native `title` attributes with `<Tooltip>`.
- Modify `ActiveCohortRow.tsx` to replace native `title` attributes with `<Tooltip>`.
- Modify `HomeSummaryBar.tsx` to replace native `title` attributes with `<Tooltip>`.

## 7. Acceptance Criteria
- [ ] No native browser `title` attributes remain in Home screen components.
- [ ] All icon-only buttons show consistent dark tooltips on hover and keyboard focus.
- [ ] Tooltip rendering does not alter layout or cause scrollbars.
- [ ] Type check and lint pass cleanly.
