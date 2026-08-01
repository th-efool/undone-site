# /message UX — Execute Plan (Nielsen Norman Group 100 Principles)

> **Goal:** Make the message screen production-ready for mobile + desktop without backend changes. All fixes use existing mock data, state hooks, and CSS module architecture.
> 
> **Rule:** Every fix must be scoped to `/message` components only — zero impact on other dashboard pages or website.

---

## How to Read This Document

| Tag | Meaning | Action Required |
|-----|---------|-----------------|
| 🔴 **MUST DO** | Breaks core usability, blocks users | Fix first — blocks all other work |
| 🟠 **ATTENTION** | Major friction, high user frustration | Fix before launch |
| ⚪ **CAUTION** | Quality of life, polish, edge cases | Nice to have if time permits |

Each issue maps to 1+ Nielsen Norman Group principles. Click the checkboxes as you complete them.

---

## BATCH A — LeftSidebar & Navigation (Can Parallelize ✅)

> **Dependencies:** None — standalone sidebar work
> **Estimated files touched:** `LeftSidebar.tsx`, `SidebarFilters.tsx`, `ConversationItem.tsx`, `ConversationList.tsx` + CSS

### 🔴 MUST DO

- [ ] **A1. Add "New DM / Compose" Button in Sidebar** *(Principles #28, #56)*
  - Floating `+` button at bottom-right of LeftSidebar (thumb zone)
  - Opens inline compose modal with searchable user list
  - Currently users have NO way to initiate a new DM from the sidebar — must search in Center panel instead (dead end pattern)

- [ ] **A2. Add "Mark All Read" Action** *(Principle #48)*
  - Subtle text link or icon next to filter chips: "Mark all as read"
  - Clears unread badges on all conversations at once
  - Currently users must tap each conversation individually — no bulk action exists

- [ ] **A3. Add Unread Visual Hierarchy** *(Principle #85)*
  - Unread conversation names → bold weight
  - Unread rows → slightly brighter background tint (`--message-brand-soft` at low opacity)
  - Currently unread/read items look nearly identical — users scan too slowly

- [ ] **A4. Add Pin/Unpin per Conversation** *(Principle #30, #86)*
  - Right-click or long-press → context menu with "Pin" / "Unpin"
  - Pinned conversations float to top of list with 📌 icon
  - Currently pin only exists for community announcements, not personal conversations

### 🟠 ATTENTION

- [ ] **A5. Sidebar Header — Add User Profile Dropdown** *(Principles #28, #41)*
  - Avatar + dropdown in top-right of LeftSidebar header: Profile / Settings / Notifications bell
  - Currently sidebar header only shows logo/title — no account access from message context

- [ ] **A6. Conversation Item — Add "Mute Notifications" Option** *(Principle #76)*
  - Context menu on conversation item → "Mute for 1h / 8h / 24h / Until I read"
  - Muted conversations get a 🤫 icon and don't trigger notifications in mock state

- [ ] **A7. Conversation Item — Add "Clear Search" X Button** *(Principle #48)*
  - If search is active, show `×` next to filter chips to clear immediately
  - Currently no way to quickly dismiss filters without resetting everything

### ⚪ CAUTION

- [ ] **A8. Keyboard Shortcut Hints Tooltip** *(Principle #76)*
  - Small "?" button in sidebar header → tooltip showing: `/` focus composer, `Ctrl+K` search, `Esc` close modals
  - Desktop users have no discoverable shortcuts

---

## BATCH B — Center Panel & Search (Can Parallelize ✅)

> **Dependencies:** None — standalone center work
> **Estimated files touched:** `Center.tsx`, `SearchHeader.tsx`, `LiveNow.tsx`, `RecentMessages.tsx` + CSS

### 🔴 MUST DO

- [ ] **B1. Add Empty State for Search Results** *(Principles #75, #76)*
  - When search returns no results → show `<EmptyState type="search-empty" />` with icon + "Try different keywords"
  - Currently blank white space — users don't know if something broke

- [ ] **B2. Add Empty State for No Live Sessions** *(Principle #76)*
  - When `liveSessions` is empty → show friendly illustration: "No active sessions right now. Check back later!"
  - Currently dead white space in a prominent position

### 🟠 ATTENTION

- [ ] **B3. Fix Search Input Width on Mobile** *(Principle #65)*
  - Make search input `width: 100%; overflow-x: auto;` for long queries without wrapping or truncation
  - Currently fixed max-width truncates long search strings silently

- [ ] **B4. Add "Clear Search" × Button in SearchHeader** *(Principle #48)*
  - Show `×` icon on the right side of input when `query.length > 0`
  - Clicking clears query + closes keyboard focus — no current way to clear quickly

- [ ] **B5. LiveNow Carousel — Add Pause/Resume Control** *(Principle #70)*
  - Small pause ⏸ button appears on hover/touch interaction
  - Auto-scroll pauses when user interacts, resumes after 10s idle (principle #70)

- [ ] **B6. RecentMessages — Show Attachment Type Icons** *(Principle #82)*
  - Add small icon badge for PDF 📎 / Image 🖼 / Video 🎥 on items that have `attachment` or `mediaCount > 0`
  - Currently all messages look identical in the list regardless of content type

- [ ] **B7. LiveNow — Add Visual "More Content" Fade Indicator** *(Principle #6, #7)*
  - Right-edge gradient fade on horizontal scroll to signal more items available
  - Users don't know they can swipe horizontally right now

### ⚪ CAUTION

- [ ] **B8. Channel Tabs Unread Count Badges** *(Principle #82)* — *Also in Batch D but referenced here*
  - Small badge number on each channel tab when unread > 0
  - Users can't tell which channels have new messages at a glance across the entire community

---

## BATCH C — Composer & Messaging UX (Can Parallelize ✅)

> **Dependencies:** None — composer is self-contained but needs callbacks wired from parent components
> **Estimated files touched:** `MessageComposer.tsx`, `DMComposer.tsx`, plus reply/typing indicator components to CREATE, CSS

### 🔴 MUST DO

- [ ] **C1. Wire Up Reply-to-Message Flow** *(Principle #75)*
  - Create new component: `<ReplyPreview messageId={id} sender={name} text={text} onDismiss={() => ...} />`
  - Triggered by tapping a message bubble (desktop) or long-press (mobile)
  - Shows inline banner above composer with the replied content + "↩ Reply to @username"
  - Currently `ReplyPreview.module.css` exists but is NEVER triggered — dead code

- [ ] **C2. Add Typing Indicator Component** *(Principle #59)*
  - Create `<TypingIndicator usernames={string[]} />` with animated dots (⋯) and names
  - Position below composer in chat view, shows when `isTyping` state is true
  - Currently ZERO feedback after sending — users don't know if anyone responded

- [ ] **C3. Fix Mobile Composer Sticky Position** *(Principles #24, #27)*
  - Make `.composer` inside chat main area `position: sticky; bottom: 0` with proper safe-area padding
  - Currently when virtual keyboard opens on phone, composer gets pushed off-screen or clipped

- [ ] **C4. Add Draft Saved Indicator in Composer** *(Principle #59)*
  - Show "Draft saved" text + subtle checkmark (✅) near composer input for 2 seconds after each keystroke debounce
  - Currently drafts are silently persisted to localStorage but users have no visibility — if they navigate away, they don't know draft is safe

### 🟠 ATTENTION

- [ ] **C5. Expand Emoji Picker** *(Principle #80)*
  - Replace hardcoded 12-emoji inline panel with proper categorized emoji picker (grid: faces, symbols, objects, activities)
  - Add search/filter at top of picker
  - Current 12 emojis are not enough for real conversations

- [ ] **C6. Add Quick-Reaction Bar on Long-press / Hover** *(Principle #80)*
  - Long-press (mobile) or hover (desktop) message bubble → floating bar with 🔥 ❤️ 👍 😂 🎉 + "Add reaction" button
  - Currently `ReactionBar` component exists but has NO trigger — completely disconnected

- [ ] **C7. Add Message Send Animation / Success State** *(Principle #59)*
  - Brief animation when message sends: checkmark appears in composer for 1s, or message visually "flies" into timeline
  - Currently input just clears — no confirmation the message went through

### ⚪ CAUTION

- [ ] **C8. Dynamic Composer Placeholder** *(Principle #75)*
  - Change placeholder based on context: CommunityChat → `"Message in #general…"`, DM → `"Say something to @Aarav…"`
  - Currently generic "Type a message..." everywhere

---

## BATCH D — Community Chat View (Can Parallelize ✅)

> **Dependencies:** Batch C reply flow must be wired first (C1), then connect callbacks here
> **Estimated files touched:** `CommunityChat.tsx`, `ChannelTabs.tsx`, `MessageTimeline.tsx`, `PinnedBanner.tsx` + CSS, new components

### 🔴 MUST DO

- [ ] **D1. Add Date Anchors / Sticky Date Dividers in Message Timeline** *(Principles #6, #71)*
  - Create `<DateDivider date="Today" />` component that appears between message groups
  - Sticky on scroll so users always know what day they're viewing
  - Breaks up long conversations into scannable chunks — currently one endless scroll

- [ ] **D2. Add Empty State for Community with No Messages** *(Principle #76)*
  - When `community.messages` is empty → show `<EmptyState type="no-messages" />` with icon + "No messages yet. Say hi!"
  - Currently dead white space in a primary content area

- [ ] **D3. Add Channel Tab Unread Count Badges** *(Principle #82)*
  - Small pill badge on each `ChannelTab` button when unread count > 0 (pull from mock data or compute from messages)
  - Currently no way to see which channels have new messages without entering them

### 🟠 ATTENTION

- [ ] **D4. Add "Mute Channel" Option in Community Info Panel** *(Principle #76)*
  - Inside the existing `CommunitySidebar` / About panel → add "Mute channel" toggle
  - Muted channels don't show unread badges and don't trigger notifications (mock state)

- [ ] **D5. Add Reply Preview on Message Tap/Long-press** *(Same as C1 — connect callback here)*
  - When user taps a `MessageBubble` in timeline → set reply context that shows in composer's `ReplyPreview` banner
  - Pass through: `CommunityChat.onReply = (messageId, sender, text) => { /* show ReplyPreview */ }`

- [ ] **D6. Pinned Announcement — Add "Mark as Read" Action** *(Principle #48)*
  - Small button on pinned banner → dismisses it from view for this session
  - Currently pinned announcements are always visible and can't be cleared

### ⚪ CAUTION

- [ ] **D7. Message Bubble Edit/Delete via Long-press Context Menu** *(Principle #60)*
  - Long-press (mobile) / right-click (desktop) → context menu: Reply, Copy, React, Edit, Delete
  - Edit mode shows inline text area replacing the bubble

---

## BATCH E — DM Conversation View (Can Parallelize ✅)

> **Dependencies:** Batch C reply flow must be wired first (C1)
> **Estimated files touched:** `DMConversation.tsx`, `DMBubble.tsx`, `DMComposer.tsx`, plus new components for typing indicator, context menu

### 🔴 MUST DO

- [ ] **E1. Wire Up Reply-to-Message Flow in DM View** *(Principle #75)*
  - Same as C1/D5 but specific to DMConversation: tap/long-press `DMBubble` → shows inline reply banner above `DMComposer`
  - Reuse the same `ReplyPreview` component from Batch C

- [ ] **E2. Add Empty State for DM with No Messages** *(Principle #76)*
  - When `conversation.messages` is empty → show friendly illustration: "Start a conversation with {name} 👋"
  - Currently dead white space in primary content area

### 🟠 ATTENTION

- [ ] **E3. Add Message Edit/Delete Context Menu for DMs** *(Principle #60)*
  - Same as D7 but DM-specific: long-press/right-click message → Reply, Copy, React, Delete (no edit needed since it's personal)

---

## BATCH F — Mobile-Specific Fixes (Must Run After Batches A-E)

> **Dependencies:** All batches above must complete first. This batch fixes mobile layout issues discovered across all components.
> **Estimated files touched:** All message CSS modules + `SocialLanding.tsx`

### 🔴 MUST DO

- [ ] **F1. Fix Mobile Composer Sticky Above Keyboard** *(Principles #24, #27)*
  - Ensure `.composer` inside chat main area uses `position: sticky; bottom: 0` with `padding-bottom: env(safe-area-inset-bottom)` 
  - Works across both CommunityChat and DMConversation

- [ ] **F2. Add "Back" Button to Mobile Channel/DM Views** *(Principles #28, #34)*
  - LeftSidebar mobile view needs a clear back arrow when in community chat or DM conversation view
  - Currently the back button only exists inside CommunityHeader — missing for DM flow on mobile

- [ ] **F3. Expand Emoji Picker Touch Targets to Full Bottom Sheet** *(Principle #21, #22)*
  - On mobile, emoji picker should become a bottom sheet (slides up from bottom) with larger targets (48px+)
  - Current 80px grid is impossible to tap precisely on narrow screens

### 🟠 ATTENTION

- [ ] **F4. Mobile Channel Tabs — Add Visual "More Content" Gradient** *(Principle #7)*
  - Right-edge gradient fade on horizontal scroll of channel tabs strip
  - Users don't know there are more channels beyond the visible area

- [ ] **F5. Fix Sidebar Conversation Text Truncation on Narrow Screens** *(Principle #23, #89)*
  - Ensure `text-overflow: ellipsis` + adequate line-height on all conversation item text
  - Very narrow screens (360px) can cause text wrapping that looks broken

---

## BATCH G — Desktop-Specific Fixes (Can Parallelize ✅)

> **Dependencies:** None standalone, but benefits from other batches being done first for visual consistency
> **Estimated files touched:** `SocialLanding.module.css`, `LeftSidebar.module.css`, `Center.module.css`

### 🔴 MUST DO

- [ ] **G1. Add Split-View Drawer for Community Chat on Desktop** *(Principle #4)*
  - Click community in sidebar → opens chat as overlay/drawer on right instead of replacing Center panel
  - Users can browse conversation list AND read messages simultaneously (no dead end)

### 🟠 ATTENTION

- [ ] **G2. Reduce RightSidebar Visual Weight** *(Principle #82)*
  - Make right sidebar feel secondary: lighter background, thinner borders, smaller text
  - Currently takes equal visual prominence as Center panel which confuses hierarchy

---

## 📋 Execution Order & Dependencies

```
Phase 1 (Foundation — No dependencies):
  → Batch A (LeftSidebar)    ← START HERE
  → Batch B (Center Panel)   ← can run in parallel with A
  → Batch C (Composer + UX)  ← can run in parallel with A, B

Phase 2 (Connect callbacks from Phase 1):
  → Batch D (Community Chat)  ← needs C1 done first
  → Batch E (DM Conversation) ← needs C1 done first

Phase 3 (Mobile polish after all above):
  → Batch F (Mobile-specific) ← needs A-E complete

Phase 4 (Desktop polish):
  → Batch G (Desktop-specific)← can run anytime but looks best after A-E
```

---

## ⚠️ Cross-Cutting Rules for ALL Batches

1. **No backend changes** — all features work with existing `useMessage()` hook, mock data, and localStorage persistence
2. **CSS isolation** — use `[data-platform="app"]` selectors only where app-specific; keep web-safe defaults in `@media (max-width: 768px)` blocks
3. **Touch targets** — every interactive element must be ≥ 44×44px on mobile (principle #21)
4. **No breaking changes** — all existing functionality must continue working exactly as before
5. **Mock data compatibility** — new features should gracefully degrade if mock data doesn't include new fields
6. **Component naming** — use `ReplyPreview`, `TypingIndicator`, `EmptyState`, `ContextMenu` patterns that match existing codebase conventions

---

## 📝 Files Created vs Modified

| File | Status | Purpose |
|------|--------|---------|
| `ReplyPreview.tsx/.css` | **CREATE** | Inline reply banner above composer |
| `TypingIndicator.tsx/.css` | **CREATE** | Animated "X is typing..." component |
| `EmptyState/index.tsx` | **MODIFY** | Add new type variants: `search-empty`, `no-messages`, `no-live-sessions` |
| `ContextMenu.tsx` (shared) | **CREATE** | Reusable context menu for message actions + conversation pin/mute |
| All message CSS modules | **MODIFY** | Mobile touch targets, sticky composer, visual hierarchy updates |
| `useMessage.ts` hook | **MODIFY** | Add `isTyping`, `replyContext`, `pinnedConversations`, `mutedChannels` state fields |

---

## ✅ Verification Checklist (Run After All Batches)

- [ ] Every conversation list item is ≥ 48px tall (touch target)
- [ ] Composer input font-size is 16px on mobile (prevents iOS auto-zoom)
- [ ] No horizontal overflow at 360px viewport width
- [ ] Reply-to-message shows correct sender name + preview text
- [ ] Typing indicator appears and animates smoothly
- [ ] Empty states display correctly for all empty conditions
- [ ] Mark-all-read clears all unread badges simultaneously
- [ ] Pin conversation moves it to top of sidebar list
- [ ] Desktop split-view drawer opens without breaking layout
- [ ] Emoji picker has ≥ 48px targets on mobile
- [ ] Draft indicator appears within 0.1s (principle #59)
- [ ] All new components use existing design tokens from `tokens.css`
