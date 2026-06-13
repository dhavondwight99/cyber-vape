---
name: Neon Nebula
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393d'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b20'
  surface-container: '#1e1f24'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343439'
  on-surface: '#e3e2e7'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e3e2e7'
  inverse-on-surface: '#2f3035'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#ebb2ff'
  on-secondary: '#520072'
  secondary-container: '#b600f8'
  on-secondary-container: '#fff6fc'
  tertiary: '#e9ffa8'
  on-tertiary: '#283500'
  tertiary-container: '#bbea00'
  on-tertiary-container: '#506600'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#f8d8ff'
  secondary-fixed-dim: '#ebb2ff'
  on-secondary-fixed: '#320047'
  on-secondary-fixed-variant: '#74009f'
  tertiary-fixed: '#c3f400'
  tertiary-fixed-dim: '#abd600'
  on-tertiary-fixed: '#161e00'
  on-tertiary-fixed-variant: '#3c4d00'
  background: '#121317'
  on-background: '#e3e2e7'
  surface-variant: '#343439'
  surface-charcoal: '#191A1F'
  surface-slate: '#404040'
  glow-cyan: rgba(0, 240, 255, 0.4)
  glow-purple: rgba(188, 19, 254, 0.4)
  glass-fill: rgba(25, 26, 31, 0.6)
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 64px
    fontWeight: '800'
    lineHeight: 72px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  price-display:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style
The design system is a high-octane, futuristic visual framework tailored for a premium vape retail experience. It captures a "Cyber-Luxe" aesthetic, blending the deep, atmospheric shadows of a midnight cityscape with the high-energy pulse of neon illumination. The target audience is modern, tech-savvy, and style-conscious.

The design style is a hybrid of **Glassmorphism** and **High-Contrast Bold**. It relies on the interplay between dark, textured surfaces and vibrant, glowing accents to create a sense of depth and premium quality. UI elements appear as though they are projected onto semi-transparent glass, emitting a soft light that bleeds into the charcoal surroundings, mimicking the vapor and light found in a modern lounge environment.

## Colors
This design system utilizes a "Void & Neon" palette. The foundation is built on `#121317` to provide maximum contrast for the emissive accent colors. 

- **Primary (Cyan):** Used for primary actions, active navigation states, and "cool" flavor profiles.
- **Secondary (Electric Purple):** Used for promotional banners, premium product tiers, and complex interactive elements.
- **Tertiary (Lime):** Reserved for highlights, stock availability, or "fresh" product categories.
- **Glow Effects:** Every primary and secondary interactive element should feature a drop-shadow or outer-glow using the `glow-` variants to simulate light emission.
- **Glass Tint:** Use `glass-fill` for container backgrounds to allow the background "neon clouds" to subtly permeate the UI layers.

## Typography
The typography strategy balances futuristic geometric forms with technical precision. 

- **Headlines (Sora):** Set with tight letter-spacing to feel impactful and modern. Display sizes should occasionally use text-shadow glows in primary colors for "Hero" sections.
- **Body (Inter):** Highly legible at all sizes to balance the aggressive display type. 
- **Labels (JetBrains Mono):** The monospaced font provides a "spec-sheet" or technical feeling, ideal for battery wattages, nicotine levels, and technical product details.

## Layout & Spacing
The system uses a **Fluid Grid** model with generous internal padding to maintain the "airy" feel of glassmorphism.

- **Desktop:** 12-column grid with 24px gutters. Content is centered within a 1280px max-width container.
- **Mobile:** 4-column grid. Margins are reduced to 20px. 
- **Rhythm:** All spacing (margins, padding) must be multiples of the 8px base unit. 
- **Reflow:** Product cards transition from 4-across on desktop to 2-across on tablet, and a single-column scroll on mobile.

## Elevation & Depth
Depth is created through **Glassmorphism** and **Backdrop Blurs** rather than traditional black shadows.

1.  **Level 0 (Base):** The dark charcoal background with animated "neon gas" blurs.
2.  **Level 1 (Cards/Containers):** Semi-transparent surfaces (`glass-fill`) with a `20px` backdrop-filter blur and a `1px` stroke (white at 10% opacity).
3.  **Level 2 (Modals/Popups):** Higher transparency, a `40px` backdrop-blur, and a soft outer glow in the primary or secondary color to lift the element off the base.
4.  **Interactive Glow:** On hover, buttons and cards should increase their "glow" intensity via a `box-shadow` that uses the accent color with high diffusion (e.g., `0 0 20px rgba(0, 240, 255, 0.4)`).

## Shapes
The shape language is "Soft-Tech." Elements use a 0.5rem (8px) radius as a standard to feel modern but approachable. 

- **Standard Buttons/Inputs:** 0.5rem (Rounded).
- **Featured Product Cards:** 1rem (Large).
- **Badges/Chips:** Full pill-shape for organic contrast against the geometric grid.

## Components

### Buttons
- **Primary:** Solid fill with `primary_color_hex`. Text is black for maximum contrast. On hover, apply a `15px` outer glow of the same color.
- **Ghost:** `1px` border of `primary_color_hex` with a subtle `5%` color fill.

### Input Fields
- Dark backgrounds with a `1px` bottom-only border by default. On focus, the border transitions to the primary color and emits a soft glow, with the label floating upwards in `label-caps` style.

### Cards (Product)
- Background: `glass-fill`.
- Border: `1px` solid `rgba(255,255,255,0.1)`.
- Image: Should have a "floating" appearance with a subtle colored drop-shadow corresponding to the product color.

### Chips (Flavors/Tags)
- Small, pill-shaped elements with a secondary color border. For "Active" filters, use a solid neon fill.

### Glow Borders
- Specifically for "Featured" items, use a linear-gradient border that transitions from Primary to Secondary colors, giving it a "RGB" gaming aesthetic.

### Lists
- Clean rows separated by low-opacity lines (`#404040` at 50%). Technical specs (e.g., "70/30 VG/PG") use the `label-font` for a technical look.
