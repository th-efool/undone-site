# Layout & Geometry Specification (Agent A)

## 1. Coordinate System & Grid
- **Master Reference Viewport**: `1024px` width × `522px` height.
- **Reference Canvas Ratio**: `1.9617 : 1`.
- **Scaling Model**: 
  - Central functional column: clamped `max-w-[560px]`, centered horizontally (`mx-auto`).
  - Outer collage: fixed-proportional coordinate system pinned to viewport edges (`left-0`, `right-0`, `top-0`, `bottom-0`) with overflow handling (`overflow-hidden`).

---

## 2. Central Interface Geometry

### Header (`<header>`)
- **Width**: `100%`, max-width `820px`, centered.
- **Y-Position**: `top: 14px`.
- **Height**: `36px`.
- **Logo Position**: Left offset `X: 0px` relative to header container.
  - Compass mark: `22px × 22px`.
  - Brand typography: `18px` font size.
  - Tagline: `9px` font size, `margin-top: -2px`.
- **Navigation Links**:
  - Horizontal list centered between logo and CTA.
  - Item gap: `24px`.
  - Font size: `11.5px`, line-height: `1`.
- **Sign In & CTA**:
  - Right aligned.
  - "Sign in": `11.5px`, right margin `16px`.
  - "Get Started" button: `74px × 28px`, border-radius `14px`, padding `0 14px`.

### Hero Text Block
- **Eyebrow ("A MORE CURIOUS YOU")**:
  - Center Y: `84px`.
  - Font size: `9px`, tracking `0.26em`, uppercase.
- **Main Heading ("What do you want \n to explore?")**:
  - Line 1: `Y: 104px - 146px`. Height `42px`, font size `40px`, line height `1.05`.
  - Line 2: `Y: 146px - 188px`. Height `42px`, font size `40px`, italic emphasis on `explore?`.
  - Underline flourish: `width: 140px`, `height: 10px`, placed `2px` below `explore` text baseline.
- **Subtitle ("Turn a curiosity, skill, or question into a learning journey.")**:
  - Center Y: `198px`.
  - Font size: `13px`, line-height `1.4`.

### Input Card
- **Box Dimensions**: `width: 426px`, `height: 60px`.
- **Placement**: Centered horizontally (`left: calc(50% - 213px)`), `top: 220px`.
- **Border Radius**: `16px`.
- **Internal Elements**:
  - Left padding: `14px`. Plus button: `28px × 28px` circle.
  - Input field: `flex: 1`, font size `12px`, padding `0 12px`.
  - Right controls:
    - Lightbulb + "Plan": `16px` icon, `11px` label, `margin-right: 12px`.
    - "Begin journey →" button: `108px × 34px`, border-radius `17px`, font size `11px`.

### Action Tiles (4-Grid)
- **Container**: `width: 384px`, centered horizontally, `top: 296px`.
- **Tile Geometry**: `4` columns with `gap: 24px`.
  - Icon square: `42px × 42px`, border-radius `10px`, background `#1E2899`.
  - Icon size: `20px × 20px`, white stroke `1.75px`.
  - Label: `margin-top: 6px`, 2 lines:
    - Top line: `11px`, bold `#0E1635`.
    - Bottom line: `10px`, regular `#596378`.

### Divider & Sources
- **Divider Line**: `width: 360px`, centered, `top: 386px`.
  - Text badge: "or start with something you have", `font-size: 10px`, `padding: 0 10px`, background `#F5EFE6`.
- **Pill Buttons Row**:
  - Centered horizontally, `top: 406px`.
  - Gap: `12px`.
  - Button 1 ("Add sources"): `width: 108px`, `height: 30px`.
  - Button 2 ("Upload a file"): `width: 112px`, `height: 30px`.
  - Button 3 ("Use a template"): `width: 114px`, `height: 30px`.
  - Border radius: `15px`.

### Footer Affordance
- **Position**: Centered, `bottom: 12px` (`top: ~492px`).
- Chevron + "See how it works", `font-size: 11px`.

---

## 3. Peripheral Collage Boundaries & Stacking Z-Index
```
Z-Index Hierarchy:
Z-0:  Canvas texture background
Z-10: R1 Galaxy, L4 Mountain Base, L7 Blue Scrap, R9 Blue Ribbon
Z-20: L1 Window Photo, R5 Vintage Map, R6 Mug/Books, R7 Cathedral
Z-30: L2 Kraft Paper List, R2 "A more curious tomorrow", R8 List, L6 Moon
Z-40: L3 Botanical Herbarium, R4 Origami Crane, Tape strips
Z-50: Decorative blue linework and star doodles
Z-60: Central Header, Hero text, Input Card, Tiles, Pills (Interactable layer)
```
