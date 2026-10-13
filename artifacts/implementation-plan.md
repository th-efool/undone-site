# Implementation & Verification Architecture (Agent E)

## 1. Architectural Strategy
The reconstructed landing page will be built as a modular, responsive React component system inside the existing Next.js App Router codebase:

```
src/client/screens/landing/ReconstructedHero/
├── index.ts
├── ReconstructedHero.tsx          # Master composition container
├── ReconstructedHero.module.css   # Pixel-accurate layout, positioning, z-indices
├── components/
│   ├── HeaderNav.tsx              # Top navigation bar
│   ├── CentralInterface.tsx       # Heading, input card, 4 action tiles, pill buttons
│   ├── CollageLeft.tsx            # Left-hand photo, tape, dried flower, mountains, moon
│   ├── CollageRight.tsx           # Right-hand galaxy, curious sheet, crane, mug, dome
│   └── Flourishes.tsx             # SVG star doodles, brush underline, accent curves
```

Integrated directly into:
`src/app/(landing)/page.tsx`

---

## 2. Asset Preparation Pipeline
A deterministic Node.js extraction script will isolate the exact high-fidelity image fragments from `artifacts/reference.jpg` into `public/images/hero-collage/`:
- `l1-window-photo.png`
- `l2-ideas-paper.png`
- `l3-botanical.png` (with alpha channel)
- `l4-mountains.png`
- `l5-curiosity-note.png`
- `l6-moon-circle.png`
- `l7-blue-scrap.png`
- `r1-galaxy.png`
- `r2-curious-tomorrow.png`
- `r3-disciplines.png`
- `r4-origami-crane.png` (with alpha channel)
- `r5-map-scrap.png`
- `r6-mug-books.png`
- `r7-cathedral.png`
- `r8-collect-repeat.png`
- `r9-blue-banner.png`
- `paper-bg.webp`

---

## 3. Responsive Scaling Model
- **Primary Target Desktop (1024px – 1440px+)**: Exact 1:1 proportional reproduction with fixed element relationships. Outer collage elements pinned using percentage/clamped margins to prevent viewport collisions.
- **Tablets (768px – 1023px)**: Scale collage elements down by 20%, maintain central interactive hierarchy.
- **Mobile (< 768px)**: Central column stacks gracefully; background collage adapts into a subtle atmospheric perimeter without interfering with touch targets.

---

## 4. Verification Workflow (Playwright & Diffing)
1. Start Next.js development server on `localhost:3000`.
2. Launch Playwright browser session with strict viewport: `1024 × 522` (and DPR = 1).
3. Navigate to `http://localhost:3000`.
4. Capture full viewport screenshot to `artifacts/render-preview.png`.
5. Compare side-by-side with `artifacts/reference.jpg`.
6. Inspect and correct spatial deviations.
