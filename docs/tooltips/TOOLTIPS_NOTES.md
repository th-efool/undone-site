# Tooltip Implementation Specification: Notes Page

## 1. Page Identification
- **Page Name**: Notes Workspace
- **Route**: `/notes`
- **Source Files**:
  - Main Page: [`src/client/components/screens/dashboard/notes/Notes.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/notes/Notes.tsx)
  - Components:
    - [`NotesComponents.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/notes/components/NotesComponents.tsx)

## 2. Tooltip Inventory

| Target Element | Current Purpose | Tooltip Text | Why Useful | Trigger | Placement | Icon Only | Keyboard Focus | Accessibility Notes |
|---|---|---|---|---|---|---|---|---|
| New Notebook Button | Creates a new notebook container | "New notebook" | Identifies icon-only `Plus` button | Hover + Focus | Top | Yes | Yes | `aria-label="New notebook"` |
| New Note Button | Creates a new note inside current notebook | "New note" | Identifies icon-only `Folder` button | Hover + Focus | Top | Yes | Yes | `aria-label="New note"` |
| Format: Bold Button | Formats selected text as bold | "Bold (⌘B)" | Explains bold shortcut & action | Hover + Focus | Top | Yes | Yes | `aria-label="Bold"` |
| Format: Italic Button | Formats selected text as italic | "Italic (⌘I)" | Explains italic shortcut & action | Hover + Focus | Top | Yes | Yes | `aria-label="Italic"` |
| Format: Underline Button | Underlines selected text | "Underline" | Explains underline action | Hover + Focus | Top | Yes | Yes | `aria-label="Underline"` |
| Format: Code Button | Converts text to code block | "Code block" | Explains code formatting | Hover + Focus | Top | Yes | Yes | `aria-label="Code block"` |
| Format: Bullet List | Inserts bulleted list | "Bullet list (⌘Shift 8)" | Explains bullet list shortcut | Hover + Focus | Top | Yes | Yes | `aria-label="Bullet list"` |
| Format: Numbered List | Inserts numbered list | "Numbered list (⌘Shift 7)" | Explains numbered list shortcut | Hover + Focus | Top | Yes | Yes | `aria-label="Numbered list"` |
| Format: Checklist Button | Inserts interactive task checkbox | "Checklist" | Explains task checkbox insertion | Hover + Focus | Top | Yes | Yes | `aria-label="Checklist"` |
| Format: Link Button | Prompts to insert URL link | "Insert link (⌘K)" | Explains hyperlink shortcut | Hover + Focus | Top | Yes | Yes | `aria-label="Insert link"` |
| Bottom Bar Tools (Select, Text, Copy, Link, Check, Search, More) | Canvas tools | "Select", "Text box", "Duplicate", "Link card", "Task card", "Find", "More tools" | Identifies icon-only canvas tools | Hover + Focus | Top | Yes | Yes | `aria-label` per tool button |
| More Options Button (`MoreHorizontal`) | Opens workspace dropdown menu | "More options" | Identifies icon button | Hover + Focus | Top | Yes | Yes | `aria-label="More options"` |
| Present Button | Enters presentation mode | "Present note" | Clarifies presentation mode | Hover + Focus | Bottom | No | Yes | Preserves button label |

## 3. Visual Requirements
- Compact dark tooltip (`var(--gray-950)` / `#09090b`), white text, `var(--radius-md)` rounded corners, compact padding (`5px 9px`), subtle shadow (`0 4px 14px rgba(0,0,0,0.3)`).
- Placed directly above/below target controls.

## 4. Interaction Requirements
- Show on hover or keyboard focus after 150ms delay.
- Hide on mouse leave / blur.
- Non-blocking layout.

## 5. Accessibility Requirements
- Full keyboard focus support.
- Underlying buttons retain `aria-label`.

## 6. Implementation Notes
- Modify `Notes.tsx` toolbar, formatting buttons, and bottom tool buttons to wrap with `<Tooltip>`.

## 7. Acceptance Criteria
- [ ] All icon-only editor and canvas buttons have dark tooltips.
- [ ] Keyboard shortcuts are clearly shown in formatting tooltips.
- [ ] Type check and lint pass cleanly.
