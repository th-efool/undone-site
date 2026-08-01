# Responsive Mobile Implementation Tasks

## Phase 1: Foundation
- [x] `tokens.css` — Add mobile tokens
- [x] `globals.css` — Add global mobile rules
- [x] `typography.css` — Add mobile type scale
- [x] `forms.css` — Add mobile input rules
- [x] `accessibility.css` — Add touch rules
- [x] `useIsMobile.ts` — Create hook

## Phase 2: Navigation & Shell
- [x] `SidebarItem.tsx` + `.module.css` — Add labels, mobile styles
- [x] `Sidebar.tsx` + `.module.css` — Play page hide, keyboard hide, safe area
- [x] `DashboardShell.module.css` — Enhance mobile padding

## Phase 3: Simple Pages
- [x] Auth screen CSS files
- [x] Home screen CSS files
- [x] Explore screen CSS files

## Phase 4: Medium Complexity
- [x] Cohort detail pages
- [x] Create Cohort wizard (all CSS files now have 768px rules)

## Phase 5: Complex Pane-Switching
- [x] Notes screen (CSS + TSX) — Mobile view switching via useIsMobile
- [x] Messages screen (CSS + TSX) — SocialLanding handles mobile view switching, all CSS files now have 768px rules

## Phase 6: Play Screen
- [x] Play.tsx — orientation lock, touch swipe
- [x] Play.module.css + sub-components

## Phase 7: Landing & Shared UI
- [x] Landing page CSS files
- [x] Shared UI components (Button, SearchBar, PillInput, HorizontalScroller, Logo)

## Phase 8: Build Verification
- [x] `npm run build` passes ✓
- [x] All screen CSS modules have @media (max-width: 768px) rules — verified across ALL directories
- [x] Fixed CSS Module pure selector errors (bare element selectors scoped under local classes)
- [x] Fixed CapacitorBridge TypeScript type errors
