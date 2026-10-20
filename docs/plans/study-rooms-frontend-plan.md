# Study Rooms — Frontend Implementation Plan

> **Audience:** a coding model that will implement this plan with no further product input.
> **Scope:** frontend only. No API routes, server actions, Prisma/DB changes, auth changes, Centrifugo/WebSockets, new paid integrations, or new npm packages.
> **Status:** plan only — nothing in this document has been implemented.
> **Conventions you must follow:** `AGENTS.md` (plan-first; keep `MEMORY/` current), CSS Modules + design tokens in `src/app/styles/tokens.css`, `lucide-react` icons, `@/src/...` import alias.

Every path below is repository-relative. `R` is shorthand for `src/client/screens/dashboard/studyroom` and is used only in this document, never in code.

Statements are tagged **[verified]** (read in the repository during planning), **[assumption]** (not provable from the repo; the safest minimal choice was made), or **[decision]** (a product/architecture decision made by this plan that you must not revisit).

---

## Table of contents

1. Product specification
2. Repository audit
3. Screen and layout architecture
4. Detailed interaction specifications
5. Component architecture
6. File-by-file implementation plan (stages)
7. Asset and dependency requirements
8. Edge cases
9. Acceptance tests
10. Future Centrifugo boundary
11. Execution checklist

---

## 1. Product specification

### 1.1 Concept

A Study Room is a **shared, curated focus environment**. A room is a place — a cozy library, a fireplace, a developer den — that has a look and a sound. People drop in to study quietly next to each other.

**Fundamental rule [decision]:** the room's admin/creator controls the environment **for everyone**. Members do not customize their own version of it. A member enters, sees who else is studying, sets up their own work session, and focuses.

### 1.2 Two state categories (never mix them)

| | **Shared room configuration** | **Personal session state** |
|---|---|---|
| Owner | The room's admin/creator | Each participant, for themselves only |
| Contents | Background; shared music source (YouTube/Spotify); ambient sound preset, its volume and play/pause; any other room-wide setting | Pomodoro timer and its durations; task list; session goal; goal visibility (private / visible to room) |
| Who can change it | Admin/creator only | Only the owning participant |
| Who sees it | Everyone in the room sees the same values | Only the owner — except a **public** goal, which appears beside the owner in the participant panel |
| Frontend model | One `SharedRoomEnvironment` object (§5.2) | `PomodoroState`, `PersonalTask[]`, `SessionGoal` (§5.2) |
| Code home | `useSharedEnvironment` | `usePomodoro`, `usePersonalTasks`, `useSessionGoal` |

Hard rules that follow from this:

1. No component rendered for a non-admin may receive an environment *mutation* callback. Members get read-only props. This is enforced structurally (§5.3), not by hiding buttons with CSS.
2. Personal state never flows into shared state. The only personal→public bridge is a goal whose visibility is `'room'`.
3. A private goal text must never be placed in any participant-facing data structure (§4.7).
4. A timer starting for one person never affects another person's timer.

### 1.3 The single permitted member-side audio control

A browser can block audio, and some people need quiet on their own device. Members (and admins) therefore get **"Mute room sound for me"** — a device-local listening toggle. It does **not** change the room's environment, is not visible to anyone else, and is not persisted. It is not a selector for sound, volume, playlist or background. **[decision]**

### 1.4 User journey

1. User opens `/studyroom` → **Room discovery**: three room cards (Library, Fireplace, Developer Den) with preview image, name, atmosphere, and a demo participant count.
2. User chooses **Enter room** → navigates to `/studyroom/<slug>` → **In-room screen**. The room's shared environment (background + ambience + optional music) is already applied.
3. In the room the user sees the environment full-bleed, the room name, who is studying (count + avatars), a compact personal timer, and a toolbar. They can open: **My session** (goal + tasks), **People** (participants), **Room** (admin: customize environment; member: read-only room info + mute-for-me), **Timer settings**.
4. The user sets a goal (private by default), adds tasks, starts their Pomodoro, and focuses.
5. **Leave** returns to `/studyroom`. Personal state (timer, tasks, goal) is discarded — it is a session (§8.12). If any personal state exists, a confirmation dialog appears first.

### 1.5 Admin vs member — what each sees

The prototype has **mock** roles (no real authorization). The viewer's role is derived from mock data (§6 Stage 1, `RoomDefinition.adminUserId`) and may be forced with a `?viewAs=admin|member` query string for review. See §3.7 for the exact visibility matrix.

### 1.6 Non-goals (do not build)

Centrifugo / WebSocket / polling presence; cross-user timer or playback sync; server persistence of anything; real permissions; chat; voice/video; OAuth or API keys for YouTube/Spotify; creating/deleting rooms; reading/writing the DB; touching `/api/studyroom`.

---

## 2. Repository audit

### 2.1 What exists today (verified)

**Route.** `src/app/(dashboard)/studyroom/page.tsx` renders `<main><StudyRoomScreen /></main>` with metadata `title: 'Study Rooms'` and a description containing "Join virtual study rooms". `src/app/(dashboard)/studyroom/loading.tsx` renders the *same* `StudyRoomScreen` (deliberately — a test forbids fake skeletons). `src/middleware.ts` already protects `/studyroom/:path*` (auth redirect), so a nested `/studyroom/[roomSlug]` route is covered with **no middleware change**. `src/app/robots.ts` already disallows `/studyroom/`. The route is **not** in the sidebar (`src/client/components/global/Sidebar/sidebar.data.ts` lists Play/Home/Explore/Messages/Notes); it is linked from `src/client/components/global/Footer/Footer.tsx` (`href: '/studyroom'`) and reachable by URL.

**Screen.** `R/StudyRoomScreen.tsx` (431 lines, `'use client'`) is a single page, **not** an in-room experience:
- Title "Focus Cohorts & Study Rooms", a "LIVE WORKSPACE" pill.
- Hard-coded `DEFAULT_ROOMS` (Fireplace, Library, Developer Den) with `thumbnail: '/rooms/*.jpg'`. **`public/rooms/` does not exist** — those thumbnails are dead paths. [verified: `Test-Path public/rooms` → False]
- **Real** data layer: `GET /api/studyroom` polling every 10 s (hidden-tab pause, `ETag`/`If-None-Match`/304), optimistic join/leave via `POST /api/studyroom {action:'join'|'leave'}` with rollback.
- **Simulated** behavior: a 24 s `setInterval` that fabricates toasts ("PixelCoder completed a 25m focus sprint…") from random names/rooms. This is fake presence and violates the "no fabricated joins/events" rule.
- Join requires `useSession()`; unauthenticated users get an alert toast.
- Icons/gradients chosen by room-title string matching.
- Toast stack with `framer-motion` (`m`, `AnimatePresence`; `LazyMotion` is provided by `src/client/providers/MotionProvider.tsx`).
- Source text contains mojibake emoji in toasts when printed in a Windows terminal (`�YZ%`, `�o�`). It may be a terminal artifact; either way **do not copy those strings** — use plain text, no emoji.

**Room card.** `R/components/RoomCard.tsx` renders icon + gradient (no preview image), title, atmosphere text chosen by `room.title === ...`, avatar stack with `https://api.dicebear.com/7.x/initials/svg?...` plain `<img>` (external dependency; not needed), and Join/Leave buttons. Exports types `Room` and `Participant` (DB-shaped: `user.{id,name,image,username}`; **no `joinedAt`**, though the API response includes it).

**Timer.** `R/components/FocusTimerCard.tsx` is a working single-phase countdown: presets Hyperfocus 50 / Deep Work 25 / Short Break 5 / Long Break 15, start/pause/reset, SVG ring (circumference 282.6), a Web Audio synthesized chime (C-major chord, no asset), mute toggle. Limitations: decrementing `setInterval` (drifts when the tab is throttled), no automatic phase transitions, no long-break cadence, no session counting, no custom durations, `AudioContext` created per chime and never closed. It is **not** a Pomodoro cycle.

**Styles.** `R/StudyRoomScreen.module.css` (665 lines) holds all styles for the old screen: dark-theme literals (`color:#f3f4f6`), `.container` max-width 1280, `.grid`, room cards, timer card, toasts. Breakpoints used: 640 and 1024.

