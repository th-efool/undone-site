# Reference Analysis: SideQuestHQ / Undone Landing Page Hero

## 1. Reference Image Metadata
- **Source File**: `artifacts/reference.jpg` (Original: `media_1791045257265.jpg`)
- **Native Dimensions**: 1024 × 522 pixels
- **Aspect Ratio**: 1.9617 : 1 (approx. 2:1 widescreen desktop)
- **Primary Comparison Viewport**: 1024 × 522 px (and 1024 × 512 px standard)
- **Aesthetic Classification**: Editorial tactile paper collage, physical scrapbooking, high-end literary & exploratory discovery platform.

---

## 2. Global Palette & Material Tokens
| Element | Hex / CSS | Material Description |
| :--- | :--- | :--- |
| **Canvas Background** | `#F5EFE6` (`#FAF6F0` to `#EFE7DA`) | Warm vintage cream fibrous paper with subtle tactile grain |
| **Primary Navy Brand** | `#0E1738` | Deep midnight navy used for headlines, logo, and active text |
| **Accent Royal/Cobalt Blue** | `#202CA3` / `#1E3AA8` | High-chroma royal blue for tiles, CTA button, "explore" emphasis, origami crane, and torn scraps |
| **Muted Text / Secondary** | `#596378` / `#6F788A` | Subtitles, button labels, and secondary UI copy |
| **Eyebrow / Warm Taupe** | `#8F877B` | Uppercase category eyebrows and vintage paper stamps |
| **Card Surface** | `#FFFFFF` / `#FCFBF9` | Clean off-white rounded card with `box-shadow: 0 4px 24px rgba(14,23,56,0.06)` |
| **Border Linework** | `#DFD9CE` / `#B0B8C6` | Subtle dividers, input outline, and pill button borders |
| **Masking Tape** | `rgba(235, 226, 208, 0.65)` | Semi-translucent frosted paper tape with irregular ends |

---

## 3. Typography Hierarchy
1. **Logo Wordmark**: "SideQuestHQ" in Serif/Humanist Roman (~18px, weight 600, `#0E1738`) + handwritten subtitle "For a more curious you." (~9px, Dancing Script/Caveat).
2. **Top Navigation**: "Explore", "Features", "Community", "Pricing", "Sign in" (~11px, weight 500, Manrope/Geist, `#3B4356`).
3. **Eyebrow**: "A MORE CURIOUS YOU" (~9px, uppercase, letter-spacing `0.28em`, `#8F877B`).
4. **Hero Heading**:
   - Line 1: "What do you want" (~42px, Playfair Display / Lora, weight 600, `#0E1738`).
   - Line 2: "to *explore*?" ("to" in `#0E1738`, "*explore*" in `#202CA3` italic serif + hand-drawn wavy blue underline flourish).
5. **Hero Subtitle**: "Turn a curiosity, skill, or question into a learning journey." (~13px, regular, `#363E52`).
6. **Input Box**: Placeholder "I want to learn about..." (~12px, `#8A92A3`), "Plan" (~11px, `#2B3650`), "Begin journey →" (~11px, white bold).
7. **Action Tiles**: 4 royal blue cards with two-line labels: "Explore / a topic", "Learn / a skill", "Research / a question", "Build / something" (Top line bold 11px `#0E1635`, bottom line 10px `#596378`).
8. **Handwritten Scraps**:
   - Left Photo: "Same questions. A brighter you."
   - Left Note: "Curiosity lives a longer life."
   - Upper Right: "A more curious tomorrow."
   - Lower Right Mug: "Good Ideas Travel Far"
   - Lower Right Note: "Collect \n Learn \n Create \n Repeat"
   - Lower Right Blue Banner: "Different Paths Same Sky"

---

