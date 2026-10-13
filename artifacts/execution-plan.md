# Execution Plan: Pixel-Accurate Landing Page Hero Reconstruction (Phase 2 Planning Gate)

## 1. Existing Project Architecture & Target Route
- **Framework**: Next.js 16.2.11 (App Router) + React 19.2.4 + Tailwind CSS v4.
- **Route**: `src/app/(landing)/page.tsx` rendering inside `src/app/(landing)/layout.tsx` and `src/app/layout.tsx`.
- **Pre-configured Fonts in Layout**: `Playfair_Display`, `Lora`, `Caveat`, `Dancing_Script`, `Manrope`, `Geist`.

---

## 2. Reference Geometry & Regions
- **Reference Resolution**: `1024 × 522 px` (Aspect ratio `1.9617 : 1`).
- **Header**: `top: 14px`, height `36px`, max-width `820px` centered.
- **Hero Typography**: Eyebrow at `Y: 84px`, 2-line heading at `Y: 104px - 188px`, subtitle at `Y: 198px`.
- **Input Card**: `width: 426px`, `height: 60px`, centered at `Y: 220px`.
- **4 Action Tiles**: Centered at `Y: 296px`, `42px × 42px` royal blue cards with two-line labels.
- **Divider & 3 Pills**: `Y: 386px` and `Y: 406px` with pill buttons (Add sources, Upload a file, Use a template).
- **Collage Boundaries**: Pinned to left (`X: -40px` to `210px`) and right (`X: 680px` to `1024px+`) margins, layered outside the central reading flow.

---

## 3. Asset Strategy & Processing
All image assets will be extracted with pixel precision from the ground-truth master image `artifacts/reference.jpg` into `public/images/hero-collage/`:
1. `paper-bg.webp`: Warm fibrous cream paper canvas.
2. `l1-window-photo.png`: Woman by window with handwritten text and masking tape.
3. `l2-ideas-paper.png`: Tilted torn kraft paper with vertical list.
4. `l3-botanical.png`: Pressed dried wild flower specimen (alpha cutout).
5. `l4-mountains.png`: Snow-capped mountain polaroid.
6. `l5-curiosity-note.png`: "Curiosity lives a longer life." scrap.
7. `l6-moon-circle.png`: Lunar surface circle.
8. `l7-blue-scrap.png`: Torn cobalt paper.
9. `r1-galaxy.png`: Cosmic galaxy crop.
10. `r2-curious-tomorrow.png`: "A more curious tomorrow." note with star doodle.
11. `r3-disciplines.png`: Vertical discipline strip.
12. `r4-origami-crane.png`: 3D royal blue origami crane (alpha cutout).
13. `r5-map-scrap.png`: Vintage cartographic blueprint fragment.
14. `r6-mug-books.png`: Coffee mug on books ("Good Ideas Travel Far").
15. `r7-cathedral.png`: Ornate dome architecture.
16. `r8-collect-repeat.png`: Collect, Learn, Create, Repeat scrap.
17. `r9-blue-banner.png`: "Different Paths Same Sky" blue banner.
18. `underline-flourish.svg`: Clean vector brush underline under "*explore*".
19. `star-doodle.svg`: Clean vector star doodles.

---

## 4. Typography & Color Choices
- **Display Serif**: `Playfair Display` (`--font-playfair-display`, weight 600) for heading and brand.
- **Subtitles & Descriptions**: `Lora` (`--font-lora`, italic) and `Manrope` (`--font-manrope-next`).
- **Handwritten Notes**: `Caveat` (`--font-caveat-next`, weight 700) and `Dancing Script`.
- **Palette**:
  - Ink Navy: `#0E1738`
  - Royal Blue: `#1F299D`
  - Cream Background: `#F5EFE6`
  - Card Surface: `#FFFFFF`
  - Dividers: `#DDD6C9`
  - Muted Text: `#5A6478`
  - Eyebrow Taupe: `#8E867A`

---

## 5. Component Architecture
```
src/client/screens/landing/ReconstructedHero/
├── index.ts
├── ReconstructedHero.tsx          # Main composition container
├── ReconstructedHero.module.css   # Pixel-accurate layout and absolute coordinates
├── components/
│   ├── HeaderNav.tsx              # Top navigation bar
│   ├── CentralInterface.tsx       # Text, search input, 4 tiles, divider, pill buttons
│   ├── CollageLeft.tsx            # Left-side layered collage
│   ├── CollageRight.tsx           # Right-side layered collage
│   └── Flourishes.tsx             # SVG star doodles, brush underline, accent curves
```

---

## 6. Execution Phases
1. **Phase 3**: Asset slicing script execution & asset library generation in `public/images/hero-collage/`.
2. **Phase 4**: Implement `HeaderNav.tsx` and `CentralInterface.tsx`.
3. **Phase 5**: Implement `CollageLeft.tsx`, `CollageRight.tsx`, `Flourishes.tsx`, and `ReconstructedHero.tsx`. Mount into `src/app/(landing)/page.tsx`.
4. **Phase 6**: Start development server, run Playwright browser verification at `1024 × 522`, capture screenshot, compare against `artifacts/reference.jpg`, and perform iterative calibration.
5. **Phase 7 & 8**: Visual audit and responsive refinement.

---

## 7. Files Added / Modified
- **Added**:
  - `artifacts/reference.jpg`
  - `artifacts/reference-analysis.md`
  - `artifacts/layout-spec.md`
  - `artifacts/asset-research.md`
  - `artifacts/collage-spec.md`
  - `artifacts/design-system.md`
  - `artifacts/implementation-plan.md`
  - `artifacts/execution-plan.md`
  - `scripts/extract-hero-assets.mjs`
  - `public/images/hero-collage/*`
  - `src/client/screens/landing/ReconstructedHero/*`
- **Modified**:
  - `src/app/(landing)/page.tsx`
