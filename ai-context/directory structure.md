Directory Structure
.
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
├── ai-context/
│   └── directory structure
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   ├── window.svg
│   └── images/
│       └── logos/
│           └── sidequesthq-logo.webp
└── src/
├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── styles/
│   │   ├── accessibility.css
│   │   ├── buttons.css
│   │   ├── forms.css
│   │   ├── layout.css
│   │   ├── print.css
│   │   ├── reset.css
│   │   ├── tokens.css
│   │   └── typography.css
│   ├── (auth)/
│   │   └── auth/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── settings/page.tsx
│   │   └── sessions/
│   │       ├── page.tsx
│   │       └── [id]/page.tsx
│   └── (landing)/
│       ├── layout.tsx
│       ├── loading.tsx
│       └── page.tsx
├── client/
│   ├── components/
│   │   ├── global/
│   │   │   ├── Footer/
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── footer.css
│   │   │   ├── Logo/
│   │   │   │   ├── Logo.tsx
│   │   │   │   └── logo.css
│   │   │   ├── Navbar/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   └── navbar.css
│   │   │   └── layout/
│   │   │       ├── Cluster.tsx
│   │   │       ├── Container.tsx
│   │   │       ├── Grid.tsx
│   │   │       ├── Section.tsx
│   │   │       ├── SectionHeader.tsx
│   │   │       ├── Stack.tsx
│   │   │       └── Surface.tsx
│   │   ├── screens/
│   │   │   └── landing/
│   │   │       ├── 01-hero/
│   │   │       │   ├── Hero.tsx
│   │   │       │   └── index.ts
│   │   │       ├── 02-ikigai/
│   │   │       │   ├── Ikigai.tsx
│   │   │       │   └── index.ts
│   │   │       ├── 03-problem/
│   │   │       │   ├── Problem.tsx
│   │   │       │   └── index.ts
│   │   │       ├── 04-community/
│   │   │       │   ├── Community.tsx
│   │   │       │   └── index.ts
│   │   │       ├── 05-Features/
│   │   │       │   ├── Features.tsx
│   │   │       │   └── index.ts
│   │   │       └── 06-footer/
│   │   │           ├── Footer.tsx
│   │   │           └── index.ts
│   │   ├── theme/
│   │   │   └── theme.tsx
│   │   └── ui/
│   │       ├── Badge/Badge.tsx
│   │       ├── Button/
│   │       │   ├── Button.css
│   │       │   └── Button.tsx
│   │       ├── Divider/Divider.tsx
│   │       └── Typography/
│   │           ├── Heading.tsx
│   │           └── Text.tsx
│   ├── hooks/
│   │   ├── useSession.ts
│   │   └── useSessions.ts
│   ├── react-query/query-client.ts
│   └── redux/store.ts
├── server/
│   ├── adapters/http/middleware/logger.ts
│   ├── domain/
│   │   ├── session/
│   │   │   ├── session.services.ts
│   │   │   └── session.types.ts
│   │   └── user/user.types.ts
│   └── infrastructure/
│       ├── auth/
│       │   ├── getUser.ts
│       │   └── requireUser.ts
│       └── db/
│           ├── mongodb/
│           │   ├── client.ts
│           │   └── schema.prisma.ts
│           └── postgres/
│               ├── client.ts
│               ├── schema/index.ts
│               └── repositories/
│                   ├── session.repo.ts
│                   └── user.repo.ts
└── shared/
├── constants/app.constants.ts
└── lib/
├── errors/AppError.ts
├── utils/
│   ├── calculateScore.ts
│   └── formatDate.ts
└── validators/
├── session.validator.ts
└── user.validator.ts

# Component Library

## Layout

### Container
**Path:** `src/client/components/global/layout/Container.tsx`

**Purpose:** Width-constrained wrapper.

#### Props
- `size` — Max width preset.
- `as` — Rendered element/component.
- Standard `div` HTML props.

#### Variants
None

#### Sizes
- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `reading`
- `hero`
- `wide`
- `full`

---

### Stack
**Path:** `src/client/components/global/layout/Stack.tsx`

**Purpose:** Vertical flex layout with configurable gap and alignment.

#### Props
- `as` — Rendered element/component.
- `gap` — Vertical spacing token.
- `align` — CSS `align-items`.
- Standard `div` HTML props.

#### Variants
None

#### Sizes
None

---

### Cluster
**Path:** `src/client/components/global/layout/Cluster.tsx`

**Purpose:** Horizontal/wrapping flex layout.

#### Props
- `as` — Rendered element/component.
- `gap` — Spacing token.
- `justify` — CSS `justify-content` preset.
- `align` — CSS `align-items` preset.
- `wrap` — Enable/disable flex wrapping.
- Standard `div` HTML props.

#### Variants
None

#### Sizes
None

---

### Section
**Path:** `src/client/components/global/layout/Section.tsx`

**Purpose:** Page section wrapper with spacing and background options.

#### Props
- `as` — Rendered element/component.
- `spacing` — Vertical padding preset.
- `background` — Background style preset.
- `hero` — Full-height centered hero mode.
- Standard `section` HTML props.

#### Variants
- `transparent`
- `surface`
- `subtle`
- `brand`
- `momentum`
- `gradient`
- `glass`

