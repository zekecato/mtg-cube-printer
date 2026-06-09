# MTG Cube Printer

Print Magic: The Gathering cube card proxies from a [Cube Cobra](https://cubecobra.com) cube URL.

## Features

- Paste any Cube Cobra cube URL or cube ID
- Choose paper size: Letter, Legal, A4, A3
- Configurable card gap in mm
- Filter the print selection by type line, tags, color identity, and Cube Cobra board
- Shareable URL query parameters for cube, paper, gap, and filters
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

1. Enter a Cube Cobra URL (e.g. `https://cubecobra.com/cube/list/mycube`) or cube ID.
2. Select paper size and gap between cards.
3. Click **Load Cube**. The input and URL normalize to the Cube ID.
4. The tool fetches printable card records from the Cube Cobra API.
5. Optionally filter the print selection by type line, tags, color identity, or board.
6. Pages are laid out with the correct card grid.
7. Click **Print** to print the current selection.

The client tries to fetch directly from Cube Cobra first. If CORS blocks it, a thin server-side proxy (`/api/cube`) handles the request.

## Filters and shareable URLs

Application state is stored in the URL query string rather than local storage. Opening a URL with a `cube` parameter automatically loads that cube and restores the printable view.

Supported query parameters:

- `cube`: Cube Cobra cube ID, e.g. `cube=mycube`
- `paper`: `letter`, `legal`, `a4`, `a3`, or `13x19`
- `gap`: card gap in millimeters
- `type`: whitespace-separated type-line fragments; every fragment must match case-insensitively
- `tag`: repeat once per selected tag, e.g. `tag=Ramp&tag=Fixing`
- `color`: repeat once per selected color identity code (`W`, `U`, `B`, `R`, `G`, `C`)
- `multicolor=1`: include multicolor cards that contain any selected color identity
- `multicolorOnly=1`: include only cards with more than one color identity value
- `board`: repeat once per selected raw Cube Cobra board value

Example:

```txt
/?cube=mycube&paper=a4&gap=2&type=land&tag=Ramp&color=G&multicolorOnly=1&board=mainboard
```

## Paper sizes

| Paper  | Dimensions (mm) | Cards (0 mm gap) | Cards (2 mm gap) |
|--------|-----------------|-------------------|-------------------|
| Letter | 215.9 × 279.4   | 3 × 2 = 6         | 2 × 2 = 4         |
| Legal  | 215.9 × 355.6   | 3 × 3 = 9         | 2 × 3 = 6         |
| A4     | 210 × 297       | 3 × 2 = 6         | 2 × 2 = 4         |
| A3     | 297 × 420       | 4 × 4 = 16        | 4 × 4 = 16        |
| 13×19″ | 330.2 × 482.6   | 4 × 5 = 20        | 4 × 5 = 20        |

Magic card size: 63 mm × 88 mm. Margins: 12.5 mm (≈ 1.25 cm).

## Stack

- [Astro](https://astro.build) with `@astrojs/node` adapter
- 100% vanilla JS/CSS on the client — no framework dependencies
- Cube Cobra public API (`/cube/api/cubeJSON/:id`)
