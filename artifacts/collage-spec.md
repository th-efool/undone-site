# Collage & Image-Treatment Specification (Agent C)

## 1. Physical Collage Principles
The design simulates a physical tabletop / journal collage where individual scrapbooking elements have tactile material existence:
1. **Paper Layers**: Differing paper weights, fiber roughness, and torn white-core margins.
2. **Depth & Elevation**: Soft ambient contact shadows (`0 2px 8px rgba(25, 20, 15, 0.12)`) and elevated drop shadows (`0 8px 24px rgba(20, 15, 10, 0.15)`) representing uneven paper curling.
3. **Imperfect Rotations**: Non-zero subtle tilts (from `-6°` to `+5°`) to avoid machine-perfect grid rigidity.
4. **Natural Fasteners**: Translucent masking tape attached at corners with frosted opacity and textured ragged ends.
5. **Multi-Medium Blending**: Mixed monochrome photography, deep space photography, cobalt blue colored art paper, pressed organic flora, and folded 3D origami.

---

## 2. Element-by-Element Construction

### Left Collage Complex
- **L1 (Woman at Window)**:
  - Dimensions: `240px × 290px`.
  - Position: `top: 0px`, `left: -30px`.
  - Transform: `rotate(2.5deg)`.
  - Tape: Top-left corner (`left: 50px, top: 12px, rotate(-40deg)`) and bottom-left edge.
  - Annotation: White script text overlaid onto sweater area.
- **L2 (Kraft List Scrap)**:
  - Position: `top: 240px`, `left: 82px`.
  - Transform: `rotate(-1.5deg)`.
  - Shadow: `box-shadow: 2px 4px 12px rgba(0,0,0,0.1)`.
- **L3 (Botanical Flower Specimen)**:
  - Position: `top: 275px`, `left: 15px`.
  - Transform: `rotate(8deg)`.
  - Layer: Elevated above L1 and L2 (`z-index: 40`).
- **L4 (Mountains Polaroid)**:
  - Position: `bottom: 0px`, `left: -20px`.
  - Transform: `rotate(-4deg)`.
  - Shadow: `box-shadow: 0 4px 18px rgba(0,0,0,0.16)`.
- **L5 (Curiosity Note)**:
  - Position: `bottom: 12px`, `left: 36px`.
  - Transform: `rotate(3deg)`.
- **L6 (Moon Circle)**:
  - Position: `bottom: 30px`, `left: 118px`.
  - Mask: `border-radius: 50%`.
- **L7 (Torn Cobalt Blue Scrap)**:
  - Position: `top: 270px`, `left: 142px`.
  - Transform: `rotate(-6deg)`.

### Right Collage Complex
- **R1 (Cosmic Galaxy)**:
  - Position: `top: 0px`, `right: 0px`.
  - Transform: `none` (anchored to top-right corner).
- **R2 ("A more curious tomorrow" Sheet)**:
  - Position: `top: 60px`, `right: 140px`.
  - Transform: `rotate(-4.5deg)`.
  - Shadow: Deep paper lifting shadow along the left and bottom edge.
- **R3 (Disciplines Strip)**:
  - Position: `top: 142px`, `right: 32px`.
  - Transform: `rotate(0deg)`.
- **R4 (Blue Origami Crane)**:
  - Position: `top: 250px`, `right: 178px`.
  - Layer: Casts contact shadow onto underlying map and paper (`z-index: 40`).
- **R5 (Vintage Map)**:
  - Position: `top: 325px`, `right: 195px`.
  - Transform: `rotate(5deg)`.
- **R6 (Mug on Books)**:
  - Position: `top: 215px`, `right: 0px`.
  - Transform: `rotate(1.5deg)`.
- **R7 (Cathedral Dome)**:
  - Position: `bottom: 0px`, `right: 80px`.
  - Transform: `rotate(-1.5deg)`.
- **R8 (Collect/Repeat Scrap)**:
  - Position: `bottom: 35px`, `right: 0px`.
  - Transform: `rotate(2deg)`.
- **R9 (Blue Ribbon Banner)**:
  - Position: `bottom: 10px`, `right: 228px`.
  - Transform: `rotate(-8deg)`.

---

## 3. Masking Tape Recipe
```css
.tape-strip {
  position: absolute;
  background: rgba(244, 238, 224, 0.72);
  backdrop-filter: blur(1px);
  border: 1px solid rgba(220, 210, 190, 0.4);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  /* Irregular torn ends via clip-path */
  clip-path: polygon(
    2% 0%, 98% 2%, 100% 98%, 98% 100%,
    3% 97%, 0% 50%
  );
}
```
