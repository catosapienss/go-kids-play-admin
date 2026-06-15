# Brand Assets

The application reads the official Go Kids Play visual identity from this
folder. The files below are referenced by `src/lib/brand.ts` and surfaced
across the app through `<BrandLogo />` / `<BrandMark />`.

If a file is missing the UI automatically falls back to a tasteful violet
gradient + Baby icon — nothing breaks, the layout stays intact.

## Required files

| Path                       | Used for                                                  | Recommended size |
| -------------------------- | --------------------------------------------------------- | ----------------- |
| `logo.png`                 | Default everywhere (login, sidebar, TV, mobile splash)    | 512 × 512 (square, transparent edges OK) |
| `logo-mark.png` (optional) | Icon-only variant for very tight spaces (≤ 32 px)         | 128 × 128 |
| `logo-dark.png` (optional) | Override for dark-on-dark surfaces if `logo.png` washes out | 512 × 512 |
| `favicon.png`              | Browser tab + PWA icon source                              | 512 × 512 |
| `apple-touch-icon.png`     | iOS home-screen icon                                       | 180 × 180 |

## Steps to activate the real logo

1. Drop the official `logo.png` into this folder.
2. (Optional) Generate a 180 × 180 `apple-touch-icon.png` and a 512 × 512
   `favicon.png` from the same source.
3. Hard-refresh the browser. Every `<BrandLogo />` instance in the app will
   automatically render the new artwork.

No code changes required. The component handles size, dark-mode contrast,
ring/glow effects, and fallback rendering on its own.