#### Sizes
- `none`
- `xs`
- `sm`
- `md`
- `lg`
- `xl`

---

### Surface
**Path:** `src/client/components/global/layout/Surface.tsx`

**Purpose:** Card/panel surface wrapper.

#### Props
- `as` — Rendered element/component.
- `variant` — Visual surface style.
- `radius` — Border radius preset.
- `padding` — Inner spacing preset.
- Standard `div` HTML props.

#### Variants
- `default`
- `subtle`
- `outlined`
- `elevated`
- `glass`
- `brand`

#### Sizes
None

---

### SectionHeader
**Path:** `src/client/components/global/layout/SectionHeader.tsx`

**Purpose:** Reusable section heading block with optional eyebrow, description, and actions.

#### Props
- `eyebrow` — Optional badge content.
- `title` — Required heading content.
- `description` — Optional lead text.
- `actions` — Optional action node.
- `align` — Text/layout alignment.
- `maxWidth` — Maximum width CSS value.
- Standard `div` HTML props (excluding native `title`).

#### Variants
None

#### Sizes
None

---

# UI Components

## Button
**Path:** `src/client/components/ui/Button/Button.tsx`

**Purpose:** Reusable button component.

#### Props
- `variant` — Visual style.
- `size` — Button size.
- `loading` — Disabled loading state with spinner.
- `fullWidth` — Block/full-width mode.
- `iconOnly` — Icon-only styling.
- `as` — Rendered element/component.
- Standard `button` HTML props.

#### Variants
- `primary`
- `secondary`
- `ghost`
- `outline`
- `momentum`
- `danger`

#### Sizes
- `xs`
- `sm`
- `md`
- `lg`
- `xl`

---

## Badge
**Path:** `src/client/components/ui/Badge/Badge.tsx`

**Purpose:** Inline status/category label.

#### Props
- `variant` — Color style.
- `size` — Badge size.
- Standard `span` HTML props.

#### Variants
- `brand`
- `momentum`
- `success`
- `warning`
- `danger`
- `neutral`

#### Sizes
- `sm`
- `md`
- `lg`

---

## Divider
**Path:** `src/client/components/ui/Divider/Divider.tsx`

**Purpose:** Horizontal or vertical rule.

#### Props
- `vertical` — Render vertical divider.
- `inset` — Inset horizontal width.
- Standard `hr` HTML props.

#### Variants
None

#### Sizes
None

---

## Heading
**Path:** `src/client/components/ui/Typography/Heading.tsx`

**Purpose:** Typography heading with level-based styles.

#### Props
- `level` — Heading level/style scale.
- `as` — Rendered element override.
- Standard HTML element props.

#### Variants
None

#### Sizes
- `1`
- `2`
- `3`
- `4`
- `5`
- `6`

---

## Text
**Path:** `src/client/components/ui/Typography/Text.tsx`

**Purpose:** Typography text component.

#### Props
- `variant` — Text style.
- `as` — Rendered element/component.
- Standard paragraph HTML props.

#### Variants
- `body`
- `lead`
- `small`
- `muted`

#### Sizes
None

---

# Global Components

## Logo
**Path:** `src/client/components/global/Logo/Logo.tsx`

**Purpose:** Linked SideQuestHQ logo/wordmark.

#### Props
- `href` — Link destination.
- `compact` — Hide tagline.
- `iconOnly` — Hide text.
- `className` — Logo wrapper class.
- `priority` — Declared prop; image currently always receives priority.

#### Variants
- `compact`
- `icon-only`

#### Sizes
None

---

## Navbar
**Path:** `src/client/components/global/Navbar/Navbar.tsx`

**Purpose:** Landing/global header with navigation links and CTA.

#### Props
- `links` — Navigation link array (`{ label, href }`).
- `sticky` — Sticky header class toggle.
- `transparent` — Transparent header class toggle.
- `ctaLabel` — CTA button text.
- `ctaHref` — CTA link destination.
- `className` — Header class.

#### Variants
- `sticky`
- `transparent`

#### Sizes
None

---

## Footer
**Path:** `src/client/components/global/Footer/Footer.tsx`

**Purpose:** Global footer with logo, navigation, social links, and legal links.

#### Props
- `description` — Footer description text.
- `navigation` — Navigation link array (`{ label, href }`).
- `social` — Social link array (`{ label, href }`).

#### Variants
None

#### Sizes
None

---

# Landing Screen Components

## Hero
**Path:** `src/client/components/screens/landing/01-hero/Hero.tsx`

**Purpose:** Landing hero section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Ikigai
**Path:** `src/client/components/screens/landing/02-ikigai/Ikigai.tsx`

**Purpose:** Landing Ikigai section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Problem
**Path:** `src/client/components/screens/landing/03-problem/Problem.tsx`

**Purpose:** Landing problem section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Community
**Path:** `src/client/components/screens/landing/04-community/Community.tsx`

**Purpose:** Landing community section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Features
**Path:** `src/client/components/screens/landing/05-Features/Features.tsx`

**Purpose:** Landing features section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Landing Footer
**Path:** `src/client/components/screens/landing/06-footer/Footer.tsx`

**Purpose:** Landing footer section shell.

#### Props
None

#### Variants
None

#### Sizes
None