# Asset Research & Manifest (Agent B)

## 1. Asset Strategy & Extraction Source
The reference screenshot `artifacts/reference.jpg` provides 1:1 ground truth evidence for every physical collage fragment, its exact photographic crop, lighting, film grain, paper aging, and hand-lettering.
Rather than using generic stock photos that deviate from the composition, our strategy is:
1. **High-Fidelity Extraction & Precision Isolation**: Extract individual collage regions directly from the high-res master reference.
2. **Alpha Matte Processing**: Generate clean transparent PNGs for non-rectangular elements (pressed flower, origami crane, tape strips, torn edges).
3. **Deterministic Local Storage**: Store all processed assets in `public/images/hero-collage/` to guarantee deterministic local rendering without third-party dependencies.
4. **SVG Vector Flourishes**: Handcraft precise SVGs for line doodles, star accents, underline brush, and brand logos for crisp multi-resolution rendering.

---

## 2. Inventory of Target Assets

| ID | Element Name | Dimensions | Format | Local Target Path | Extraction Coordinates `[x, y, w, h]` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A-BG** | Cream Fiber Paper Canvas | 1024 × 522 | WEBP | `/images/hero-collage/paper-bg.webp` | Background sample & synthesis |
| **A-L1** | Girl at Window (B&W Photo) | 240 × 290 | PNG | `/images/hero-collage/l1-window-photo.png` | `[0, 0, 240, 290]` |
| **A-L2** | Ideas/People Paper Scrap | 120 × 130 | PNG | `/images/hero-collage/l2-ideas-paper.png` | `[75, 230, 125, 135]` |
| **A-L3** | Dried Pressed Botanical Plant | 70 × 100 | PNG | `/images/hero-collage/l3-botanical.png` | `[10, 265, 75, 105]` (Transparent) |
| **A-L4** | Snowy Mountain Peaks Photo | 145 × 165 | PNG | `/images/hero-collage/l4-mountains.png` | `[0, 345, 145, 165]` |
| **A-L5** | "Curiosity lives..." Scrap | 100 × 80 | PNG | `/images/hero-collage/l5-curiosity-note.png`| `[30, 435, 105, 85]` |
| **A-L6** | Lunar Surface Circle | 80 × 80 | PNG | `/images/hero-collage/l6-moon-circle.png` | `[112, 395, 82, 85]` |
| **A-L7** | Torn Cobalt Blue Scrap | 75 × 100 | PNG | `/images/hero-collage/l7-blue-scrap.png` | `[135, 265, 75, 100]` |
| **A-R1** | Cosmic Galaxy Photo | 230 × 140 | PNG | `/images/hero-collage/r1-galaxy.png` | `[810, 0, 214, 140]` |
| **A-R2** | "A more curious tomorrow" | 135 × 175 | PNG | `/images/hero-collage/r2-curious-tomorrow.png`| `[750, 55, 140, 180]` |
| **A-R3** | Art/Science Disciplines Strip | 95 × 95 | PNG | `/images/hero-collage/r3-disciplines.png` | `[895, 135, 100, 100]` |
| **A-R4** | Blue Folded Origami Crane | 70 × 85 | PNG | `/images/hero-collage/r4-origami-crane.png`| `[775, 240, 75, 90]` (Transparent) |
| **A-R5** | Vintage Cartographic Map | 95 × 115 | PNG | `/images/hero-collage/r5-map-scrap.png` | `[730, 315, 95, 120]` |
| **A-R6** | Mug on Books ("Good Ideas") | 210 × 190 | PNG | `/images/hero-collage/r6-mug-books.png` | `[835, 205, 189, 195]` |
| **A-R7** | Classical Cathedral Dome | 135 × 150 | PNG | `/images/hero-collage/r7-cathedral.png` | `[805, 365, 140, 155]` |
| **A-R8** | Collect/Learn/Repeat Scrap | 105 × 120 | PNG | `/images/hero-collage/r8-collect-repeat.png`| `[915, 360, 109, 125]` |
| **A-R9** | "Different Paths" Blue Banner | 120 × 105 | PNG | `/images/hero-collage/r9-blue-banner.png` | `[675, 410, 125, 110]` |
| **A-TP** | Translucent Masking Tape | 60 × 24 | PNG | `/images/hero-collage/tape-strip.png` | Alpha-isolated tape texture |
| **A-UL** | Wavy Blue Underline Flourish | 144 × 12 | SVG | `/images/hero-collage/underline-flourish.svg`| Handcrafted vector SVG |
| **A-ST** | Celestial Star Doodles | 24 × 24 | SVG | `/images/hero-collage/star-doodle.svg` | Handcrafted vector SVG |

---

## 3. License & Provenance Verification
- All generated assets will reside in `public/images/hero-collage/`.
- No hotlinked remote URLs.
- Completely self-contained within project repository.
