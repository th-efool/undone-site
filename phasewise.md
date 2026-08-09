# Agent Execution Workflow

## Phase 1: Restore Page Architecture
**Agent:** `cavecrew-builder`
**Skills:** `impeccable`
**Task:** 
- Undo 3-column page layout. 
- Restore `<NotesSidebar />` and `<ExistingCanvas />` as siblings at the page level. 
- Ensure Canvas is NOT inside sidebar.

## Phase 2: Split Sidebar Internally
**Agent:** `cavecrew-builder`
**Skills:** `impeccable`
**Task:** 
- Expand `<NotesSidebar />` width.
- Create 2 internal columns inside it: `SidebarNavigationColumn` and `SidebarWorkspaceColumn`.
- Canvas remains untouched sibling.

## Phase 3: Verify & Inject Global Calendar
**Agent:** `cavecrew-investigator` -> `cavecrew-builder`
**Skills:** `impeccable`
**Task:** 
- Locate `src/client/components/ui/Calendar/Calendar.tsx`.
- Verify it matches exact look of landing page / messages. Modify if needed.
- Inject into `SidebarWorkspaceColumn`.

## Phase 4: Populate UI
**Agent:** `cavecrew-builder`
**Skills:** `impeccable`, `sub-agent-orchestrator`
**Task:** 
- Add Space Header, Tasks, and Workspace to `SidebarWorkspaceColumn`.
- Add Channels and Navigation to `SidebarNavigationColumn`.
