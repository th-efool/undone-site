# Design System & Interface Specification (Agent D)

## 1. Color Palette Tokens

```css
:root {
  /* Canvas & Physical Paper Surfaces */
  --color-canvas-bg: #F5EFE6;
  --color-canvas-card: #FFFFFF;
  --color-canvas-border: #DFD8CD;
  --color-divider-line: #DDD6C9;

  /* Brand Inks */
  --color-ink-primary: #0E1738;
  --color-ink-secondary: #3B4356;
  --color-ink-muted: #5A6478;
  --color-ink-eyebrow: #8E867A;
  --color-ink-placeholder: #8A92A3;

  /* Royal & Cobalt Blue Accents */
  --color-blue-action: #1F299D;
  --color-blue-hover: #192182;
  --color-blue-tile: #1E2899;
  --color-blue-paper: #1B3593;

  /* Shadows */
  --shadow-input-card: 0 4px 20px -2px rgba(14, 23, 56, 0.07), 0 2px 6px -1px rgba(14, 23, 56, 0.04);
  --shadow-tile: 0 2px 6px rgba(31, 41, 157, 0.25);
  --shadow-paper-scrap: 0 4px 12px rgba(30, 20, 10, 0.12), 0 1px 3px rgba(30, 20, 10, 0.08);
}
```

---

## 2. Typography Token Mapping

| Hierarchy Level | Font Family | Size | Weight | Line Height | Tracking | Color |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Heading (Line 1)** | `var(--font-playfair-display)` | `42px` | `600` | `1.05` | `-0.02em` | `#0E1738` |
| **Hero Heading (Line 2)** | `var(--font-playfair-display)` | `42px` | `600` (Italic on explore) | `1.05` | `-0.02em` | `#1F299D` |
| **Hero Eyebrow** | `var(--font-manrope-next)` | `9px` | `700` | `1.0` | `0.28em` | `#8E867A` |
| **Hero Subtitle** | `var(--font-lora)`, `serif` | `13px` | `400` | `1.4` | `0` | `#363E52` |
| **Brand Wordmark** | `var(--font-playfair-display)` | `18px` | `600` | `1.0` | `-0.01em` | `#0E1738` |
| **Brand Tagline** | `var(--font-caveat-next)` | `9.5px` | `700` | `1.0` | `0` | `#4B556D` |
| **Navigation Links** | `var(--font-manrope-next)` | `11.5px` | `500` | `1.0` | `0` | `#3B4356` |
| **Input Placeholder** | `var(--font-manrope-next)` | `12px` | `400` | `1.0` | `0` | `#8A92A3` |
| **CTA Button Text** | `var(--font-manrope-next)` | `11px` | `600` | `1.0` | `0` | `#FFFFFF` |
| **Action Tile Title** | `var(--font-manrope-next)` | `11px` | `700` | `1.2` | `0` | `#0E1635` |
| **Action Tile Subtitle**| `var(--font-manrope-next)` | `10px` | `400` | `1.2` | `0` | `#596378` |
| **Pill Button Text** | `var(--font-manrope-next)` | `10.5px` | `500` | `1.0` | `0` | `#1D2752` |
| **Handwritten Scraps** | `var(--font-caveat-next)` | `12-14px` | `700` | `1.15` | `0` | `#1A202C` |

---

## 3. Micro-Component Geometry

### Plus Action Button
```css
.input-plus-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #DFD8CD;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3B4356;
}
```

### 4 Action Square Tiles
```css
.action-tile-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--color-blue-tile);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  box-shadow: 0 2px 6px rgba(30, 40, 153, 0.25);
}
```
