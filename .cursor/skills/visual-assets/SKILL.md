---
name: visual-assets
description: >-
  Designs consistent site graphics: SVG illustrations, patterns, gradient-mesh
  backgrounds, icon sets, and image-generation prompts. Use when the site looks
  flat, uses generic stock, or the user asks for illustrations, icons, hero art,
  or visual assets.
---
# Visual assets

## Steps
1. Lock one illustration style for the whole site before generating anything.
2. For in-product graphics:

```
Design the visual layer for [section] in the chosen aesthetic: create [inline SVG illustration | abstract geometric pattern | gradient-mesh background with subtle grain overlay | custom icon set in one stroke style (1.5px, rounded caps)].
Keep it lightweight (pure SVG/CSS, < 20KB), uses the palette CSS variables, decorative elements aria-hidden, works on dark and light.
Add depth: layered transparencies, one dramatic shadow, a decorative border or shape that breaks the section edge.
```

3. For an image generator (Midjourney, GPT-image, etc.):

```
[Subject] for a [brand] website hero, [style: e.g. editorial flat illustration / soft 3D clay / grainy risograph], palette [#hex, #hex, #hex], generous negative space on the [left] for headline text, consistent lighting, no text, 16:9, high detail.
```

4. Leave empty space for headlines; export photos as WebP/AVIF; keep icons as SVG.
5. Reuse palette CSS variables; mark decorative art `aria-hidden`.
