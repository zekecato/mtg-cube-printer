# MTG Cube Printer

Print Magic: The Gathering cube card proxies from a [Cube Cobra](https://cubecobra.com) cube URL.

## Features

- Paste any Cube Cobra cube URL
- Choose paper size: Letter, Legal, A4, A3
- Configurable card gap in mm
- 1.25 cm margins on all sides
- Auto-calculates cards-per-page and total page count
- Live preview with scaled-down pages
- Print-ready `@page` CSS (select paper size in your browser print dialog to match)

## Quick start

```bash
npm install
npm run dev          # → http://localhost:4321
```

To run the production build:

```bash
npm run build
npm run preview      # serves dist/ with the Node adapter
```

## How it works

1. Enter a Cube Cobra URL (e.g. `https://cubecobra.com/cube/list/mycube`)
2. Select paper size and gap between cards
3. Click **Load Cube**
4. The tool fetches card image URLs from the Cube Cobra API
5. Pages are laid out with the correct card grid
6. Click **Print all pages** to print

The client tries to fetch directly from Cube Cobra first. If CORS blocks it, a thin server-side proxy (`/api/cube`) handles the request.

## Paper sizes

| Paper  | Dimensions (mm) | Cards (0 mm gap) | Cards (2 mm gap) |
|--------|-----------------|-------------------|-------------------|
| Letter | 215.9 × 279.4   | 3 × 2 = 6         | 2 × 2 = 4         |
| Legal  | 215.9 × 355.6   | 3 × 3 = 9         | 2 × 3 = 6         |
| A4     | 210 × 297       | 3 × 2 = 6         | 2 × 2 = 4         |
| A3     | 297 × 420       | 4 × 4 = 16        | 4 × 4 = 16        |

Magic card size: 63 mm × 88 mm. Margins: 12.5 mm (≈ 1.25 cm).

## Stack

- [Astro](https://astro.build) with `@astrojs/node` adapter
- 100% vanilla JS/CSS on the client — no framework dependencies
- Cube Cobra public API (`/cube/api/cubeJSON/:id`)
