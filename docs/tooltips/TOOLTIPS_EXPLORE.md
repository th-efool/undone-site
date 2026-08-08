# Tooltip Implementation Specification: Explore Page

## 1. Page Identification
- **Page Name**: Explore Dashboard
- **Route**: `/explore`
- **Source Files**:
  - Main Page: [`src/client/components/screens/dashboard/explore/Explore.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/explore/Explore.tsx)
  - Components:
    - [`ExploreHero.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/explore/components/ExploreHero/ExploreHero.tsx)
    - [`CloudBed.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/explore/components/CloudBed/CloudBed.tsx)
    - [`RecentlyPublished.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/explore/components/RecentlyPublished/RecentlyPublished.tsx)

## 2. Tooltip Inventory

| Target Element | Current Purpose | Tooltip Text | Why Useful | Trigger | Placement | Icon Only | Keyboard Focus | Accessibility Notes |
|---|---|---|---|---|---|---|---|---|
| Search Bar Clear Button | Clears the current search input | "Clear search" | Clarifies quick reset action | Hover + Focus | Top | Yes | Yes | `aria-label="Clear search"` |
| Build a Cohort CTA Button | Navigates to `/create-cohort` | "Build custom cohort" | Clarifies action purpose | Hover + Focus | Bottom | No | Yes | Accessible link text intact |
| Topic Card Tag / Badge | Filters or previews topics | "View topic details" | Explains interaction on topic pills | Hover + Focus | Top | No | Yes | `aria-label` on topic card |
| Fresh Discoveries Load More | Loads additional articles | "Load more articles" | Confirms pagination action | Hover + Focus | Top | No | Yes | Clear button semantics |

## 3. Visual Requirements
- Dark surface (`var(--gray-950)` / `#09090b`), white text (`#ffffff`), `var(--radius-md)` rounded corners, compact padding (`5px 9px`), subtle shadow (`0 4px 14px rgba(0,0,0,0.3)`).
- Natural adjacent placement with 6px gap.
- Restrained 120ms fade-in transition.

## 4. Interaction Requirements
- Show on hover or keyboard focus after 150ms delay.
- Hide immediately on mouse leave or blur.
- Position collision-aware.

## 5. Accessibility Requirements
- Non-intrusive supplementary UI.
- All interactive targets are focusable and readable by screen readers.

## 6. Implementation Notes
- Update `Explore.tsx` top control bar buttons with `<Tooltip>`.
- Update `RecentlyPublished.tsx` load more button with `<Tooltip>`.

## 7. Acceptance Criteria
- [ ] Interactive icon controls in Explore screen have tooltips.
- [ ] Tooltip styling matches global dark specification.
- [ ] Type check and lint pass cleanly.
