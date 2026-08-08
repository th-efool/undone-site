# Tooltip Implementation Specification: Messages Page

## 1. Page Identification
- **Page Name**: Messages & Social Dashboard
- **Route**: `/message`
- **Source Files**:
  - Main Page: [`src/client/components/screens/dashboard/message/Message.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/message/Message.tsx)
  - Components:
    - [`LeftSidebar.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/message/components/LeftSidebar/LeftSidebar.tsx)
    - [`SidebarHeader.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/message/components/LeftSidebar/SidebarHeader/SidebarHeader.tsx)
    - [`MessageComposer.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/message/components/MessageComposer/MessageComposer.tsx)
    - [`CommunityChat.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/message/components/CommunityChat/CommunityChat.tsx)
    - [`DMConversation.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/screens/dashboard/message/components/DMConversation/DMConversation.tsx)

## 2. Tooltip Inventory

| Target Element | Current Purpose | Tooltip Text | Why Useful | Trigger | Placement | Icon Only | Keyboard Focus | Accessibility Notes |
|---|---|---|---|---|---|---|---|---|
| Sidebar Home Button | Returns to social landing view | "Social Home" | Identifies home icon button | Hover + Focus | Top | Yes | Yes | `aria-label="Social Home"` |
| Mark All Read Button | Marks all messages as read | "Mark all as read" | Identifies icon action | Hover + Focus | Top | Yes | Yes | `aria-label="Mark all as read"` |
| Attachment Button | Opens attachment picker | "Attach file or image" | Explains paperclip icon action | Hover + Focus | Top | Yes | Yes | `aria-label="Attach file"` |
| Emoji Picker Button | Opens emoji selector | "Add emoji" | Explains smile icon action | Hover + Focus | Top | Yes | Yes | `aria-label="Add emoji"` |
| Voice Message Button | Records audio message | "Record voice message" | Explains microphone icon action | Hover + Focus | Top | Yes | Yes | `aria-label="Record voice message"` |
| Send Message Button | Sends current message draft | "Send message" | Confirms send action | Hover + Focus | Top | Yes | Yes | `aria-label="Send message"` |
| Chat Back Button | Returns to conversation list on mobile/tablet | "Back to messages" | Explains arrow back action | Hover + Focus | Right | Yes | Yes | `aria-label="Back to messages"` |

## 3. Visual Requirements
- Dark surface (`var(--gray-950)` / `#09090b`), white text, `var(--radius-md)` rounded corners, compact padding (`5px 9px`), subtle shadow (`0 4px 14px rgba(0,0,0,0.3)`).
- Natural adjacent placement with 6px gap.

## 4. Interaction Requirements
- Show on hover or keyboard focus after 150ms delay.
- Hide immediately on mouse leave / blur.

## 5. Accessibility Requirements
- Keyboard focusable controls.
- `role="tooltip"` semantics.

## 6. Implementation Notes
- Modify `SidebarHeader.tsx`, `MessageComposer.tsx`, `CommunityChat.tsx`, and `DMConversation.tsx` to wrap icon buttons in `<Tooltip>`.

## 7. Acceptance Criteria
- [ ] All message composer and sidebar header icon buttons have dark tooltips.
- [ ] Type check and lint pass cleanly.