## 4. Region & Stacking Decomposition
```
+---------------------------------------------------------------------------------------------------------+
| [L1: Window Photo (tilted)]     [Header: Logo | Nav | CTA]                  [R1: Galaxy Photo]          |
|    "Same questions..."                                                      [R2: "A more curious..."]   |
|                                 [Eyebrow: "A MORE CURIOUS YOU"]             [R3: Disciplines List]      |
| [L2: Paper List: IDEAS...]      [Heading: "What do you want to explore?"]                               |
| [L3: Botanical Specimen]        [Subtitle: "Turn a curiosity..."]           [R4: Blue Origami Crane]    |
|                                 [Input: "I want to learn about..."]         [R5: Vintage Map Scrap]     |
| [L4: Mountain Peaks Photo]                                                  [R6: Coffee Mug & Books]    |
| [L5: "Curiosity lives..."]      [4 Tiles: Explore, Learn, Research, Build]  [R7: Cathedral Dome]        |
| [L6: Lunar Crater Sphere]       [Divider: "or start with something..."]     [R8: Collect, Learn...]     |
| [L7: Torn Cobalt Paper]         [Pill Buttons: Add sources | Upload | Temp] [R9: Different Paths...]    |
|                                 [Footer: "See how it works ∨"]                                          |
+---------------------------------------------------------------------------------------------------------+
```

---

## 5. Viewport Coordinate Mapping (Normalized to 1024 × 522 px)
| Element ID | Normalized Left / Right | Normalized Top / Bottom | Width × Height | Rotation / Clip |
| :--- | :--- | :--- | :--- | :--- |
| **Header** | X: 190px - 795px | Y: 14px - 44px | 605px × 30px | 0° (Fixed horizontal) |
| **Hero Eyebrow** | Center X: 512px | Y: 82px | Auto | 0° |
| **Hero Headline** | Center X: 512px | Y: 105px - 180px | ~480px × 75px | 0° |
| **Hero Subtitle** | Center X: 512px | Y: 195px | ~440px × 20px | 0° |
| **Input Surface** | Center X: 512px | Y: 220px - 282px | 424px × 62px | 0° (Radius 16px) |
| **4 Action Tiles** | X: 325px - 700px | Y: 295px - 375px | 4 × (42px × 42px + text) | 0° |
| **Pill Buttons** | Center X: 512px | Y: 408px - 438px | 3 × (100px-110px × 30px) | 0° (Radius 20px) |
| **L1 (Woman at Window)** | X: -40px to 190px | Y: 0 to 280px | ~230px × 280px | +2.5° (Taped top & bottom) |
| **L2 (Left Paper Scrap)** | X: 80px to 195px | Y: 235px to 360px | 115px × 125px | -1.5° (Torn ragged bottom) |
| **L3 (Botanical Plant)** | X: 10px to 75px | Y: 270px to 360px | 65px × 90px | +10° |
| **L4 (Mountains Photo)** | X: -30px to 110px | Y: 350px to 510px | 140px × 160px | -4.0° |
| **L5 (Curiosity Note)** | X: 35px to 130px | Y: 440px to 515px | 95px × 75px | +3.0° |
| **L6 (Moon Sphere)** | X: 115px to 190px | Y: 400px to 480px | 75px × 75px | 0° (Circle mask) |
| **L7 (Torn Cobalt Scrap)**| X: 140px to 210px | Y: 270px to 365px | 70px × 95px | -6.0° |
| **R1 (Galaxy Photo)** | X: 820px to 1024px+| Y: 0 to 130px | ~220px × 130px | 0° (Corner clipped) |
| **R2 (Curious Tomorrow)** | X: 755px to 885px | Y: 60px to 230px | 130px × 170px | -4.5° (Torn paper shadow) |
| **R3 (Disciplines Strip)**| X: 900px to 990px | Y: 140px to 230px | 90px × 90px | 0° |
| **R4 (Origami Crane)** | X: 780px to 845px | Y: 245px to 325px | 65px × 80px | Royal blue 3D folded |
| **R5 (Map Scrap)** | X: 735px to 825px | Y: 320px to 430px | 90px × 110px | +5.0° |
| **R6 (Mug & Books Photo)**| X: 840px to 1024px+| Y: 210px to 390px | ~200px × 180px | +2.0° |
| **R7 (Cathedral Dome)** | X: 810px to 940px | Y: 370px to 515px | 130px × 145px | -1.0° |
| **R8 (Collect/Learn...)** | X: 920px to 1024px+| Y: 365px to 480px | ~100px × 115px | Vertical scrap |
| **R9 (Blue Banner)** | X: 680px to 795px | Y: 415px to 515px | 115px × 100px | Diagonal banner ribbon |