**Theming bug (verified, likely visible).** `src/client/config/routeThemeConfig.ts` lists `/play`, `/explore`, `/message`, `/notes`, `/create-cohort` as `'dark'`; **`/studyroom` is absent → `'light'`** → `DashboardShell` uses `var(--color-background)` (#fff) while the screen CSS uses near-white text (`#f3f4f6`). This is visually unverified (no authenticated run was performed during planning) but follows directly from the code. Fix: add `'/studyroom': 'dark'` (Stage 6).

**Data model.** `docs/study-rooms-schema.md` + Prisma: `StudyRoom {id,title,thumbnail,status,onlineCount,createdAt,updatedAt}` and `RoomParticipant {id,userId @unique,studyRoomId,joinedAt}`. There is **no** admin/creator field, **no** environment fields (background/music/ambience), **no** goal field. `src/app/api/studyroom/route.ts` serves GET (rooms+participants+user, 5 s in-memory cache, ETag) and POST join/leave (transaction; one room per user). `src/server/infrastructure/db/postgres/repositories/studyRoom.repo.ts` seeds rooms with `/rooms/*.jpg` thumbnails. **These are the future backend boundary; do not touch them.**

**Other consumers of study-room-ish UI (leave alone).** `src/client/components/global/StudyRooms/*` (home dashboard strip; links to `/message`), `src/client/screens/dashboard/explore/components/StudyRooms/*`, `src/client/screens/auth/authShowcase/authData.ts` (`STUDY_ROOMS` marketing data), `src/client/screens/dashboard/message/mock/message.mock.ts` (uses `/images/studyrooms/*.webp`).

**Shell constraints (verified).**
- `src/client/components/global/DashboardShell/DashboardShell.tsx`: desktop `Sidebar` (sticky, 64 px wide, 100vh) + content; **mobile (≤768 px, via `src/client/hooks/useExperience.ts`, or any Capacitor native app) swaps to `MobileNav`** (fixed bottom bar; `--bottom-nav-height: 56px`, `--safe-area-bottom`) and `.content` gets matching bottom padding.
- `src/app/layout.tsx` wraps everything in `SessionProvider` (so `useSession()` works) and the title template is `'Undone > %s'`.
- `next.config.ts` sets **no CSP / frame-src** (headers: DNS-prefetch, nosniff, referrer-policy only) → YouTube/Spotify iframes are not blocked by the app. `images.remotePatterns` allows only `i.ytimg.com`, `yt3.ggpht.com`, `images.unsplash.com`, `unsplash.com` (irrelevant: all room imagery is local).

**Tests that touch this feature (verified).**
- `R/__tests__/StudyRoomScreen.test.tsx` — 5 tests, all about optimistic join/leave, rollback, polling pause, ETag/304. **Will be obsolete** (Stage 10 rewrites).
- `src/app/(dashboard)/studyroom/__tests__/studyRoomLoading.test.tsx` — asserts text "Focus Cohorts & Study Rooms", "Active Spaces", "Timer Widget", three room titles, "LIVE WORKSPACE", `livePulse` class, "1 Active", `getByTitle('Alice')`, and no `skeleton|shimmer` classes. **Will need rewriting.**
- `src/app/(dashboard)/studyroom/__tests__/page.test.tsx` — asserts metadata title `'Study Rooms'`, description contains `Join virtual study rooms`, renders `<main>` and the text "Focus Cohorts & Study Rooms". **Metadata assertions must keep passing; heading assertion must be updated.**
- `src/app/__tests__/tab-titles.test.ts` expects `studyroom/page` metadata → `'Undone > Study Rooms'`. **Keep `metadata.title === 'Study Rooms'` unchanged.**
- `src/app/api/studyroom/__tests__/route.test.ts` — API tests; untouched.

**Assets (verified, `public/images/studyrooms/`).** Seven WebP illustrations (flat-vector, warm style): `library.webp` (domed reading hall, 785×981-ish portrait), `fireplace.webp` (hearth, tea, books), `seaside.webp` (Amalfi-style coast), `campside.webp` (tent in sunlit forest), `canal.webp` (Amsterdam canal), `ruins.webp` (mossy temple), `shrine.webp` (garden gazebo). All are **portrait or near-square**, 40–100 KB. **No audio files exist anywhere** (`public/` has none) and **no video/GIF backgrounds**. Fonts: Manrope (500/600/700) and Caveat (700) via `src/app/styles/tokens.css`.

**Dependencies available (verified `package.json`):** `react 19.2.4`, `next 16.2.11`, `lucide-react 1.28.0` (all icons used in this plan confirmed present), `framer-motion ^13`, `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`, `clsx`, `vitest`, `@testing-library/react`. **No new packages are needed.**

**Not verifiable without a running authenticated app:** actual rendering of the current page in the light shell; real browser audio behavior. The plan states manual checks for these in §9.

### 2.2 What works today vs. what is mock

| Capability | Status |
|---|---|
| Room list from DB + 10 s polling | **Real**, works, will be **detached** from the UI (see §2.3 decision) |
| Join/leave via `POST /api/studyroom` with optimistic UI | **Real**, works; will be detached |
| Participant avatars | Real data from API (no joinedAt in client type) |
| Activity toasts | **Simulated** (random) → delete |
| Room thumbnails | **Broken paths** (`/rooms/*.jpg`) → replace with `/images/studyrooms/*.webp` or gradient |
| Timer | Real client-side single countdown; not a Pomodoro |
| In-room screen, backgrounds, music, ambience, tasks, goals, admin controls, elapsed time | **Do not exist** |

### 2.3 Decision: detach the discovery page from `/api/studyroom` **[decision]**

The room environment, admin role, goals and per-user join time cannot come from the current DB/API (§2.1 Data model). To keep one coherent mock-driven prototype — and to satisfy "no fabricated presence" — the new UI is driven by `ROOM_CATALOG` + `MOCK_ROSTERS` (§6 Stage 1), **not** by `fetch('/api/studyroom')`. The existing API, repo, schema and its tests stay untouched and keep working for the future. The old polling/optimistic code is deleted from the screen (it remains in git history; Section 10 lists it as the re-integration point). Rationale: mixing DB participants (cuid room ids, no join order guarantees, no goals) with catalog rooms (slug ids) would require a title-matching hack that already exists in the old screen (`handleJoinRoom` matching `default-*`); we will not carry that forward.

### 2.4 File inventory and actions

| Path | Class | Action |
|---|---|---|
| `src/app/(dashboard)/studyroom/page.tsx` | **Leave untouched** | Still renders `StudyRoomScreen` (now discovery). Metadata unchanged. |
| `src/app/(dashboard)/studyroom/loading.tsx` | **Leave untouched** | Renders discovery screen, which is now static/instant. |
| `src/app/(dashboard)/studyroom/[roomSlug]/page.tsx` | **New** | Server page; validates slug; renders `RoomScreen`. |
| `src/app/(dashboard)/studyroom/[roomSlug]/loading.tsx` | **New** | **Required**: the parent `loading.tsx` would otherwise flash the discovery screen during room navigation. Neutral dark stage. |
| `R/StudyRoomScreen.tsx` | **Replace (rewrite in place)** | Becomes room discovery only. Delete polling, API calls, optimistic join/leave, simulated toasts, toast stack, session usage. |
| `R/StudyRoomScreen.module.css` | **Replace (rewrite in place)** | Discovery styles only (delete timer/feed/toast rules). |
| `R/components/RoomCard.tsx` | **Modify (rewrite in place)** | Becomes the discovery card (preview image, name, atmosphere, demo count, `Link` to the room). Drop `Room`/`Participant` DB types and dicebear. |
| `R/components/FocusTimerCard.tsx` | **Replace** | Delete after `FocusBar` + `usePomodoro` exist. Chime logic is **extracted** to `R/utils/chime.ts`. |
| `R/index.ts` | **Leave untouched** | `export { default }` + `export *` from `StudyRoomScreen` still valid. |
| `R/__tests__/StudyRoomScreen.test.tsx` | **Replace** | Rewrite for discovery behavior. |
| `src/app/(dashboard)/studyroom/__tests__/studyRoomLoading.test.tsx` | **Modify** | Update strings/assertions; keep the no-skeleton guard. |
| `src/app/(dashboard)/studyroom/__tests__/page.test.tsx` | **Modify** | Keep metadata assertions; update heading assertion; remove fetch mock reliance. |
| `src/client/config/routeThemeConfig.ts` | **Modify** | Add `'/studyroom': 'dark'`. |
| `src/app/api/studyroom/route.ts` (+ its test) | **Leave untouched** | Future backend boundary. |
| `src/server/infrastructure/db/postgres/repositories/studyRoom.repo.ts` | **Leave untouched** | Seeds `/rooms/*.jpg` (dead paths) — **known inconsistency, out of scope**; note in MEMORY. |
| `docs/study-rooms-schema.md`, Prisma schema | **Leave untouched** | |
| `src/client/components/global/StudyRooms/*`, `.../explore/components/StudyRooms/*`, `authShowcase/authData.ts`, `message/mock/message.mock.ts` | **Leave untouched** | Different features/marketing mocks. |
| `src/client/components/global/Sidebar/sidebar.data.ts`, `MobileNav` | **Leave untouched** | Adding a nav entry is a product call not made here. |
| `src/middleware.ts`, `src/app/robots.ts`, `next.config.ts`, `package.json` | **Leave untouched** | Already sufficient. |
| `public/images/studyrooms/*.webp` | **Reuse** | Library, Fireplace, Forest (campside), Seaside backgrounds + discovery previews. `canal/ruins/shrine` remain unused by this feature (still used by `message.mock.ts`). |
| `src/app/styles/tokens.css` | **Reuse (read-only)** | Use `--space-*`, `--radius-*`, `--bottom-nav-height`, `--safe-area-bottom`, brand tokens. Do **not** add tokens; room-local glass values live in the room CSS modules. |
| `src/client/providers/MotionProvider.tsx` | **Reuse** | `m` components allowed. Prefer CSS transitions; framer only for panel enter/exit if needed. |
| New files under `R/…` (types, data, utils, hooks, room components) | **New** | §5, §6. |
| `MEMORY/study-rooms.md`, `MEMORY/README.md` | **New / Modify (in Stage 12 only)** | Required by `AGENTS.md` since a cross-cutting entry point changes. |

---

## 3. Screen and layout architecture

### 3.1 Routes

| URL | File | Renders |
|---|---|---|
| `/studyroom` | `src/app/(dashboard)/studyroom/page.tsx` (unchanged) | `StudyRoomScreen` = discovery |
| `/studyroom/library`, `/studyroom/fireplace`, `/studyroom/developer-den` | `src/app/(dashboard)/studyroom/[roomSlug]/page.tsx` (new) | `RoomScreen` |
| `/studyroom/<unknown>` | same page | `notFound()` |

`[roomSlug]/page.tsx` (server component, Next 16 async params):

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import RoomScreen from '@/src/client/screens/dashboard/studyroom/room/RoomScreen';
import { getRoomBySlug } from '@/src/client/screens/dashboard/studyroom/data/roomCatalog';

export const metadata: Metadata = {
  title: 'Study Room',
  description: 'A shared focus room on Undone.',
};

export default async function StudyRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomSlug: string }>;
  searchParams: Promise<{ viewAs?: string | string[] }>;
}) {
  const { roomSlug } = await params;
  const room = getRoomBySlug(roomSlug);
  if (!room) notFound();
  const { viewAs } = await searchParams;
  const override = viewAs === 'admin' || viewAs === 'member' ? viewAs : undefined;
  return (
    <main>
      <RoomScreen roomSlug={room.slug} viewAsOverride={override} />
    </main>
  );
}
```

(`getRoomBySlug` is a pure function over a static array, safe to import from a server component; the data files must therefore **not** have `'use client'`.)

The `?viewAs=` override is **prototype-only**; Section 10 lists it for deletion when real roles exist.

### 3.2 Discovery screen (`/studyroom`)

Minimal. No dashboard chrome.

- Container: centered, `max-width: 1120px`, `padding: var(--space-10) var(--page-padding)`.
- Header: `<h1>Study Rooms</h1>` and one line "Shared rooms for quiet, focused company. Pick one and settle in." (No LIVE pill, no gradient text, no feed card, no timer card.)
- Grid of room cards: `display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-6)`. Three cards today.
- **Room card** (`RoomCard`): 4:5 `aspect-ratio` preview. Preview = `next/image` (`fill`, `sizes="(max-width: 768px) 100vw, 360px"`, `object-fit: cover`) over a CSS-gradient base (so a missing/failed image still shows the room's palette). Bottom scrim with: room name (h2), atmosphere line, and `● N studying now · demo` (count from `MOCK_ROSTERS[slug].length`; **the word "demo" is mandatory** so nobody mistakes it for live presence), plus up to 3 stacked `ParticipantAvatar`s. The whole card is one link target ("stretched link" via `::after` on the `Enter room` `<Link>`); no nested interactive elements.
- Primary action text: **"Enter room"** (`<Link href="/studyroom/{slug}" prefetch={false}>`).
- Hover/focus: image scale 1.03 (disabled under `prefers-reduced-motion`), visible 2 px focus ring using `--color-brand`.
- No "Leave" on discovery — leaving happens in the room. The old "YOU ARE HERE" state is removed (a user is never on discovery while "in" a room).
- Empty state: if `ROOM_CATALOG` is empty (cannot happen today), render "No rooms available yet." (kept for forward compat).
- Dark theme (via route theme config); text colors from tokens (`--color-text`, `--color-text-secondary`).

### 3.3 In-room screen — common structure

`RoomScreen` renders one **stage** (`<section class="stage">`, `position:relative; isolation:isolate; overflow:clip; min-height:100dvh`; mobile: `min-height: calc(100dvh - var(--bottom-nav-height) - var(--safe-area-bottom))` — mirrors `DashboardShell.module.css`). Layers, back to front:

1. `RoomBackground` — shared background (gradient base + optional image, crossfade) + readability scrim.
2. Overlay grid (z-index 2): **top bar** (top), **center** (empty — the environment is the hero; nothing is rendered here), **bottom row** (bottom-left).
3. Panel layer (z-index 3): at most **one** open panel (drawer/sheet) anchored right (desktop/tablet) or bottom (mobile).
4. Toast (z-index 4), leave dialog (Radix portal).

The environment must remain visually dominant: no persistent cards in the middle; all persistent chrome is translucent "glass" and lives on the edges. Only the timer (compact), the optional music player, and the top bar are persistent.

### 3.4 Glass/readability treatment (applies to every overlay surface)

Defined once in `R/room/RoomScreen.module.css` as class `.glass` and re-used by `composes: glass from '../RoomScreen.module.css'` in component modules (CSS Modules `composes`):

```css
.glass {
  background: rgba(12, 14, 18, 0.66);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  backdrop-filter: blur(14px) saturate(1.15);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-lg);
  color: #fff;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: rgba(12, 14, 18, 0.88); }
}
```

Scrim on the background layer: `linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,.12) 28%, rgba(0,0,0,.12) 58%, rgba(0,0,0,.62) 100%)`, plus a per-background `extraScrim` (0–0.25 additional uniform black) for bright images (seaside, forest). Secondary text on glass must keep ≥ 4.5:1 contrast (use `rgba(255,255,255,.78)` minimum). Text directly on the scrim (room title) gets `text-shadow: 0 1px 12px rgba(0,0,0,.6)`.

### 3.5 Desktop (≥ 1024 px)

```
┌ sidebar 64px ┐┌──────────────────────── stage ──────────────────────────────┐
│              ││ Room name · atmosphere          [People][Session][Room][Leave]│  ← top bar (glass-free title, glass icon buttons)
│              ││ ♪ chip: Rain · playing · 40%                       ┌───────┐ │
│              ││                                                    │ panel │ │  ← ONE drawer, 360px wide, right,
│              ││          (environment, uncluttered)                │ (e.g. │ │    top: 72px; bottom: 16px; right: 16px
│              ││                                                    │ tasks)│ │
│              ││ ┌ FocusBar 320px ┐ ┌ Music player dock 320×200 ┐    └───────┘ │
│              ││ └────────────────┘ └───────────────────────────┘             │  ← bottom row, left-aligned
└──────────────┘└──────────────────────────────────────────────────────────────┘
```
- Drawer **overlays** the stage; it never reflows the background or the bottom row. Bottom row stays at the left, so the timer is visible while any drawer is open.
- Top bar height 72 px; icon buttons 40×40 with visible text labels from 1280 px (icon + label), icon-only (with `aria-label` + `title`) below.
- Bottom row: `position:absolute; left:24px; bottom:24px; display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap; max-width: calc(100% - 48px)`. FocusBar first, music dock second.

### 3.6 Tablet (769–1023 px)

Same as desktop but: drawer width 340 px; icon-only toolbar; bottom row wraps (dock drops above the FocusBar if the row cannot fit); drawer may cover the dock while open (music keeps playing; the iframe stays mounted — see §4.4.5).

### 3.7 Mobile (≤ 768 px, matching `useExperience`)

- Shell shows `MobileNav` at the bottom; stage height accounts for it (§3.3).
- Top bar: room name (single-line ellipsis, atmosphere hidden here, shown in Room info panel), then four 44×44 icon buttons: **People** (with count badge), **Session**, **Room**, **Leave**. `padding-top: max(var(--space-3), env(safe-area-inset-top))`.
- Bottom stack above the nav (`bottom: var(--space-3)`, full-width minus 12 px margins): music dock (if shown) above `FocusBar`; FocusBar is a compact two-row layout (phase chips + time/controls).
- Panels are **bottom sheets**: `left:0; right:0; bottom:0; max-height: 72dvh; border-radius: var(--radius-xl) var(--radius-xl) 0 0;` content scrolls (`overflow-y:auto; overscroll-behavior: contain`); a dim scrim (`rgba(0,0,0,.45)`) covers the stage behind it; tapping the scrim closes the sheet. Sheet sits above `MobileNav` visually (it overlays the stage only; `bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom))` because MobileNav is outside the stage).
- Music dock on mobile defaults to **collapsed** (a 48 px "Room music · Show player" chip). Expanding mounts the iframe (16:9, 200 px tall minimum for YouTube; Spotify 152 px). Collapsing unmounts it (stops this viewer's music — made explicit in the chip label "Hide player (stops music)").
- Tap targets ≥ 44 px. No hover-only affordances.
- Known limitation: Capacitor native on wide tablets gets the mobile nav but desktop CSS widths; the 56 px nav overlap there is accepted for the prototype **[assumption]**.

### 3.8 Panel model (competing panels) **[decision]**

One piece of state in `RoomScreen`: `activePanel: 'session' | 'people' | 'room' | 'timer' | null`.
- Clicking a toolbar button: if it equals `activePanel` → close; else → open it (replacing whatever was open). **Never two panels at once** on any breakpoint.
- `Escape` closes the panel and returns focus to the button that opened it.
- Opening the leave dialog closes any panel.
- On mobile the scrim click closes; on desktop clicking the stage background does **not** close (avoid accidental dismissal while typing tasks).
- Panel-internal drafts (e.g. a half-typed task) **persist** when a panel is closed and reopened: panels are unmounted, so drafts live in the owning hooks/`RoomScreen` state, **not** in panel-local state. Specifically: task input draft is held by `usePersonalTasks` (`draft` + `setDraft`); goal draft by `useSessionGoal`. The music URL draft is panel-local and is intentionally lost on close (acceptable, cheap to retype).

### 3.9 Visibility matrix (admin vs member) **[decision — do not alter]**

| Surface | Admin/creator sees | Ordinary member sees |
|---|---|---|
| Toolbar "Room" button | Label **"Customize room"**, `SlidersHorizontal` icon | Label **"Room info"**, `Info` icon |
| Panel opened by it | `EnvironmentPanel` (tabs: Background / Music / Ambience) with a header badge "Host controls · changes apply to everyone" | `RoomInfoPanel`: read-only: "Set by {adminName}", current background name + thumbnail, music source line, ambience name + state, **mute-for-me** toggle, and the sentence "Only the host can change the room." No selectors, no inputs, no sliders for shared settings |
| Top bar badge | Small `Crown` + "You're the host" chip next to the title | "Host: {adminName}" muted text under the atmosphere line (hidden on mobile) |
| `RoomSoundChip` (top-left, under title) | Shows ambience + music status; click opens panel | Same status, read-only; click opens `RoomInfoPanel` |
| Ambience play/pause + volume | In `EnvironmentPanel › Ambience` and a play/pause icon in the chip | **Not rendered**. Member sees state text only ("Rain · playing") |
| Music source URL input | `EnvironmentPanel › Music` | **Not rendered** |
| Music player dock (embedded iframe) | Visible when `music` set | Visible when `music` set (listeners need the embed's own play button because browsers block autoplay) |
| Mute room sound for me | Present (in `EnvironmentPanel` footer and chip) | Present (in `RoomInfoPanel` and chip) |
| "Tap to enable room sound" prompt | Shown if browser audio is suspended | Same |
| Timer, tasks, goal, participants, leave | Identical | Identical |

Distinction is made by **different components and different props** (`EnvironmentPanel` receives `actions: SharedEnvironmentActions`; `RoomInfoPanel` receives only `environment: SharedRoomEnvironment` and no actions), plus explicit text labels — never color or position alone.

Prototype review aid: when `?viewAs` is absent, role is `viewerId === room.adminUserId`. Default mock roles: Fireplace → viewer is admin; Library and Developer Den → viewer is a member (admin is a mock user). A small, always-visible `DemoDataNote` ("Prototype · sample participants and roles") appears in `RoomInfoPanel`/`EnvironmentPanel` footers and the People panel footer.

---

## 4. Detailed interaction specifications

Global rules for all interactions: every control is a real `<button>`/`<input>`; every icon-only button has `aria-label` **and** `title`; focus rings use `outline: 2px solid var(--color-brand); outline-offset: 2px`; all motion is disabled under `@media (prefers-reduced-motion: reduce)`; user-visible copy is plain text (no emoji).

### 4.1 Room discovery and entry

| Action | Result |
|---|---|
| Page load `/studyroom` | Renders synchronously from `ROOM_CATALOG` (no fetch, no spinner). |
| Click/Enter/Space on **Enter room** (or anywhere on the card) | `next/link` client navigation to `/studyroom/{slug}`. No API call. |
| Image fails to load | `next/image` `onError` → set card state `imageFailed=true` → image hidden; gradient base (from the room's default background) remains. No broken-image icon. |
| Browser back from a room | Returns to discovery (equivalent to leaving; no confirmation — explicit Leave button is the confirmed path). |

After entry the room mounts with its `defaultEnvironment`; personal state starts empty/default; `enteredAt = Date.now()` is captured once (`useRef`) and used as the current user's `joinedAt`.

**Leaving.** The top-bar **Leave** button:
1. If `hasPersonalSessionState` (timer not idle, OR `completedFocusSessions > 0`, OR `tasks.length > 0`, OR goal text non-empty) → open `LeaveRoomDialog` (Radix Dialog): title "Leave this room?", body "Your timer, tasks and goal live only in this session and will be cleared.", buttons **Stay** (default focus, closes) and **Leave room** (`router.push('/studyroom')`).
2. Otherwise → `router.push('/studyroom')` immediately.
Admin environment changes are also discarded on leave (prototype; no persistence — §8.12).

### 4.2 Background (admin only) — `EnvironmentPanel › Background`

- UI: `role="radiogroup" aria-label="Room background"`; 8 options in a 2-column grid (3 columns when panel ≥ 420 px — not applicable now; keep 2). Each option is a `<label>` wrapping a visually hidden `<input type="radio" name="room-background">` and a thumbnail (`BackgroundThumb`: 160×100, gradient base + `next/image` with `onError` → hide) with the label text below. Native radio semantics give arrow-key navigation and Space/Enter selection.
- Selected state: 2 px brand ring + `Check` badge + `aria-checked` via native `checked`. Exactly one is always selected (there is no "none").
- Behavior: selecting a thumbnail calls `actions.setBackground(id)` **immediately** (no Apply button). The stage crossfades (400 ms; none under reduced motion). `updatedAt`/`updatedByUserId` are refreshed.
- Selecting the already-selected background is a no-op (no crossfade restart).
- Image failure: the stage background layer shows the gradient base for that background; `RoomToast` says "Couldn't load that background image. Showing a gradient instead." once per background per visit. Selection remains applied.
- Gradient-only backgrounds (rainy window, quiet café, night sky, minimal workspace today) show a small "Illustration coming soon" caption in the thumbnail's `title` attribute only — **not** in visible UI — because they are fully valid selections.
- Members never see this UI.

Background catalog (authoritative; data in `R/data/backgroundCatalog.ts`):

| `id` | Label | Image (reuse) | Gradient base (also the fallback) | `focal` (object-position) | `extraScrim` |
|---|---|---|---|---|---|
| `library` | Library | `/images/studyrooms/library.webp` | `linear-gradient(160deg,#4a3418 0%,#1a120a 100%)` | `50% 35%` | 0 |
| `rainy-window` | Rainy window | none | `linear-gradient(160deg,#1b2a3a 0%,#2e4157 45%,#16212c 100%)` | – | 0 |
| `cozy-fireplace` | Cozy fireplace | `/images/studyrooms/fireplace.webp` | `linear-gradient(160deg,#5a2410 0%,#140806 100%)` | `60% 40%` | 0 |
| `quiet-cafe` | Quiet café | none | `linear-gradient(155deg,#3b2a20 0%,#6b4a34 50%,#2a1d16 100%)` | – | 0 |
| `forest` | Forest | `/images/studyrooms/campside.webp` | `linear-gradient(160deg,#1f3d2b 0%,#0b1a12 100%)` | `50% 45%` | 0.12 |
| `seaside` | Ocean / seaside | `/images/studyrooms/seaside.webp` | `linear-gradient(160deg,#1e5a8a 0%,#0b2740 100%)` | `50% 50%` | 0.22 |
| `night-sky` | Night sky | none | `radial-gradient(ellipse at 70% 15%,#2b3a67 0%,#0e1430 55%,#05070f 100%)` | – | 0 |
| `minimal-workspace` | Minimal workspace | none | `linear-gradient(160deg,#20242b 0%,#2c323b 55%,#14171c 100%)` | – | 0 |

Four backgrounds have no artwork in the repository; they intentionally ship as gradients so every required option is selectable today. Replacing them with real illustrations later only requires adding a file under `public/images/studyrooms/` and setting `image` — no logic change. **Do not generate or download images in this work.**

Application behavior: `RoomBackground` always renders the gradient `div` as the base. If `image` is set, a `next/image` (`fill`, `sizes="100vw"`, `priority` only for the initial background, `style={{objectFit:'cover', objectPosition: focal}}`) fades in over it (`onLoad` → class `loaded`; `onError` → class `failed`, image `display:none`). The images are portrait; on landscape stages `cover` crops heavily — that is why `focal` exists. On background change: keep the previous layer mounted for 500 ms (state `previousId`, cleared by a `setTimeout` that is cleared on unmount/next change) while the new layer fades in.

### 4.3 Ambient sound (admin controls; everyone hears)

**Playback is genuine browser audio** generated with the Web Audio API (no asset files, no network). The nature presets are *procedural approximations* built from filtered noise — they are honest, basic-quality placeholders; real loops can replace them later via `assetUrl` (unused today). White/pink/brown noise are true noise. **No fake "playing" UI**: if the engine is unavailable the UI says so and disables controls (§4.3.5).

Presets (data in `R/data/ambientCatalog.ts`; icon from `lucide-react`):

| `id` | Label | Icon | Synthesis recipe (all via one shared 6 s looping noise `AudioBuffer`) |
|---|---|---|---|
| `rain` | Rain | `CloudRain` | white noise → highpass 800 Hz → lowpass 9 kHz → gain 0.60; plus brown → lowpass 400 Hz → gain 0.15 |
| `thunderstorm` | Thunderstorm | `CloudLightning` | `rain` recipe + every 8–20 s (random) a rumble: brown noise → lowpass 180 Hz, gain ramp 0→0.9 in 0.3 s then exponential decay over 3 s |
| `fireplace` | Fireplace | `Flame` | brown → lowpass 500 Hz → gain 0.50; plus crackles every 80–400 ms (random): 8 ms white burst → bandpass 3 kHz (Q 1) → gain random 0.1–0.5 |
| `ocean-waves` | Ocean waves | `Waves` | brown → lowpass 900 Hz → gain base 0.45 modulated by 0.1 Hz sine LFO depth 0.35; plus pink → highpass 2 kHz → gain 0.10 modulated by the same LFO |
| `forest` | Forest ambience | `Trees` | pink → bandpass 600 Hz (Q 0.5) → gain 0.25 with 0.08 Hz gain LFO depth 0.08; plus a chirp every 3–9 s: sine sweep 2.5→4.5 kHz over 120 ms, gain 0.05 |
| `wind` | Wind | `Wind` | pink → bandpass whose center frequency is swept 300↔900 Hz by a 0.07 Hz LFO; gain modulated by a 0.12 Hz LFO between 0.15–0.40 |
| `white-noise` | White noise | `AudioLines` | white buffer → gain 0.35 |
| `pink-noise` | Pink noise | `AudioLines` | pink buffer (Paul Kellet filter) → gain 0.60 |
| `brown-noise` | Brown noise | `AudioLines` | brown buffer (leaky integrator, scaled ×3.5) → gain 0.80 |
| `cafe` | Café ambience | `Coffee` | pink → bandpass 300–3000 Hz → gain 0.35; plus soft clinks every 4–12 s: sine 2–4 kHz (random), 40 ms, gain 0.03 |

Random timers use `Math.random()` — this is sound design, not fabricated app data. All `setTimeout`s and nodes are tracked by the engine and cleared in `stop()`/`dispose()`.

Master level: `volume` is an integer 0–100; engine gain = `(volume / 100) ** 2 * 0.6`, applied with `gain.setTargetAtTime(value, ctx.currentTime, 0.05)`.

#### 4.3.1 Selection (admin)
`EnvironmentPanel › Ambience`: a `role="radiogroup" aria-label="Ambient sound"` of 11 options (None + 10 presets), 2-column grid of icon+label tiles (native radio inputs). Selected tile is highlighted with brand ring + check.
- Choose a preset → `actions.setAmbiencePreset(id)`: sets `presetId=id` **and `isPlaying=true`** (the host picked it to hear it).
- Choose **None** → `presetId=null`, `isPlaying=false`; controls below become disabled with helper text "No ambient sound selected."
- Switching preset while playing: engine **crossfades** (new preset fades in over 600 ms while the old fades out then is stopped/disposed).

#### 4.3.2 Play/pause (admin)
A toggle button below the grid: label **"Pause ambient sound"** / **"Play ambient sound"** (`aria-pressed` mirrors `isPlaying`). Disabled when `presetId === null`. The chip in the top-left shows a matching small play/pause icon button for admins only.

#### 4.3.3 Volume (admin)
`<input type="range" min=0 max=100 step=1>` labeled "Room volume" with `aria-valuetext="40 percent"`. Writes to the shared `ambience.volume` on `onChange`. This is the **room's** level.

#### 4.3.4 Mute for me (everyone)
A switch-style button: **"Mute room sound for me"** (`aria-pressed`). When on, the local engine gain is forced to 0 (smooth) and the chip shows a `VolumeX` icon + "muted for you". State lives in `RoomScreen` as `mutedForMe` (React state; not persisted; not shared). It does not mute YouTube/Spotify iframes (cannot be controlled cross-origin) — the label under the toggle says "Applies to ambient sound only. Use the music player's own controls for music."

#### 4.3.5 Browser restrictions and failure states
`useAmbientPlayback({ presetId, volume, isPlaying, mutedForMe })` exposes `status`: `'idle' | 'playing' | 'blocked' | 'unsupported'`.
- `unsupported`: `typeof window.AudioContext === 'undefined' && typeof window.webkitAudioContext === 'undefined'` (also true in jsdom/vitest). Chip + panel show "Ambient sound isn't supported in this browser." Play/volume controls disabled. Admin selection is still stored (shared state is valid).
- `blocked`: `ctx.state === 'suspended'` after `isPlaying` became true and `ctx.resume()` didn't resolve to `'running'`. Show `AudioUnlockButton` inside the chip row: **"Tap to start room sound"**; clicking it calls `resume()` inside the click handler (a user gesture). On success status → `'playing'`.
- First entry via client-side navigation after a click normally already has sticky user activation → starts without prompt. Deep-link/refresh will show the prompt. Both are expected.
- Autoplay of the audio never throws to the UI; all `AudioContext` calls are wrapped in try/catch; failures set `status:'unsupported'` and log once with `console.warn`.

### 4.4 Shared music (YouTube / Spotify) — admin chooses, everyone listens

**Playback is genuine only inside the provider's own embedded player.** The app cannot start/pause/seek a cross-origin YouTube/Spotify iframe without their JS APIs (not planned: no credentials, no extra scripts). Therefore:
- The admin selects the **source**; every listener presses **play inside the embedded player** (browsers block autoplay).
- There is **no app-level play/pause for music** and no "now playing" synchronization. The UI never shows an app-owned play button for music. **[decision]**

#### 4.4.1 URL entry (admin) — `EnvironmentPanel › Music`
- A labeled text input "YouTube or Spotify link" (`type="url"` is **not** used — we accept scheme-less input; use `type="text" inputMode="url" autoComplete="off" spellCheck={false} maxLength={300}`), a **Set room music** submit button, helper text, and the current-source card.
- Submit (Enter or button): `parseMusicUrl(value)` (pure function, §5.2/§6 Stage 2). 
  - `ok` → `actions.setMusic(source)`; clear the input; show success text via `RoomToast`: "Room music set." Move focus to the current-source card heading.
  - `error` → inline message below the input (`role="alert"`, `aria-invalid="true"` on input, `aria-describedby` linking helper+error); input keeps its text and focus; room music is unchanged.
- Empty submit → error `empty`.
- Current-source card (when `music != null`): provider badge ("YouTube"/"Spotify"), kind ("Video"/"Playlist"/"Track"), the canonical link as an `Open in YouTube/Spotify` external link (`target="_blank" rel="noopener noreferrer"`), and a **Remove music** button → `actions.setMusic(null)`. Titles are **not fetched** (no API) — the card shows kind + ID tail (e.g. "Playlist · …X3kQ"), never a fabricated title.
- Limitations copy under the form (static, verbatim):
  - "Playback happens in the embedded player. Your browser blocks autoplay, so everyone presses play in the player."
  - "Some videos disable embedding or are private; the player will show its own message."
  - "Spotify may play previews unless the listener is signed in to Spotify in this browser."

Supported inputs (all else rejected):

| Provider | Accepted | Embed URL built from the **validated ID only** |
|---|---|---|
| YouTube video | `youtube.com/watch?v=ID`, `m.youtube.com`, `music.youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/shorts/ID`, `youtube.com/embed/ID` (ID = `[A-Za-z0-9_-]{11}`) | `https://www.youtube-nocookie.com/embed/ID?rel=0&playsinline=1` |
| YouTube playlist | any of the above hosts with `list=LIST` (LIST = `[A-Za-z0-9_-]{12,64}`) and **no** video, or `youtube.com/playlist?list=LIST` | `https://www.youtube-nocookie.com/embed/videoseries?list=LIST&rel=0&playsinline=1` |
| YouTube video within a playlist (`v=ID&list=LIST`) | treated as **playlist** `LIST`, starting at `ID` | `https://www.youtube-nocookie.com/embed/ID?list=LIST&rel=0&playsinline=1` |
| Spotify track | `open.spotify.com/track/ID` (optional `/intl-xx/` prefix, optional query), `spotify:track:ID` (ID = `[A-Za-z0-9]{22}`) | `https://open.spotify.com/embed/track/ID?utm_source=generator` |
| Spotify playlist | `open.spotify.com/playlist/ID`, `spotify:playlist:ID` | `https://open.spotify.com/embed/playlist/ID?utm_source=generator` |

Scheme-less input (`youtube.com/…`, `youtu.be/…`, `open.spotify.com/…`) gets `https://` prepended; `http://` is upgraded to `https://`; any other scheme is rejected. Host must be **exactly** one of: `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`, `open.spotify.com`. Lookalike hosts (`youtube.com.evil.io`, `evilyoutube.com`) are rejected because comparison is on the parsed `URL.hostname`, not a substring.

Error reasons → messages (exhaustive):

| `reason` | Message |
|---|---|
| `empty` | "Paste a YouTube or Spotify link." |
| `not-a-url` | "That doesn't look like a link." |
| `unsupported-host` | "Only YouTube and Spotify links are supported." |
| `unsupported-spotify-type` | "Spotify links must be a track or a playlist." |
| `youtube-no-media` | "That YouTube link doesn't point to a video or a playlist." |

#### 4.4.2 Player UI — `MusicPlayerDock`
- Rendered for **everyone** whenever `environment.music != null`. Not rendered at all otherwise (no empty player, no placeholder player).
- Structure: header row ("Room music" + provider badge + **Hide player** button) and the `<iframe>`.
- YouTube iframe: `src=embedUrl`, `title="Room music (YouTube)"`, `allow="autoplay; encrypted-media; picture-in-picture"`, `referrerPolicy="strict-origin-when-cross-origin"`, `allowFullScreen`, `loading="lazy"`, size 320×200 desktop / 100%×200 mobile (YouTube asks that embedded players be at least 200×200 — we keep the player visible; **no hidden/zero-size iframes**).
- Spotify iframe: `title="Room music (Spotify)"`, `allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"`, `loading="lazy"`, size 320×152 (compact) desktop / 100%×152 mobile. `border:0; border-radius: 12px`.
- No `sandbox` attribute **[assumption]**: provider embeds are fragile under sandboxing and cannot be tested here; URLs are built exclusively from validated IDs and fixed hosts, so there is no injection path.
- Always include below the iframe a small link **"Trouble playing? Open in YouTube/Spotify"** (external, `rel="noopener noreferrer"`). The app cannot detect embed failure (cross-origin), so this link is the failure path.
- **Hide player** → local state `playerHidden=true`: the iframe **unmounts** (stops this viewer's music — button tooltip "Hide player (stops music for you)"); the dock collapses to a 48 px bar "Room music · Show player". **Show player** remounts it (user presses play again). Default: expanded on ≥ 769 px, collapsed on ≤ 768 px.
- **Persistence while panels open/close:** the dock is a sibling of the panel layer (not inside any panel), so opening/closing panels never unmounts it. It also survives background and ambience changes. It remounts (and music restarts) **only** when the admin changes `music` (iframe `key={embedUrl}`) or the viewer hides/shows it.

#### 4.4.3 Switching sources
Setting a new valid URL replaces `music` immediately; the iframe `key` changes, the old source stops, the new one waits for the listener to press play. Removing music unmounts the dock. Ambient sound is independent and may play at the same time as music.

#### 4.4.4 Member view
Members have no input. `RoomInfoPanel` shows "Music: YouTube playlist" / "Spotify track" / "No music selected" and "Set by {adminName}". The dock (player) is visible to them as in §4.4.2.

### 4.5 Personal Pomodoro timer

#### 4.5.1 Model (reducer in `R/utils/pomodoroReducer.ts`; pure; `now` is passed in actions)

Defaults: focus **25**, short break **5**, long break **15**, long break every **4** focus sessions, auto-start next phase **off**, chime **on**.

Limits (integers, clamped on commit): focus 1–120; short break 1–30; long break 1–60; long break every 2–8.

State: `settings`, `phase` (`'focus' | 'shortBreak' | 'longBreak'`), `status` (`'idle' | 'running' | 'paused'`), `phaseDurationMs`, `remainingMs`, `endsAt` (epoch ms or null), `completedFocusSessions`, `completionSeq` (increments on each natural completion), `lastCompletedPhase`.

Actions and transitions:

| Action | From | Effect |
|---|---|---|
| `START(now)` | `idle` | `phaseDurationMs = minutes(phase)·60000`; `remainingMs = phaseDurationMs`; `endsAt = now + remainingMs`; `status='running'` |
| `PAUSE(now)` | `running` | `remainingMs = max(0, endsAt − now)`; `endsAt = null`; `status='paused'` |
| `RESUME(now)` | `paused` | `endsAt = now + remainingMs`; `status='running'` |
| `RESET(now)` | any | `status='idle'`; `phaseDurationMs = minutes(phase)·60000` (using *current* settings); `remainingMs = phaseDurationMs`; `endsAt=null`. **Phase and `completedFocusSessions` are unchanged.** |
| `SELECT_PHASE(p)` | any | `phase = p`; same as RESET for the new phase. Switching mid-run discards progress (no confirm). |
| `SKIP` | any | advance without counting: `focus → shortBreak`; `shortBreak/longBreak → focus`; result `idle`. |
| `TICK(now)` | `running` | If `now < endsAt`: `remainingMs = endsAt − now`. Else **complete** (below). No-op otherwise. |
| `UPDATE_SETTINGS(patch)` | any | Clamp/validate (§4.5.5). Apply per §4.5.6. |

**Completion** (`TICK` with `now ≥ endsAt`): if `phase==='focus'` → `completedFocusSessions += 1`. `completionSeq += 1`; `lastCompletedPhase = phase`. Next phase: from `focus` → `longBreak` when `completedFocusSessions % longBreakEvery === 0` (after the increment) else `shortBreak`; from either break → `focus`. Set `phase=next`, `phaseDurationMs = minutes(next)·60000`, `remainingMs = phaseDurationMs`. If `settings.autoStartNext` → `status='running'`, `endsAt = now + phaseDurationMs`; else `status='idle'`, `endsAt=null`. Exactly **one** transition per `TICK` (a long background sleep never cascades through several phases).

`usePomodoro` runs `setInterval(…, 250)` **only while `status==='running'`**, dispatching `TICK(Date.now())`; it clears the interval on status change and on unmount. Remaining display = `Math.ceil(remainingMs/1000)` seconds, formatted `MM:SS` (`H:MM:SS` never needed: max 120 min = `120:00`, render minutes with ≥ 2 digits).

Side effects live in the hook, not the reducer: an effect watching `completionSeq` (skip initial) plays the chime (if `settings.chimeEnabled`) and sets a polite live-region message: focus done → "Focus session complete. Time for a {short|long} break."; break done → "Break over. Ready to focus?".

Document title: while `status !== 'idle'`, set `document.title = "{MM:SS} · {Phase label} — {Room title}"`; restore the previous title on pause→idle and on unmount (store `previousTitleRef`).

#### 4.5.2 `FocusBar` UI (always visible, compact, 320 px)
Row 1: three phase chips `Focus` / `Short break` / `Long break` as `role="tablist"`-less **toggle buttons** with `aria-pressed` (selected = current phase). Row 2: large time (`role="timer"`, `aria-live="off"`), a small SVG ring (r=45; circumference `2π·45 = 282.74`; ring depletes with remaining fraction like the existing component), and buttons:
- Primary: **Start** (idle) → **Pause** (running) → **Resume** (paused). `Play`/`Pause` icons + visible text.
- **Reset** (`RotateCcw`, always enabled; disabled when `idle`).
- **Skip** (`SkipForward`).
- **Timer settings** (`Settings`) → toggles panel `'timer'`.
Row 3 (small): cycle dots (`longBreakEvery` dots; filled = sessions done in the current cycle; a full row displays during the long break) and text "{N} focus sessions this visit". Dots are decorative (`aria-hidden`); the text carries the information.

Selected/disabled states: chips `aria-pressed`; Reset disabled when `idle`; Start never disabled.

#### 4.5.3 `TimerSettingsPanel` (panel `'timer'`)
Number inputs (type `number`, `inputMode="numeric"`, min/max per limit): Focus (min), Short break (min), Long break (min), Long break every (sessions). Toggles: "Start next phase automatically" (default off), "Play sound when a phase ends" (default on). A **Restore defaults** button (applies defaults via `UPDATE_SETTINGS`).
Commit rules: values commit on **blur or Enter**, not per keystroke. Non-integer/NaN/empty → revert to the previous value and show inline `role="alert"` text "Enter a whole number from {min} to {max}." Out-of-range integer → clamp and show the same hint. Typing never changes the running countdown.

#### 4.5.4 Selecting a phase
Chip click dispatches `SELECT_PHASE`. If the timer is running or has progress this silently discards it (documented behavior; the Reset-like semantic is stated in the chip's `title`: "Switch to Focus (resets the timer)").

#### 4.5.5 Validation
`clampSetting(key, raw)` in the reducer module returns the clamped integer or `null` for invalid; `UPDATE_SETTINGS` ignores `null` patches. Never store floats/NaN.

#### 4.5.6 Settings changed during an active session
- Status `idle`: if the changed value belongs to the **current** phase, `remainingMs`/`phaseDurationMs` update immediately.
- Status `running`/`paused`: the current countdown is **not** altered. A hint appears in the timer panel: "New durations apply the next time a phase starts or after Reset." `longBreakEvery`, `autoStartNext`, `chimeEnabled` take effect immediately for the *next* completion decision.
- `completedFocusSessions` is never changed by settings.

### 4.6 Personal task list — `SessionPanel` (lower half)

Model: `PersonalTask { id: string; text: string; done: boolean; createdAt: number }`, held in `usePersonalTasks` (React state only). IDs: `task-${n}` from a `useRef` counter (deterministic; no `crypto`).

| Interaction | Behavior |
|---|---|
| Add | Input "Add a task" + **Add** button (`Plus`). Enter submits. Trim; collapse internal whitespace runs to single spaces. Reject empty → inline error "Write something first." (`role="alert"`); reject > 120 chars → input `maxLength=120` prevents it (also guarded in the hook). Reject when `tasks.length >= 50` → inline "You've reached 50 tasks. Finish or delete one first." and disable Add. Duplicates allowed. New tasks append to the **bottom**. After add: clear draft, keep focus in input. |
| Complete / uncomplete | Native checkbox per row (`<label>` with text). Completed rows: text strike-through at 70 % opacity; **position unchanged**. |
| Edit | `Pencil` button (or double-click on text) → row turns into a text input pre-filled and focused with caret at end. **Enter or Save** commits; **Escape or Cancel** discards. Commit with empty/whitespace → stays in edit mode with inline "A task can't be empty." Editing a completed task keeps `done`. Only one row editable at a time (starting another edit cancels the first). |
| Delete | `Trash2` button, immediate, no confirm (low stakes); focus moves to the next row's checkbox, else the add input. |
| Reorder | `ChevronUp`/`ChevronDown` buttons per row ("Move up"/"Move down"); disabled at the ends. No drag-and-drop (no dependency, fully keyboard accessible). After moving, focus stays on the moved row's same-direction button. |
| Clear completed | Text button visible only when ≥ 1 done; removes done tasks. |
| Summary | "{done} of {total} done" under the list header when total > 0. |
| Empty state | Centered muted text "No tasks yet. Add the first thing you'll do this session." (no illustration). |
| Privacy label | Under the header: `Lock` icon + "Only you can see your tasks." |

List semantics: `<ul>`/`<li>`; scroll container `max-height` fills the panel; panel body scrolls, the add-input row is pinned at the bottom of the tasks section (`position: sticky; bottom: 0`) so it stays reachable on mobile.

### 4.7 Personal session goal and visibility — `SessionPanel` (upper half)

Model: `SessionGoal { text: string; visibility: 'private' | 'room' }`, held in `useSessionGoal`. Default `{ text: '', visibility: 'private' }` — **private by default [decision]**.

- Field "What's your goal for this session?" (`<input maxLength=80>`) with live counter "{n}/80". Text commits on **Enter**, on **blur**, or via **Save** (blur-commit means no unsaved state hides). Trim; empty text = no goal. A draft is kept in the hook while the panel is closed.
- Visibility control: a two-option segmented control `role="radiogroup" aria-label="Goal visibility"`: **Private** (`Lock`) / **Visible to room** (`Eye`). Applies **immediately** on selection (no Save needed). Helper text swaps: Private → "Only you can see this goal."; Visible → "Everyone in this room can see this goal next to your name."
- Display: when a goal exists, the `FocusBar` shows nothing extra (kept compact); the goal is shown in the Session panel header line ("Goal: …" + visibility icon) and, **only if `visibility==='room'` and `text !== ''`**, beside the user's row in `ParticipantPanel`.
- **Privacy invariant (must be enforced in code and tested):** `deriveParticipants()` receives the goal and sets the current user's `publicGoal` to `goal.text` **iff** `goal.visibility === 'room' && goal.text !== ''`, else `null`. `RoomParticipantView` has **no field** that can carry a private goal. Switching Visible → Private removes it from the participant panel in the same render; switching Private → Visible with non-empty text adds it immediately. Editing the text while Visible updates the public text on commit (not per keystroke).
- Mock peers also expose only `publicGoal: string | null`. `null` is rendered as nothing (a peer with a private goal and a peer with no goal look identical — intentionally).

### 4.8 Participant panel (panel `'people'`) and elapsed time

- Header: "People · {count}" (count = roster length including you). Top-bar pill shows up to 3 avatars + the count and opens this panel.
- List `<ul>`, ordering: current user first, then admin (if not you), then others by `joinedAt` ascending (longest-present first). Each `ParticipantRow`: `ParticipantAvatar` (initials fallback; no external service), name (ellipsis), badges ("You" subtle pill; `Crown` + "Host" for the admin), elapsed time ("1h 12m"), and the **public goal** line below the name (italic, 2-line clamp) only when `publicGoal` is non-null.
- Subtle current-user indication: row has a 2 px brand-tinted left border and the "You" pill — **not color alone** (text pill present).
- Elapsed time: `formatElapsed(now - joinedAt)`: < 60 s → "Just joined"; < 60 min → "{m}m"; otherwise "{h}h {m}m" (m omitted when 0 → "2h"). `joinedAt` values come from `MOCK_ROSTERS[slug][i].joinedMinutesAgo`, converted **once** at room mount to absolute epoch (`mountedAt − minutes·60000`), and the current user's `joinedAt = mountedAt`. `now` comes from `useNow(15_000)` (one shared interval in `RoomScreen`, cleared on unmount) so elapsed text advances while the panel is open or closed. **No random joins/leaves, no scripted events, no chat.**
- Footer: `DemoDataNote` "Sample participants for preview. Live presence comes later."
- Missing data: a participant with an empty/whitespace `displayName` renders "Guest"; with no avatar renders initials of the displayName (or "G"); an invalid `joinedAt` (NaN or in the future) renders "Just joined".
- Empty roster is impossible (the current user is always present); the "alone" state shows the user's row plus muted "You're the only one here right now." only when roster length is 1 (kept for forward compatibility).

### 4.9 Leave / panel keyboard behavior (summary)

Toolbar buttons use plain tab order (no roving tabindex): top bar → toolbar buttons (People, Session, Room, Leave) → open panel contents → FocusBar → music dock. `Escape` closes the open panel; focus returns to its trigger. Opening a panel moves focus to the panel heading (`tabIndex={-1}`). Radix handles focus trap/restore for the leave dialog.

### 4.10 Toasts and live regions

`RoomToast`: a single-slot message (latest wins) rendered in a `role="status" aria-live="polite"` container, auto-dismiss after 4000 ms (timer cleared on unmount/next message), manual close button. Used for: background image failure, music set, timer phase completion. A second, visually hidden `aria-live="polite"` region (use the `.srOnly` class defined in `RoomScreen.module.css`; no global `sr-only` utility is assumed) carries timer phase announcements so they are not dependent on the toast's visibility.

---

## 5. Component architecture

### 5.1 Component tree

```
src/app/(dashboard)/studyroom/page.tsx                      (existing, unchanged)
└─ StudyRoomScreen                                          (existing path, rewritten → discovery)
   └─ RoomCard × N                                          (existing path, rewritten)
      └─ ParticipantAvatar                                  (new, shared)

src/app/(dashboard)/studyroom/[roomSlug]/page.tsx           (new, server)
└─ RoomScreen                                               (new, client — owns ALL state)
   ├─ RoomBackground                                        (new)
   ├─ RoomTopBar                                            (new)
   │   ├─ RoomSoundChip                                     (new)
   │   │   └─ AudioUnlockButton                             (new, tiny; may live in RoomSoundChip.tsx)
   │   └─ (toolbar buttons rendered inline: People, Session, Room, Leave)
   ├─ [bottom row]
   │   ├─ FocusBar                                          (new; replaces FocusTimerCard)
   │   └─ MusicPlayerDock                                   (new; only when environment.music)
   ├─ PanelShell (exactly one of, by activePanel)           (new, generic)
   │   ├─ SessionPanel → GoalEditor + TaskList              (new)
   │   ├─ ParticipantPanel → ParticipantRow → ParticipantAvatar (new)
   │   ├─ EnvironmentPanel (ADMIN ONLY) → BackgroundTab | MusicTab | AmbienceTab  (new)
   │   ├─ RoomInfoPanel (MEMBER ONLY)                       (new)
   │   └─ TimerSettingsPanel                                (new)
   ├─ RoomToast                                             (new)
   ├─ LeaveRoomDialog                                       (new, Radix Dialog)
   └─ DemoDataNote                                          (new, tiny, used inside panels)

src/app/(dashboard)/studyroom/[roomSlug]/loading.tsx        (new)
```

### 5.2 Types — `R/types.ts` (authoritative; copy verbatim, extend only if a compile error forces it)

```ts
/* ───────── Rooms (static catalog, shared definition) ───────── */
export type RoomSlug = 'library' | 'fireplace' | 'developer-den';

export type BackgroundId =
  | 'library' | 'rainy-window' | 'cozy-fireplace' | 'quiet-cafe'
  | 'forest' | 'seaside' | 'night-sky' | 'minimal-workspace';

export type AmbientPresetId =
  | 'rain' | 'thunderstorm' | 'fireplace' | 'ocean-waves' | 'forest'
  | 'wind' | 'white-noise' | 'pink-noise' | 'brown-noise' | 'cafe';

export interface BackgroundOption {
  id: BackgroundId;
  label: string;
  image: string | null;        // public path or null → gradient only
  gradient: string;            // CSS background value; always rendered as base/fallback
  focal: string;               // CSS object-position
  extraScrim: number;          // 0..0.25
}

export interface AmbientPreset {
  id: AmbientPresetId;
  label: string;
  icon: 'CloudRain' | 'CloudLightning' | 'Flame' | 'Waves' | 'Trees' | 'Wind' | 'AudioLines' | 'Coffee';
  assetUrl?: string;           // reserved for future real loops; unused now
}

export interface RoomDefinition {
  slug: RoomSlug;
  title: string;               // 'Library' | 'Fireplace' | 'Developer Den'
  atmosphere: string;          // one short line
  previewImage: string | null; // discovery card image; null → gradient of defaultEnvironment.backgroundId
  adminUserId: string;         // MOCK role source; 'viewer' means the current signed-in user
  adminDisplayName: string;    // shown when admin is not the viewer
  defaultEnvironment: SharedRoomEnvironment;
}

/* ───────── SHARED room configuration (admin-controlled) ───────── */
export type MusicSource =
  | { provider: 'youtube'; kind: 'video' | 'playlist'; id: string; startVideoId?: string; embedUrl: string; originalUrl: string }
  | { provider: 'spotify'; kind: 'track' | 'playlist'; id: string; embedUrl: string; originalUrl: string };

export interface SharedAmbience {
  presetId: AmbientPresetId | null;
  volume: number;              // integer 0..100 (the ROOM's level)
  isPlaying: boolean;
}

export interface SharedRoomEnvironment {
  backgroundId: BackgroundId;
  music: MusicSource | null;
  ambience: SharedAmbience;
  updatedAt: number;           // epoch ms; for future sync/ordering
  updatedByUserId: string;     // admin id; for future sync/audit
}

/** Mutations. ONLY ever passed to admin-only components. */
export interface SharedEnvironmentActions {
  setBackground(id: BackgroundId): void;
  setMusic(source: MusicSource | null): void;
  setAmbiencePreset(id: AmbientPresetId | null): void;   // non-null ⇒ isPlaying = true; null ⇒ isPlaying = false
  setAmbiencePlaying(isPlaying: boolean): void;           // no-op when presetId === null
  setAmbienceVolume(volume: number): void;                // clamps/rounds to 0..100
}

/* ───────── Roles ───────── */
export type ViewerRole = 'admin' | 'member';

export interface Viewer {
  userId: string;              // session.user.id ?? 'demo-viewer'
  displayName: string;         // session.user.name ?? 'You'
  avatarUrl: string | null;    // session.user.image ?? null
  role: ViewerRole;
}

/* ───────── Participants (what is visible to OTHER people) ───────── */
export interface MockPeer {
  userId: string;
  displayName: string;
  avatarUrl: null;                  // initials only in the prototype
  joinedMinutesAgo: number;         // static, converted to absolute once at mount
  publicGoal: string | null;        // the ONLY goal field a peer can expose
}

export interface RoomParticipantView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: number;                 // epoch ms
  publicGoal: string | null;        // NEVER a private goal (no field exists for one)
  isCurrentUser: boolean;
  isAdmin: boolean;
}

/* ───────── PERSONAL session state (owner-only) ───────── */
export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

export interface PomodoroSettings {
  focusMinutes: number;        // 1..120, default 25
  shortBreakMinutes: number;   // 1..30,  default 5
  longBreakMinutes: number;    // 1..60,  default 15
  longBreakEvery: number;      // 2..8,   default 4
  autoStartNext: boolean;      // default false
  chimeEnabled: boolean;       // default true
}

export interface PomodoroState {
  settings: PomodoroSettings;
  phase: PomodoroPhase;
  status: PomodoroStatus;
  phaseDurationMs: number;
  remainingMs: number;
  endsAt: number | null;
  completedFocusSessions: number;
  completionSeq: number;
  lastCompletedPhase: PomodoroPhase | null;
}

export type PomodoroAction =
  | { type: 'START'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'RESET' }
  | { type: 'SELECT_PHASE'; phase: PomodoroPhase }
  | { type: 'SKIP' }
  | { type: 'TICK'; now: number }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<PomodoroSettings> };

export interface PersonalTask {
  id: string;                  // `task-${n}`
  text: string;                // trimmed, 1..120
  done: boolean;
  createdAt: number;
}

export type GoalVisibility = 'private' | 'room';
export interface SessionGoal {
  text: string;                // '', or trimmed 1..80
  visibility: GoalVisibility;  // default 'private'
}

/* ───────── Panels ───────── */
export type RoomPanelId = 'session' | 'people' | 'room' | 'timer';
```

### 5.3 State ownership (single source of truth: `RoomScreen`)

```
RoomScreen (client)
  props: { roomSlug: RoomSlug; viewAsOverride?: ViewerRole }
  derived once:  room = getRoomBySlug(roomSlug)            // non-null (page already 404'd)
                 session = useSession().data               // identity only
                 viewer: Viewer = deriveViewer(session, room, viewAsOverride)
  shared state:  const env = useSharedEnvironment(room.defaultEnvironment, viewer.userId)
                    // returns { environment, actions }  ← actions passed ONLY if viewer.role==='admin'
  personal:      const pomodoro = usePomodoro()          // reducer + interval + chime + title
                 const tasks    = usePersonalTasks()
                 const goal     = useSessionGoal()
  local UI:      activePanel: RoomPanelId | null
                 mutedForMe: boolean
                 playerHidden: boolean  (initial from viewport via matchMedia('(max-width: 768px)') in effect; SSR default false)
                 toast: { id:number; text:string } | null
                 leaveOpen: boolean
  time:          mountedAtRef = useRef(Date.now());  now = useNow(15_000)
  derived:       participants = deriveParticipants({ roster: MOCK_ROSTERS[roomSlug], viewer, goal: goal.committed,
                                                     adminUserId: room.adminUserId, mountedAt: mountedAtRef.current })
                 ambience = useAmbientPlayback({ ...environment.ambience, mutedForMe })
```

Rules:
- `useSharedEnvironment` returns `actions` always, but `RoomScreen` forwards it **only** to `EnvironmentPanel` and only when `viewer.role === 'admin'`. `RoomInfoPanel`, `RoomSoundChip` (member mode), `MusicPlayerDock`, `RoomBackground`, etc. receive `environment` read-only. TypeScript: `RoomSoundChip` takes `controls?: Pick<SharedEnvironmentActions,'setAmbiencePlaying'>`, which `RoomScreen` omits for members.
- Admin identity in catalog: for Fireplace `adminUserId: 'viewer'` is a sentinel meaning "the signed-in user"; `deriveViewer` maps `room.adminUserId === 'viewer'` → role `'admin'`; otherwise `'member'`; `viewAsOverride` wins. In `deriveParticipants`, `isAdmin` for the viewer's row = `viewer.role === 'admin'`; for peers = `peer.userId === room.adminUserId`. When `viewer.role === 'admin'` no peer is admin. When `viewAsOverride==='admin'` on a room whose real mock admin is a peer, **both** the viewer and that peer would show "Host" — avoid: in `deriveParticipants`, if `viewer.role==='admin'`, ignore `adminUserId` for peers.
- `room.adminDisplayName` is used when the viewer is a member; when the viewer is admin the UI says "You".

### 5.4 Components (new unless noted) — responsibilities, props, state, callbacks

All client components start with `'use client'`. All styles are CSS Modules named `<Component>.module.css` beside the component unless noted. Types come from `R/types.ts`.

#### Discovery

**`R/StudyRoomScreen.tsx` — existing path, REWRITE.** Default export `StudyRoomScreen()`. No props, no state (static list). Renders header + grid of `RoomCard` from `ROOM_CATALOG`. `<h1>` text **"Study Rooms"**. Dependencies: `RoomCard`, `ROOM_CATALOG`, `MOCK_ROSTERS`, `StudyRoomScreen.module.css`. Must not import `next-auth`, `framer-motion`, `apiUrl`.

**`R/components/RoomCard.tsx` — existing path, REWRITE.** Props: `{ room: RoomDefinition; sampleCount: number; previewPeers: { userId: string; displayName: string }[] }`. State: `imageFailed: boolean`. Renders per §3.2. Uses `next/image`, `next/link`, `ParticipantAvatar`. Memoized with `React.memo`.

#### Room orchestration

**`R/room/RoomScreen.tsx` + `RoomScreen.module.css`.** Props `{ roomSlug: RoomSlug; viewAsOverride?: ViewerRole }`. Owns state per §5.3. Callbacks it builds: `openPanel(id)`, `closePanel()`, `togglePanel(id)`, `requestLeave()`, `confirmLeave()` (router.push). Handles `Escape` via `onKeyDown` on the stage root (only when a panel is open and the event target is not inside the Radix dialog). Stores `lastTriggerRef` (the toolbar button element that opened the panel) to restore focus. `RoomScreen.module.css` also defines `.glass`, `.srOnly`, stage layout, bottom row, and breakpoints (768 / 1024).

#### Background / chrome

**`room/components/RoomBackground.tsx`** — props `{ backgroundId: BackgroundId; onImageError?: (id: BackgroundId) => void }`. State: `previousId: BackgroundId | null`, `loadedIds: Set<BackgroundId>` (or per-layer boolean), `failedIds`. Behavior §4.2. Renders `aria-hidden="true"` layers + scrim. No interactivity.

**`room/components/RoomTopBar.tsx`** — props:
```ts
{ room: RoomDefinition; viewer: Viewer; participants: RoomParticipantView[];
  activePanel: RoomPanelId | null;
  onTogglePanel(id: RoomPanelId, trigger: HTMLElement): void;
  onLeave(): void;
  soundChip: React.ReactNode; }
```
No state. Renders title (`<h1>`), atmosphere, host indicator per §3.9, the participant pill (avatars + count; button for `'people'`), and the toolbar buttons with `aria-expanded` + `aria-controls` (panel id `room-panel`) and `aria-haspopup="dialog"`.

**`room/components/RoomSoundChip.tsx`** — props `{ environment: SharedRoomEnvironment; ambienceStatus: 'idle'|'playing'|'blocked'|'unsupported'; mutedForMe: boolean; onToggleMute(): void; onUnlock(): void; controls?: Pick<SharedEnvironmentActions,'setAmbiencePlaying'>; onOpenRoomPanel(): void }`. Read-only status line "Rain · playing" / "Paused" / "No ambient sound" + music note "YouTube playlist" if set. Admin-only play/pause icon (renders only if `controls` present). Always shows mute-for-me icon button and, when `ambienceStatus==='blocked'`, **Tap to start room sound**.

**`room/components/PanelShell.tsx`** — props `{ id: string; title: string; onClose(): void; children: React.ReactNode; footer?: React.ReactNode }`. State: none; effect focuses heading on mount. Renders `<aside id="room-panel" role="dialog" aria-modal="false" aria-labelledby=…>`, `.glass`, close button (`X`, `aria-label="Close {title}"`). Desktop/tablet right drawer; mobile bottom sheet + scrim element (`<button class=scrim aria-label="Close panel" tabIndex={-1}>` on mobile only via CSS `display:none` on larger screens).

**`room/components/RoomToast.tsx`** — props `{ message: { id: number; text: string } | null; onDismiss(): void }`. Effect: timeout 4000 ms keyed by `message.id`, cleared on cleanup.

**`room/components/LeaveRoomDialog.tsx`** — props `{ open: boolean; onStay(): void; onLeave(): void }`; Radix `Dialog.Root/Portal/Overlay/Content/Title/Description`. Default focus on **Stay**.

**`room/components/DemoDataNote.tsx`** — props `{ children?: React.ReactNode }`; renders small muted text with `Info` icon; default text "Prototype · sample participants and roles."

#### Personal

**`room/components/FocusBar.tsx`** — props `{ state: PomodoroState; onStart(): void; onPause(): void; onResume(): void; onReset(): void; onSkip(): void; onSelectPhase(p: PomodoroPhase): void; onOpenSettings(trigger: HTMLElement): void; settingsOpen: boolean; announcement: string }`. No state. Pure display of `state` (uses `formatClock`). Renders the visually hidden live region with `announcement`.

**`room/components/TimerSettingsPanel.tsx`** — props `{ settings: PomodoroSettings; status: PomodoroStatus; phaseDurationMs: number; onChange(patch: Partial<PomodoroSettings>): void; onRestoreDefaults(): void }`. Local state: per-field draft strings + per-field error. Commits on blur/Enter (§4.5.3). Shows the "applies next phase" hint when `status !== 'idle'` and a changed duration differs from `phaseDurationMs`.

**`room/components/SessionPanel.tsx`** — props `{ goal: ReturnType<typeof useSessionGoal>; tasks: ReturnType<typeof usePersonalTasks> }` (pass the hook return objects). Composes `GoalEditor` (in same file or `GoalEditor.tsx`) and `TaskList` (`TaskList.tsx`). Only local state: `editingTaskId`, `editDraft`, `taskError`, `goalError`.

**`room/components/ParticipantPanel.tsx`** — props `{ participants: RoomParticipantView[]; now: number }`. Sorted with `useMemo` (§4.8). Footer `DemoDataNote`.

**`room/components/ParticipantRow.tsx`** — props `{ participant: RoomParticipantView; now: number }`.

**`R/components/ParticipantAvatar.tsx`** (shared by discovery + room; place at `R/components/`, not under `room/`) — props `{ name: string; src?: string | null; size?: number }` (default 32). State `failed`. Renders `<img>` (plain, `referrerPolicy="no-referrer"`, `alt=""` because the name is adjacent text; discovery stack supplies `aria-label` on the group) or an initials circle; hue = `hash(name) % 360`, `hsl(hue 45% 38%)` background, white text. **No dicebear.**

#### Shared environment

**`room/components/EnvironmentPanel.tsx`** (admin only) — props `{ environment: SharedRoomEnvironment; actions: SharedEnvironmentActions; ambienceStatus: …; mutedForMe: boolean; onToggleMute(): void; onUnlock(): void; onBackgroundSelected?(): void }`. State: `tab: 'background'|'music'|'ambience'` (default `'background'`). Tabs per WAI-ARIA tabs pattern (`role="tablist"`, `role="tab"`, `role="tabpanel"`, arrow-key navigation, Home/End). Header badge "Host controls · changes apply to everyone". Footer: mute-for-me toggle + `DemoDataNote`.

**`room/components/BackgroundTab.tsx`** — props `{ selectedId: BackgroundId; onSelect(id: BackgroundId): void }`.

**`room/components/MusicTab.tsx`** — props `{ music: MusicSource | null; onSet(source: MusicSource | null): void; onNotify(text: string): void }`. State: `value`, `error: MusicParseErrorReason | null`.

**`room/components/AmbienceTab.tsx`** — props `{ ambience: SharedAmbience; status: 'idle'|'playing'|'blocked'|'unsupported'; actions: Pick<SharedEnvironmentActions,'setAmbiencePreset'|'setAmbiencePlaying'|'setAmbienceVolume'> }`.

**`room/components/RoomInfoPanel.tsx`** (member only) — props `{ room: RoomDefinition; environment: SharedRoomEnvironment; ambienceStatus: …; mutedForMe: boolean; onToggleMute(): void; onUnlock(): void }`. **No action props for shared state.** Shows background name + thumbnail (non-interactive `<div>`), music line, ambience line, "Set by {room.adminDisplayName}", the "Only the host can change the room." sentence, mute-for-me toggle, `DemoDataNote`.

**`room/components/MusicPlayerDock.tsx`** — props `{ music: MusicSource; hidden: boolean; onToggleHidden(): void }`. No other state. Renders per §4.4.2.

### 5.5 Hooks, utilities, data (non-visual)

| File | Exports | Notes |
|---|---|---|
| `R/data/backgroundCatalog.ts` | `BACKGROUND_OPTIONS: readonly BackgroundOption[]`, `getBackground(id)` | table in §4.2 |
| `R/data/ambientCatalog.ts` | `AMBIENT_PRESETS: readonly AmbientPreset[]`, `getAmbientPreset(id)` | table in §4.3 |
| `R/data/roomCatalog.ts` | `ROOM_CATALOG: readonly RoomDefinition[]`, `getRoomBySlug(slug: string): RoomDefinition \| undefined` | §6 Stage 1 |
| `R/data/mockRosters.ts` | `MOCK_ROSTERS: Record<RoomSlug, MockPeer[]>` | §6 Stage 1 |
| `R/utils/parseMusicUrl.ts` | `parseMusicUrl(input: string): { ok: true; source: MusicSource } \| { ok: false; reason: MusicParseErrorReason }`, `type MusicParseErrorReason`, `MUSIC_ERROR_MESSAGES` | pure; §4.4.1 |
| `R/utils/formatTime.ts` | `formatClock(totalSeconds)`, `formatElapsed(ms)` | pure |
| `R/utils/deriveParticipants.ts` | `deriveViewer(...)`, `deriveParticipants(...)` | pure; privacy invariant §4.7 |
| `R/utils/pomodoroReducer.ts` | `DEFAULT_POMODORO_SETTINGS`, `SETTING_LIMITS`, `createInitialPomodoroState()`, `pomodoroReducer`, `clampSetting`, `phaseMinutes`, `nextPhaseAfterCompletion` | pure; §4.5 |
| `R/utils/ambientEngine.ts` | `createAmbientEngine(): AmbientEngine \| null` where `AmbientEngine = { setPreset(id\|null, fadeMs?): void; setGain(value01): void; resume(): Promise<boolean>; getState(): 'running'\|'suspended'; dispose(): void }` | returns `null` when no AudioContext; all timers/nodes tracked |
| `R/utils/chime.ts` | `playChime(): void` | extracted from `FocusTimerCard`; creates a context, plays the same C5-E5-G5-C6 chord, **closes the context after 2 s** |
| `R/hooks/useNow.ts` | `useNow(intervalMs)` | `useState(Date.now)` + `setInterval`, cleanup on unmount |
| `R/hooks/usePomodoro.ts` | `usePomodoro(roomTitle: string)` → `{ state, announcement, start, pause, resume, reset, skip, selectPhase, updateSettings, restoreDefaults }` | §4.5 |
| `R/hooks/usePersonalTasks.ts` | `usePersonalTasks()` → `{ tasks, draft, setDraft, error, add, toggle, edit, remove, move(id, dir), clearCompleted }` | §4.6 |
| `R/hooks/useSessionGoal.ts` | `useSessionGoal()` → `{ committed: SessionGoal, draft, setDraft, commit, setVisibility }` | §4.7 |
| `R/hooks/useSharedEnvironment.ts` | `useSharedEnvironment(initial, adminUserId)` → `{ environment, actions }` | each setter stamps `updatedAt = Date.now()`, `updatedByUserId = adminUserId` |
| `R/hooks/useAmbientPlayback.ts` | `useAmbientPlayback({ presetId, volume, isPlaying, mutedForMe })` → `{ status, unlock }` | creates the engine lazily on first `isPlaying` truthy effect; `dispose()` on unmount |

---

## 6. File-by-file implementation plan

Do the stages **in order**. After each stage run its verification; do not start the next stage with red checks. Never edit any file not listed in a stage.

Global commands (run from repo root):
- Unit tests: `npx vitest run src/client/screens/dashboard/studyroom "src/app/(dashboard)/studyroom"`
- Types: `npx tsc --noEmit --incremental false`
- Lint (touched files): `npx eslint <paths>`
- Build (final stage): `node --max-old-space-size=4096 --import ./scripts/register-root-environment.mjs ./node_modules/next/dist/bin/next build --webpack` (this is the command recorded in `MEMORY/play-playback.md`)

### Stage 0 — Baseline (no file changes)
1. Read `MEMORY/README.md` and `MEMORY/play-playback.md` (verified conventions for check commands).
2. Run the global unit tests and `tsc` once; record pre-existing failures so they are not attributed to this work.
**Verify:** baseline recorded.

### Stage 1 — Types, catalogs, mock data (all new, no UI)
Create (no `'use client'`, no React imports):
1. `R/types.ts` — verbatim from §5.2.
2. `R/data/backgroundCatalog.ts` — `BACKGROUND_OPTIONS` exactly per the table in §4.2; `getBackground(id)` throws never: falls back to the `minimal-workspace` entry if the id is unknown (defensive).
3. `R/data/ambientCatalog.ts` — 10 presets per §4.3 table (id/label/icon only; recipes live in the engine).
4. `R/data/roomCatalog.ts` — three rooms:

| slug | title | atmosphere (reuses existing copy) | previewImage | adminUserId | adminDisplayName | default env |
|---|---|---|---|---|---|---|
| `library` | Library | "Silent study & focus" | `/images/studyrooms/library.webp` | `demo-mira` | Mira | background `library`; music `null`; ambience `{ presetId:'rain', volume:40, isPlaying:true }` |
| `fireplace` | Fireplace | "Warm and cozy chats" | `/images/studyrooms/fireplace.webp` | `viewer` (sentinel: current user is admin) | `You` | background `cozy-fireplace`; music `null`; ambience `{ presetId:'fireplace', volume:40, isPlaying:true }` |
| `developer-den` | Developer Den | "Co-working & code reviews" | `null` (gradient of `minimal-workspace`) | `demo-kai` | Kai | background `minimal-workspace`; music `null`; ambience `{ presetId:'brown-noise', volume:35, isPlaying:true }` |

   `defaultEnvironment.updatedAt = 0`, `updatedByUserId = adminUserId`. **No default music** (no real, verifiable video/playlist IDs exist in the repo; do not invent any). Export `getRoomBySlug`.
5. `R/data/mockRosters.ts`:

| room | peers (`userId`, `displayName`, `joinedMinutesAgo`, `publicGoal`) |
|---|---|
| `library` | `demo-mira` Mira 94 "Finish chapter 4 notes"; `demo-jonas` Jonas 38 `null`; `demo-priya` Priya 12 "Revise organic chemistry" |
| `fireplace` | `demo-sam` Sam 55 "Outline thesis intro"; `demo-lena` Lena 7 `null` |
| `developer-den` | `demo-kai` Kai 130 "Ship the auth refactor"; `demo-ada` Ada 61 `null`; `demo-omar` Omar 3 "Fix flaky tests" |

   All `avatarUrl: null`. These are static demonstration data; add a header comment: `// DEMONSTRATION DATA — replace with live presence (see docs/plans/study-rooms-frontend-plan.md §10).`
**Verify:** `tsc` passes; no file under `data/` imports React.

### Stage 2 — Pure utilities with unit tests (depends on 1)
Create:
1. `R/utils/parseMusicUrl.ts` — implement per §4.4.1 using `new URL()`; exact host allow-list; ID regexes; Spotify URI `spotify:(track|playlist):ID`; strip `/intl-xx` path segment; produce `embedUrl` and canonical `originalUrl` (`https://www.youtube.com/watch?v=ID` / `…/playlist?list=LIST` / `https://open.spotify.com/track/ID`). Do **not** import `play/utils/mediaSource.ts` (its `extractYouTubeId` accepts bare IDs and has no playlist support).
2. `R/utils/formatTime.ts` — `formatClock(sec)` → `MM:SS` (minutes ≥ 2 digits, can exceed 59); `formatElapsed(ms)` per §4.8.
3. `R/utils/pomodoroReducer.ts` — per §4.5 including `clampSetting` and the limits.
4. `R/utils/deriveParticipants.ts` — `deriveViewer({ session, room, viewAsOverride })` and `deriveParticipants({ roster, viewer, goal, adminUserId, mountedAt })`; ordering is done in the panel, not here. Implements the privacy invariant (§4.7) and admin rule (§5.3).
5. `R/utils/chime.ts` — move the chord from `FocusTimerCard.tsx` verbatim (notes 523.25/659.25/783.99/1046.5 Hz, same envelopes); add `ctx.close()` after 2 s inside try/catch.
6. Tests in `R/__tests__/` (`/** @vitest-environment node */` is fine):
   - `parseMusicUrl.test.ts`: table-driven — every accepted form in §4.4.1, scheme-less, `http://`, spotify URI, `/intl-fr/` path; rejections: empty, `not a url`, `https://evil.com/watch?v=dQw4w9WgXcQ`, `https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ`, `https://open.spotify.com/album/<22 chars>`, `https://www.youtube.com/@channel`, `javascript:alert(1)`; assert `embedUrl` host is only `www.youtube-nocookie.com` or `open.spotify.com`.
   - `pomodoroReducer.test.ts`: defaults; START/PAUSE/RESUME timing with fake `now`; complete focus → counts and picks short break; 4th completion → long break; break → focus; `autoStartNext` on/off; RESET keeps phase + count; SKIP never counts and focus→short; SELECT_PHASE mid-run; settings change idle vs running (§4.5.6); clamping/NaN rejection; a `TICK` far past `endsAt` produces exactly one transition.
   - `deriveParticipants.test.ts`: private goal → `publicGoal === null` for viewer; `'room'` + text → set; `'room'` + empty text → `null`; peers never expose anything but `publicGoal`; admin flagging for both roles incl. `viewAsOverride`; `joinedAt` math (`mountedAt − minutes·60000`).
   - `formatTime.test.ts`: `formatElapsed` boundaries (0, 59 s, 60 s, 59 m, 60 m, 61 m, 120 m, NaN, negative).
**Verify:** all new tests pass.

### Stage 3 — Personal-state and environment hooks (depends on 1–2)
Create (each `'use client'`-free `.ts` is fine; hooks may be plain modules used by client components):
1. `R/hooks/useNow.ts`.
2. `R/hooks/usePomodoro.ts` — `useReducer(pomodoroReducer, undefined, createInitialPomodoroState)`; interval effect only while running (250 ms, dispatch `TICK`, cleanup); completion effect on `completionSeq` (skip first render via ref) → `playChime()` if `chimeEnabled` + set `announcement`; document-title effect with restore; `start` dispatches `START` with `Date.now()`; etc.
3. `R/hooks/usePersonalTasks.ts` — rules of §4.6 (trim, collapse whitespace, ≤120, ≤50, error strings verbatim).
4. `R/hooks/useSessionGoal.ts` — rules of §4.7; `commit()` trims and clamps to 80; `setVisibility` immediate.
5. `R/hooks/useSharedEnvironment.ts` — `useState(initial)`; `actions` memoized with `useMemo`; `setAmbiencePreset(null)` sets `isPlaying:false`; non-null sets `isPlaying:true`; `setAmbienceVolume` rounds/clamps; `setBackground` no-ops on same id; each setter returns a new object and stamps `updatedAt/updatedByUserId`.
6. Tests: `R/__tests__/usePomodoro.test.tsx` (fake timers + `renderHook`: runs, pauses, completes, auto-advances, interval cleared on unmount — assert `vi.getTimerCount() === 0` after unmount; chime mocked via `vi.mock('../utils/chime')`), `usePersonalTasks.test.tsx` (add/edit/toggle/delete/move/limits/error strings), `useSessionGoal.test.tsx`, `useSharedEnvironment.test.tsx`.
**Verify:** tests pass; no leaked timers.

### Stage 4 — Ambient audio engine and hook (depends on 1)
1. `R/utils/ambientEngine.ts` — implement recipes of §4.3 exactly. Structure: one lazily created `AudioContext`; noise buffers generated once (white/pink/brown, 6 s, mono, `sampleRate` of ctx); `master` gain → destination; `setPreset(id, fadeMs=600)` builds a per-preset sub-graph with its own gain, fades in, and fades out/stops the previous sub-graph then disconnects it and clears its timeouts; `setGain` uses `setTargetAtTime`; `resume()` returns `ctx.state==='running'`; `dispose()` stops everything and `ctx.close()`; returns `null` when `AudioContext`/`webkitAudioContext` is missing.
2. `R/hooks/useAmbientPlayback.ts` — maps `{presetId, volume, isPlaying, mutedForMe}` → engine calls in effects; computes `status` (§4.3.5); exposes `unlock()` (calls `engine.resume()` then re-evaluates status); effect cleanup `dispose()` on unmount; when `isPlaying` false or `presetId` null → `setPreset(null)` (engine fades out) and status `'idle'` (or `'unsupported'`).
3. `R/__tests__/useAmbientPlayback.test.tsx` — in jsdom `AudioContext` is undefined → expect `status==='unsupported'` and no throw; add a second test with a hand-rolled fake `AudioContext` (minimal `createGain/createBufferSource/createBiquadFilter/createOscillator/createBuffer`, `state:'suspended'` then `resume()` flips to `'running'`) asserting `'blocked'` → `unlock()` → `'playing'`, and `dispose` on unmount.
**Verify:** tests pass. (Real audio is verified manually in §9.)

### Stage 5 — Shared UI primitives (depends on 1)
Create:
1. `R/components/ParticipantAvatar.tsx` + `.module.css`.
2. `R/room/components/PanelShell.tsx` + `.module.css` (drawer/sheet, scrim, focus-on-open, `Escape` handled by `RoomScreen`).
3. `R/room/components/RoomToast.tsx` + `.module.css`.
4. `R/room/components/DemoDataNote.tsx` + `.module.css`.
**Verify:** `tsc`; a smoke test `R/__tests__/PanelShell.test.tsx` (renders title, close button calls `onClose`, heading receives focus).

### Stage 6 — Room route, stage, theme, top bar (depends on 1–5)
1. **Modify** `src/client/config/routeThemeConfig.ts`: add `'/studyroom': 'dark',` to `ROUTE_THEME_CONFIG` (preserve the existing comment block; add nothing else).
2. **Create** `src/app/(dashboard)/studyroom/[roomSlug]/page.tsx` — exactly §3.1.
3. **Create** `src/app/(dashboard)/studyroom/[roomSlug]/loading.tsx` — a plain dark stage (no skeleton shapes): `<main><div style={{ minHeight: '100dvh', background: '#000' }} aria-busy="true" /></main>` plus visually hidden text "Entering room"; **use a CSS module** rather than inline style if convenient (`loading.module.css`).
4. **Create** `R/room/RoomScreen.tsx` + `RoomScreen.module.css` — state per §5.3, stage structure per §3.3, panel switching per §3.8, `Escape` handling, leave flow per §4.1, `mutedForMe`, `playerHidden` init (effect using `window.matchMedia('(max-width: 768px)')`), toast plumbing. Panels not yet implemented render a placeholder `<div>` inside `PanelShell` — **remove placeholders as later stages land**.
5. **Create** `R/room/components/RoomBackground.tsx` + css; `RoomTopBar.tsx` + css; `RoomSoundChip.tsx` + css (wire to `useAmbientPlayback` now so audio works early); `LeaveRoomDialog.tsx` + css.
6. `deriveViewer` uses `useSession()` from `next-auth/react` (tests mock it exactly as the existing tests do).
**Verify:** with the dev server (`npm run dev`), `/studyroom/fireplace` shows the fireplace image full-bleed with scrim, title, atmosphere, "You're the host" chip, toolbar, sound chip; ambience plays after a click-through from discovery or via "Tap to start room sound"; `/studyroom/nope` → 404; Leave returns to `/studyroom`. Tests: `R/__tests__/RoomScreen.shell.test.tsx` (mock `next-auth/react`, `next/navigation`'s `useRouter`; assert title, role-dependent label "Customize room" vs "Room info" using `viewAsOverride`, panel toggling closes the previous panel, Escape closes).

### Stage 7 — Personal tools: FocusBar, timer settings, session panel (depends on 3, 5, 6)
1. Create `FocusBar.tsx`, `TimerSettingsPanel.tsx`, `SessionPanel.tsx` (+ `GoalEditor.tsx`, `TaskList.tsx` if split) with CSS modules; wire into `RoomScreen`.
2. Delete `R/components/FocusTimerCard.tsx` (its chime now lives in `utils/chime.ts`; nothing else imports it — `grep -rn FocusTimerCard src` must return nothing but the to-be-rewritten tests).
3. Tests: `FocusBar.test.tsx`, `SessionPanel.test.tsx` (task add/validation/edit/Escape/reorder/clear; goal save and visibility toggle; helper text swap; draft persistence across panel close/open at `RoomScreen` level).
**Verify:** timer counts down in the browser, survives tab throttling (switch tab for 30 s, return: time reflects wall-clock), completes and advances phase; tasks and goal behave per §4.6–4.7.

### Stage 8 — Participants (depends on 2, 5, 6)
1. Create `ParticipantPanel.tsx`, `ParticipantRow.tsx` (+css); wire `participants`, `now`, top-bar pill.
2. Tests: `ParticipantPanel.test.tsx` — order (me, host, then by join time), "Host"/"You" labels, elapsed text updates after `vi.advanceTimersByTime` (fake `Date`), public goal shown only when set; **integration test in `RoomScreen` test**: set goal "Secret plan" Private → open People → text **not** in DOM; switch to Visible → text appears beside "You"; switch back → gone.
**Verify:** manual — elapsed times advance without reload.

### Stage 9 — Shared environment: admin panel, member panel, music dock (depends on 2, 4, 6)
1. Create `EnvironmentPanel.tsx`, `BackgroundTab.tsx`, `MusicTab.tsx`, `AmbienceTab.tsx`, `RoomInfoPanel.tsx`, `MusicPlayerDock.tsx` (+css); wire into `RoomScreen`: `activePanel==='room'` renders `EnvironmentPanel` **iff** `viewer.role==='admin'`, else `RoomInfoPanel`.
2. `RoomScreen` forwards `env.actions` only inside the admin branch; `RoomSoundChip` gets `controls` only for admins.
3. Tests: `EnvironmentPanel.test.tsx` (select background → callback; ambience select/play/volume; music invalid → message + no `setMusic`; valid YouTube + Spotify → `setMusic` called with expected `embedUrl`; tab keyboard navigation), `RoomInfoPanel.test.tsx` (**asserts absence** of `role=radio`, `role=slider`, text input; presence of "Only the host can change the room."), `MusicPlayerDock.test.tsx` (iframe `src` host/`title`/`allow`; Hide unmounts iframe; Show remounts), `RoomScreen.roles.test.tsx` (with `viewAsOverride='member'` there is no "Customize room"/"Set room music" anywhere; with `'admin'` there is; **dock persists when a panel opens/closes**: query the same iframe node before/after).
**Verify:** manual — admin changes background (crossfade), ambience (crossfade, volume), sets a YouTube link (player appears; press play inside player), invalid links show errors; member preview shows read-only info.

### Stage 10 — Discovery rewrite and test updates (depends on 1, 5)
1. **Rewrite** `R/StudyRoomScreen.tsx` and `R/StudyRoomScreen.module.css` (§3.2, §5.4). Delete: API calls, polling, `useSession`, optimistic logic, simulated toasts, toast stack, feed card, timer card, `framer-motion` import.
2. **Rewrite** `R/components/RoomCard.tsx` (+ new `RoomCard.module.css`; stop sharing `StudyRoomScreen.module.css`).
3. **Rewrite** `R/__tests__/StudyRoomScreen.test.tsx` — render discovery: three rooms with names + atmospheres; each has a link `href="/studyroom/{slug}"`; shows "N studying now · demo" counts matching `MOCK_ROSTERS`; no `fetch` calls (`vi.spyOn(global,'fetch')` not called); no `skeleton|shimmer` classes; image error hides image (fire `error` event).
4. **Modify** `src/app/(dashboard)/studyroom/__tests__/studyRoomLoading.test.tsx` — keep the "no skeleton/shimmer" assertions; replace string assertions with "Study Rooms" heading + three room titles; delete the `LIVE WORKSPACE`, `Active Spaces`, `Timer Widget`, `1 Active`, `getByTitle('Alice')` assertions and the fetch mock; keep the `next-auth` mock only if still imported transitively (it isn't — remove).
5. **Modify** `src/app/(dashboard)/studyroom/__tests__/page.test.tsx` — keep both metadata assertions; replace the heading assertion with `screen.getByRole('heading', { name: 'Study Rooms' })`; remove the fetch mock.
6. Confirm `src/app/__tests__/tab-titles.test.ts` still passes unchanged.
**Verify:** the three test files pass; `tsc` passes; `grep -rn "apiUrl\|api/studyroom" src/client/screens/dashboard/studyroom` returns nothing.

### Stage 11 — Responsive and accessibility pass (depends on 6–10)
1. Verify breakpoints 768/1024 per §3.5–3.7 at widths 360, 390, 768, 769, 1023, 1024, 1280, 1920; fix overflow (use `min-width: 0`, `overflow-wrap:anywhere` on user text; **do not** hide overflow to mask bugs).
2. Verify `prefers-reduced-motion`, focus order (§4.9), contrast, and `aria-*` per §9.
3. Run `npx eslint` on every touched/created file; fix issues.
**Verify:** §9 manual checklist.

### Stage 12 — Memory, docs, final verification (depends on all)
1. **Create** `MEMORY/study-rooms.md` (terse, path-first): routes, `R` file map, state ownership (shared vs personal), mock-data locations, removed behavior (`/api/studyroom` detached from UI), known boundaries, check commands. **Modify** `MEMORY/README.md`: add one bullet linking it. No secrets/logs.
2. Run all commands in "Global commands" including the production build. Fix failures.
3. Do **not** modify `docs/study-rooms-schema.md`, Prisma, API, middleware, robots, sidebar.
**Verify:** all green; §9 complete.

---

## 7. Asset and dependency requirements

### 7.1 Existing assets to reuse
| Need | Source | Fallback if missing/failed |
|---|---|---|
| Library background/preview | `public/images/studyrooms/library.webp` | CSS gradient in `backgroundCatalog` (always rendered underneath) |
| Fireplace background/preview | `public/images/studyrooms/fireplace.webp` | gradient |
| Forest background | `public/images/studyrooms/campside.webp` | gradient |
| Ocean/seaside background | `public/images/studyrooms/seaside.webp` | gradient |
| Rainy window, Quiet café, Night sky, Minimal workspace | **No assets exist** | Gradients only (shipped as valid options). **Do not create/download art in this work.** |
| Developer Den preview | none | Gradient of `minimal-workspace` |
| Audio (ambience) | **No files exist** | Procedural Web Audio synthesis (§4.3). Optional `assetUrl` field reserved |
| Chime | synthesized (existing code) | n/a |
| Avatars | initials component | n/a (no dicebear) |
| Fonts | Manrope/Caveat already loaded in `tokens.css` | inherit |
| Icons | `lucide-react` (all confirmed to exist in 1.28.0): `CloudRain, CloudLightning, Flame, Waves, Trees, Wind, Coffee, AudioLines, Users, ListChecks, SlidersHorizontal, Info, LogOut, Play, Pause, RotateCcw, SkipForward, Settings, Check, X, Pencil, Trash2, ChevronUp, ChevronDown, Volume2, VolumeX, Lock, Eye, Music, Target, Timer, Crown, Plus, ExternalLink, Moon` | n/a |

Suggested icon uses: People=`Users`, Session=`ListChecks`, Customize room=`SlidersHorizontal`, Room info=`Info`, Leave=`LogOut`, host chip=`Crown`, timer settings=`Settings`, mute=`Volume2`/`VolumeX`, goal private/visible=`Lock`/`Eye`.

### 7.2 Existing components/utilities to reuse
`@radix-ui/react-dialog` (leave dialog — same usage pattern as `src/client/components/global/CommandPalette/CommandPalette.tsx`), `clsx`, `next/image`, `next/link`, `useRouter` from `next/navigation`, `useSession` from `next-auth/react`, `m`/`AnimatePresence` (optional), design tokens, the chime algorithm.

### 7.3 Dependencies
**No new packages.** No YouTube IFrame API script, no Spotify SDK, no drag-and-drop library, no audio library.

### 7.4 Known asset caveat
The images are portrait/near-square illustrations. Full-bleed `object-fit: cover` on a landscape stage crops a lot; `focal` points mitigate it. Acceptable for the prototype; better landscape art is a follow-up (not blocking).

---

## 8. Edge cases

Each item states the required behavior. Where a test is listed, it is mandatory.

### 8.1 Switching the room background
- Selecting the current background: no-op. Rapid successive selections: only the latest target is shown; the previous-layer timeout is cleared and restarted each change (no stuck overlay layers). Unmount mid-fade: timeout cleared. Reduced motion: instant swap.
- Image still loading when switched away: the stale `onLoad` of a layer that is no longer current must not alter state of the current layer (guard with the layer's `id`).

### 8.2 Switching shared audio sources
- Ambience preset A→B while playing: 600 ms crossfade; old sub-graph's nodes/timeouts are disposed after the fade (no node leak: engine keeps at most 2 sub-graphs at any moment).
- Ambience → None: fade out, status `'idle'`, controls disabled.
- Music A→B: iframe `key` changes → full remount; music B does not auto-start (needs the listener's play press). Music → null: dock unmounts.
- Changing music never affects ambience and vice-versa.

### 8.3 Unsupported or invalid media URLs
Per §4.4.1 table. Additionally: extremely long input is truncated by `maxLength=300`; pasted text with surrounding whitespace/newlines is trimmed; a URL containing both a valid host and unusual query params is accepted if the ID parses; `javascript:`, `data:`, `file:`, `ftp:` schemes → `not-a-url`/`unsupported-host` (never reach an `href`/`src`); a previously valid music source stays active after a failed submission.

### 8.4 Browser playback restrictions
- Web Audio `suspended` → `'blocked'` → "Tap to start room sound" (§4.3.5). Prompt disappears once running.
- Tab hidden: ambience keeps playing (browser default); timer unaffected (timestamp-based).
- Music iframes: autoplay is never attempted by us. Embed errors are invisible to the app → permanent "Trouble playing? Open in …" link.
- Browsers without `backdrop-filter`: `@supports` fallback raises glass opacity (§3.4).
- Browsers without `dvh`: add `min-height: 100vh` before the `dvh` declaration.

### 8.5 Missing background or audio assets
- Background image 404/decode failure → gradient base shown, toast once per background per visit, selection still applied.
- Discovery preview failure → hidden image, gradient remains.
- No audio files exist; the engine needs none. If `AudioContext` is missing → `'unsupported'` messaging; the shared `ambience` state is still stored and displayed.
- A preset id missing from the catalog (corrupt state) → `getAmbientPreset` returns `undefined`; UI shows "Unknown sound" and treats `presetId` as null. `getBackground` falls back to `minimal-workspace`.

### 8.6 Timer settings changed during an active session
Exactly §4.5.6. Test: running 25:00 focus, change focus to 10 → countdown unchanged; Reset → shows 10:00.

### 8.7 Timer completion and automatic phase changes
- Natural completion always advances `phase`, resets `remainingMs`, plays chime (if enabled), announces, and (if `autoStartNext`) continues running without a user gesture. Without auto-start the new phase is idle and the primary button reads "Start".
- Background throttling: completion detected on the next tick after `endsAt`; the displayed time never goes below 00:00; only one transition occurs per tick.
- System clock changes: `endsAt` is absolute; a backwards clock jump lengthens the remaining time by that amount; a forward jump may complete early. Accepted limitation; not mitigated.
- Chime blocked by the browser: swallowed silently (try/catch); the visual announcement still occurs.
- `longBreakEvery` changed mid-cycle: uses the new value at the next completion (`completed % every`); counts preserved.
- Skip at a long-break boundary does not grant or revoke a long break.
- Timer at 00:00 can never be "running" (completion transitions it).

### 8.8 Empty or invalid task inputs
Empty/whitespace → "Write something first." Over 120 chars: blocked by `maxLength`, and hook-level truncation guard returns an error. 50-task cap with message. Editing to empty keeps edit mode. Pasting multi-line text collapses newlines to spaces. HTML in text renders as plain text (React escapes). Rapid double-submit: draft cleared synchronously so the second submit is empty → error, not a duplicate.

### 8.9 Public-to-private goal changes
Same-render removal from participant data (§4.7). If the goal text is cleared while Visible → `publicGoal` becomes `null`; visibility value stays `'room'` (so retyping publishes again — the helper text makes this explicit). Test required (Stage 8).

### 8.10 Missing participant data
Handled per §4.8 ("Guest", initials fallback, invalid `joinedAt` → "Just joined"). A roster key missing for a slug → treated as empty roster; the viewer row still renders. `session` null (should not occur behind middleware) → viewer `{ userId:'demo-viewer', displayName:'You', avatarUrl:null }`.

### 8.11 Responsive overflow and conflicting panels
- Only one panel at a time (§3.8). Opening the leave dialog closes panels.
- Long room titles/goal/task text: `min-width:0`, ellipsis (single-line titles) or `overflow-wrap:anywhere` (goals/tasks).
- Short viewports (e.g., 360×640 mobile landscape): bottom stack may be taller than the stage → bottom stack gets `max-height: 60%; overflow-y: auto`; the music dock defaults collapsed so this rarely occurs.
- On mobile the iOS keyboard resizing the viewport: panel body scrolls; the add-task row is `position: sticky; bottom: 0`.
- Bottom nav overlap on mobile handled via `--bottom-nav-height`/`--safe-area-bottom`.
- Window resized across 768: `useExperience` swaps nav; the stage recomputes via CSS only (no JS layout state except `playerHidden`'s *initial* value, which is **not** re-evaluated on resize).

### 8.12 Unmounting, cleanup and session lifetime
On unmount of `RoomScreen`: pomodoro interval cleared; document title restored; `useNow` interval cleared; ambient engine `dispose()` (stops nodes, clears timeouts, closes context); toast timeout cleared; background fade timeout cleared; music iframe removed with the DOM (music stops). A vitest "no leaked timers" check (`vi.getTimerCount()===0` after `unmount()` with fake timers) is mandatory in `RoomScreen` tests.
Personal and admin state is **not persisted**: refresh/leave/re-enter resets timer, tasks, goal, and the room environment to the catalog default. This is deliberate (frontend-only, §1.6) and stated in the leave dialog. Do **not** add `localStorage`/`sessionStorage`.

### 8.13 Misc
- Two admin sessions diverging: impossible in the prototype (one browser); future sync is §10's job.
- `viewAs` with an unknown value → ignored.
- Strict Mode double-invoked effects (dev): all effects must be idempotent with cleanup (interval/engine creation inside effects, never at module scope; no `AudioContext` created during render).
- SSR/hydration: `RoomScreen` is a client component but is still server-rendered once. Never read `window`/`matchMedia` during render. `Date.now()`-derived text (participant elapsed time) would differ between server and client, so render elapsed text only after mount: keep a `mounted` state set in a `useEffect`, and render `—` for elapsed time until it is true. `playerHidden` defaults to `false` on first render and is corrected in an effect.

---

## 9. Acceptance tests

Automated (vitest) unless marked **[manual]**. Mark each item done only when verified.

### 9.1 Room entry and discovery
- [ ] `/studyroom` renders heading "Study Rooms" and three cards: Library, Fireplace, Developer Den, each with atmosphere text, preview (image or gradient) and "N studying now · demo".
- [ ] No `fetch` call is made by the discovery screen; no timers run (`vi.getTimerCount()===0` after render).
- [ ] Each card links to `/studyroom/{slug}`; keyboard Tab reaches exactly one link per card; Enter activates.
- [ ] Failed preview image leaves a gradient, no broken icon.
- [ ] `/studyroom/library` renders the room; `/studyroom/unknown` returns 404 (**[manual]** or page-level test of `notFound`).
- [ ] Leave from a room with no personal state returns to `/studyroom` immediately; with personal state a confirmation dialog appears; **Stay** keeps everything, **Leave room** navigates.

### 9.2 Admin-only environment controls
- [ ] `viewAs=admin`: toolbar shows "Customize room"; panel has tabs Background / Music / Ambience; badge "Host controls · changes apply to everyone".
- [ ] `viewAs=member`: toolbar shows "Room info"; the DOM contains **no** background radios, ambience radios, volume slider, or music input anywhere (query by role across the whole document, panel open and closed).
- [ ] Member-visible components never receive `SharedEnvironmentActions` (code review + type check: `RoomInfoPanel` props contain no action types).
- [ ] Member still has "Mute room sound for me" and it does not alter the displayed shared state.

### 9.3 Shared configuration presentation
- [ ] Selecting a background (admin) updates the stage background for the viewer immediately; thumbnail shows selected state (checked radio, ring, check badge).
- [ ] Ambience preset switch changes `environment.ambience` and chip text; volume slider changes `ambience.volume`; Pause sets `isPlaying=false` and chip text "Paused".
- [ ] Setting a valid YouTube video, YouTube playlist, Spotify track, Spotify playlist URL renders `MusicPlayerDock` with the expected iframe `src` host (`www.youtube-nocookie.com` / `open.spotify.com`) and correct `title`.
- [ ] No music selected ⇒ no iframe and no player placeholder in the DOM.
- [ ] Opening/closing any panel does not remount the music iframe (same DOM node).
- [ ] Hide player unmounts the iframe; Show remounts it.
- [ ] Copy states that each listener presses play in the player (Music tab and Room info).

### 9.4 Individual timer and tasks
- [ ] Defaults 25/5/15/4 shown; Start→Pause→Resume→Reset behave per §4.5.1 (fake timers + `vi.setSystemTime`).
- [ ] Completing focus #1–#3 yields short breaks; #4 yields a long break; breaks return to focus; counter text "N focus sessions this visit" correct.
- [ ] Auto-start off: phase changes, status idle; on: continues running.
- [ ] Duration edits: clamp, NaN revert, idle applies immediately, running defers (hint shown).
- [ ] Selecting a phase mid-run resets that phase; Skip never increments the counter.
- [ ] Timer state is local: two `RoomScreen` instances (or a re-mount) do not share state (no module-level mutable state — assert by rendering twice).
- [ ] Tasks: add (Enter + button), trim/collapse, empty error, 120-char limit, 50 cap, toggle/untoggle, edit (Enter/Escape/empty), delete, reorder via buttons (disabled at ends), clear completed, empty state text, "x of y done".
- [ ] Tasks never appear in any participant-facing structure (assert `participants` JSON contains no task text).

### 9.5 Public/private goals
- [ ] Default visibility is Private.
- [ ] Private goal "Secret plan": People panel DOM does not contain "Secret plan"; `deriveParticipants` output for all rows has no occurrence of it.
- [ ] Switch to "Visible to room": text appears beside "You" in the same render; switch back: removed.
- [ ] Peer goals appear only where `publicGoal !== null`.
- [ ] Goal max 80 chars; commit on Enter/blur/Save; helper text swaps per visibility.

### 9.6 Participant durations
- [ ] Elapsed time derives from `joinedAt` (mock `joinedMinutesAgo`) — fake time forward 61 s → "Just joined" becomes "1m" for a just-joined user; Mira "1h 34m" at start becomes "1h 35m" after 60 s tick window (15 s `useNow` interval).
- [ ] Order: you, host, others by join time ascending.
- [ ] "You" pill and (admin viewer) "Host" label present as text.
- [ ] Demo-data note visible in People panel.

### 9.7 Audio failure states
- [ ] jsdom (no `AudioContext`): status `'unsupported'`, message shown, controls disabled, no exceptions.
- [ ] Fake suspended context: "Tap to start room sound" appears; clicking it resumes and hides the prompt.
- [ ] Mute-for-me sets engine gain to 0 and shows muted indicator; unmute restores.
- [ ] Unmount disposes engine and leaves zero timers.
- [ ] **[manual]** In Chrome and Safari: every preset audibly plays after a user gesture, switching crossfades without clicks/pops, volume slider is smooth, leaving the room silences audio.

### 9.8 Keyboard accessibility
- [ ] Tab order: top bar → toolbar → open panel → FocusBar → music dock; no keyboard traps; leave dialog traps/restores focus (Radix).
- [ ] `Escape` closes the open panel and focus returns to its trigger.
- [ ] Background and ambience selectors operable with arrow keys + Space (native radios); environment tabs with Left/Right/Home/End.
- [ ] Task list fully operable without a mouse (edit, delete, reorder, complete).
- [ ] All icon-only buttons have accessible names; `aria-pressed`/`aria-expanded`/`aria-checked` reflect state; errors use `role="alert"`; timer completion is announced via the polite live region.
- [ ] **[manual]** Screen-reader spot check (NVDA or VoiceOver): panel titles announced; timer completion announced; goal visibility change announced via helper text.
- [ ] **[manual]** Contrast: text on glass ≥ 4.5:1 over each of the 8 backgrounds (check with a contrast tool on the brightest region: seaside and forest are the risk).

### 9.9 Responsiveness **[manual]**
- [ ] 360×640, 390×844, 768×1024, 1024×768, 1280×800, 1920×1080: no horizontal scroll; no overlapping persistent elements; FocusBar always reachable; only one panel open.
- [ ] Mobile: sheet panels above `MobileNav`, scrim closes, tap targets ≥ 44 px, music dock defaults collapsed.
- [ ] Desktop: drawer overlays right, timer remains visible while drawer is open.
- [ ] `prefers-reduced-motion` removes crossfades and hover transforms.

### 9.10 Regression checks
- [ ] `src/app/__tests__/tab-titles.test.ts` passes unchanged (Study Rooms title).
- [ ] `src/app/api/studyroom/__tests__/route.test.ts` passes unchanged; `git diff --stat` shows **no** changes under `src/app/api/`, `prisma/`, `src/server/`, `src/middleware.ts`, `next.config.ts`, `package.json`, `package-lock.json`.
- [ ] Other dark routes (`/play`, `/explore`, `/message`, `/notes`) unaffected by the one-line route-theme addition; `/home` remains light.
- [ ] `grep -rn "centrifugo\|WebSocket\|EventSource\|new Worker" src/client/screens/dashboard/studyroom` → empty. `grep -rn "api/studyroom\|apiUrl" src/client/screens/dashboard/studyroom` → empty. `grep -rn "localStorage\|sessionStorage" src/client/screens/dashboard/studyroom` → empty.
- [ ] No simulated activity remains (`grep -rn "Math.random" ...` appears **only** in `utils/ambientEngine.ts`).

### 9.11 Build verification
- [ ] `npx tsc --noEmit --incremental false` clean.
- [ ] `npx eslint` clean on touched files.
- [ ] `npx vitest run src/client/screens/dashboard/studyroom "src/app/(dashboard)/studyroom" src/app/__tests__/tab-titles.test.ts src/app/api/studyroom` green.
- [ ] `node --max-old-space-size=4096 --import ./scripts/register-root-environment.mjs ./node_modules/next/dist/bin/next build --webpack` succeeds.

---

## 10. Future Centrifugo boundary

Not part of this work: real-time sync, authorization, persistence, DB reads/writes, Centrifugo, WebSockets. This section only marks where replacement will happen so the prototype is not rewritten later.

| Concern | Prototype today | Future integration point |
|---|---|---|
| Room list + counts | `ROOM_CATALOG`, `MOCK_ROSTERS.length` in `R/data/*` consumed by `StudyRoomScreen` | Replace with a data hook (e.g. `useStudyRoomDirectory`) backed by the existing `GET /api/studyroom` (re-adding the ETag/hidden-tab polling logic deleted in Stage 10 — see git history of `R/StudyRoomScreen.tsx`) and/or a Centrifugo channel for counts. `RoomCard` props already match a view-model, not DB types. |
| Presence (who is in the room) | `deriveParticipants({ roster: MOCK_ROSTERS[slug], … })` | Replace `roster` with live presence; keep `deriveParticipants` and `RoomParticipantView` as the UI contract. Real join: `RoomParticipant.joinedAt` already exists in the DB and is returned by the current GET (just not typed on the client). Join/leave: existing `POST /api/studyroom` semantics (one room per user) |
| Shared environment | `useSharedEnvironment(initial, adminUserId)` (local `useState`) | Swap the `useState` for server state: **read** = subscription to a room-environment channel; **write** = admin-authorized mutation. Keep the hook's return shape `{ environment, actions }`; `updatedAt`/`updatedByUserId` exist for ordering/audit. Persistent storage requires new columns (background, music, ambience, admin) — a future backend task |
| Admin/creator role | `RoomDefinition.adminUserId` + `deriveViewer` + `?viewAs` | Server-provided `ownerId`/permissions; delete `viewAsOverride` and the `'viewer'` sentinel; enforce on the server — UI gating stays as UX only |
| Public goals | Viewer's goal derived into `publicGoal`; peers' `publicGoal` static | Publish `{userId, publicGoal}` via presence payload **only when** `visibility==='room'` (never send private goals); subscribe to peers' updates |
| Ambient play/pause + volume | Local shared state drives local Web Audio | Authoritative state arrives from the environment channel; each client still needs its own user gesture to unlock audio (`'blocked'` handling stays) |
| Music source | `MusicSource` set locally; each listener presses play | Source selection syncs via the same channel. Synchronized *playback position* would require provider player APIs — out of scope even then unless explicitly planned |
| Personal timer/tasks/goal text | React state | Stay local by product definition; optional per-user persistence later (separate backend decision) |
| Elapsed time | `joinedAt` from mock | `joinedAt` from presence/DB; formatting utilities unchanged |

Do **not** add: any `centrifuge` import, subscription, token endpoint, WebSocket/SSE/polling for room state, server actions, API routes, Prisma changes, or feature flags in this work.

---

## 11. Execution checklist

Follow in order; do not re-decide anything listed in this plan.

1. [ ] Read `MEMORY/README.md`, then this plan end-to-end. Run baseline tests + `tsc` (Stage 0).
2. [ ] Stage 1: create `R/types.ts`, `R/data/{backgroundCatalog,ambientCatalog,roomCatalog,mockRosters}.ts` exactly as specified (no invented music IDs).
3. [ ] Stage 2: implement pure utils + their unit tests (`parseMusicUrl`, `formatTime`, `pomodoroReducer`, `deriveParticipants`, `chime`). Tests green.
4. [ ] Stage 3: implement hooks (`useNow`, `usePomodoro`, `usePersonalTasks`, `useSessionGoal`, `useSharedEnvironment`) + tests; confirm no leaked timers.
5. [ ] Stage 4: implement `ambientEngine` + `useAmbientPlayback` + tests (unsupported + fake-context paths).
6. [ ] Stage 5: `ParticipantAvatar`, `PanelShell`, `RoomToast`, `DemoDataNote`.
7. [ ] Stage 6: add `'/studyroom': 'dark'` to `routeThemeConfig.ts`; create `[roomSlug]/page.tsx` + `loading.tsx`; build `RoomScreen`, `RoomBackground`, `RoomTopBar`, `RoomSoundChip`, `LeaveRoomDialog`; panel switching + Escape.
8. [ ] Stage 7: `FocusBar`, `TimerSettingsPanel`, `SessionPanel` (+`GoalEditor`, `TaskList`); delete `FocusTimerCard.tsx`.
9. [ ] Stage 8: `ParticipantPanel`, `ParticipantRow`; private/public goal integration tests.
10. [ ] Stage 9: `EnvironmentPanel` (+ three tabs), `RoomInfoPanel`, `MusicPlayerDock`; role-gating tests (member DOM has no shared-setting controls; dock persists across panels).
11. [ ] Stage 10: rewrite discovery (`StudyRoomScreen`, `RoomCard`, CSS) and update the three test files; confirm `tab-titles.test.ts` unchanged and passing.
12. [ ] Stage 11: responsive + accessibility pass at all listed widths; eslint clean.
13. [ ] Stage 12: write `MEMORY/study-rooms.md`, add the bullet to `MEMORY/README.md`; run tsc, eslint, vitest (listed paths), production build.
14. [ ] Final greps from §9.10 all clean; `git diff --stat` shows only files named in this plan; nothing under `src/app/api/`, `prisma/`, `src/server/`, `src/middleware.ts`, `next.config.ts`, `package.json` changed.
15. [ ] Report: what was built, manual checks performed (audio in a real browser, responsive widths), and any deviations (there should be none; if a decision here proved impossible, state it explicitly instead of improvising).
