# Cube Cobra API Shape Used by This App

This app uses one live Cube Cobra endpoint:

```txt
GET https://cubecobra.com/cube/api/cubeJSON/:id
```

The browser tries this endpoint directly. If that fails, `src/pages/api/cube.ts` proxies it through:

```txt
GET /api/cube?id=<cube-id>
```

The endpoint is CORS-enabled in Cube Cobra's docs and is rate-limited at 100 requests/minute per IP. Cube IDs may be UUIDs or short/custom IDs.

Schema notes below are based on the current Cube Cobra API docs supplied in this conversation plus a live `cubeJSON` response crawl. They intentionally document only fields this app uses or is likely to touch soon.

## External response: `CubeJSON`

Only a small subset of the response is used by the printer. Observed live responses are camelCase in several places even where public examples show snake_case.

```ts
type CubeJSON = {
  name?: string;
  shortId?: string;
  id?: string;
  owner?: CubeOwner | string;
  description?: string;

  // The important field for this app.
  // Public docs describe this as an object keyed by board name.
  // The app also accepts a legacy/defensive array form.
  cards: CubeBoards | CubeCard[];

  // Present only when Cube Cobra's optional `date` query is used.
  // This app does not currently request historical cubes.
  changelog?: {
    id: string;
    date: number; // Unix timestamp in milliseconds
  };

  // Metadata not currently used by the app, but common in responses.
  cardCount?: number;
  dateLastUpdated?: number;
  defaultSorts?: string[];
  tagColors?: unknown[];
  tags?: string[];
  basics?: CubeCard[];
};

type CubeBoards = Record<string, CubeCard[]>;
```

### Board shape

Cube Cobra returns cards grouped by board:

```json
{
  "cards": {
    "mainboard": [/* CubeCard */],
    "maybeboard": [/* CubeCard */],
    "basics": [/* CubeCard */]
  }
}
```

Application rules:

- Every key under `cards` is treated as a **Board** value.
- Empty or missing board keys normalize to the sentinel string `"no board"`.
- If `cards` is an array instead of an object, every card is treated as `"no board"`.
- Board filtering compares board names case-insensitively, but stores the raw board labels from Cube Cobra.

## External card: `CubeCard`

Cube Cobra card entries combine cube-list metadata with a nested `details` object containing Scryfall-like card data.

```ts
type CubeCard = {
  // Cube-list fields.
  name?: string;
  cmc?: string | number;
  type_line?: string;
  colors?: string[];
  addedTmsp?: string;
  collector_number?: string;
  status?: string;
  finish?: string;
  imgUrl?: string | null;
  imgBackUrl?: string | null;
  tags?: string[];
  notes?: string;
  rarity?: string;
  colorCategory?: string | null;
  cardID?: string;
  index?: number;
  board?: string;

  // Card-detail fields. This is where this app reads image/type/color data.
  details?: CubeCardDetails;
};
```

### Card details used by the app

```ts
type CubeCardDetails = {
  name?: string;
  full_name?: string;

  // Used as the printable card image.
  image_normal?: string;
  image_small?: string;
  image_flip?: string | null;
  art_crop?: string;

  // Used for Type Line filtering.
  // Note: live API uses `details.type`; public docs/examples may call this `type_line`.
  type?: string;

  // Used for Color Identity filtering.
  color_identity?: ColorCode[];

  // Common but not currently used by the app.
  colors?: ColorCode[];
  cmc?: number;
  scryfall_id?: string;
  oracle_id?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  rarity?: string;
  oracle_text?: string;
  prices?: Record<string, number | string | null>;
  legalities?: Record<string, string>;
  digital?: boolean;
  isToken?: boolean;
  language?: string;
};

type ColorCode = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
```

Application rules:

- `details.image_normal` is required for printing. Cards without it are skipped and counted as `skippedWithoutImages`.
- `details.type` is normalized to the app's **Type Line**. Missing type becomes `""`.
- `details.color_identity` is normalized to uppercase known color codes only: `W`, `U`, `B`, `R`, `G`, `C`.
- `tags` are read from the top-level `CubeCard.tags`, not from `details`.
- `name` is read from top-level `CubeCard.name`; missing names become `""`.

## Internal normalized schema: `PrintableCard`

All filtering, pagination, preview, and printing use normalized printable cards rather than raw Cube Cobra records.

```ts
type PrintableCard = {
  name: string;
  imageUrl: string;
  typeLine: string;
  colors: ColorCode[];
  tags: string[];
  board: string;
};
```

Constructed in `src/lib/printableCards.ts` by `getPrintableCards(data)`.

Keep Cube Cobra-specific defensive parsing in the Printable Card normalization module. Do not spread raw API records through Layout, Print Selection, or UI code.

## Filter semantics over `PrintableCard`

`matchesFilters(card)` defines the app's current print-selection behavior:

- **Type Line**: split the query on whitespace; every fragment must appear case-insensitively in `card.typeLine`.
- **Tags**: when tags are selected, a card matches if it has any selected tag, case-insensitively.
- **Color Identity**:
  - no selected colors: any color identity is allowed;
  - default selected colors: card must have exactly one color identity and it must be selected;
  - `includeMulticolor`: card may have multiple identities and must contain any selected color;
  - `multicolorOnly`: card must have more than one identity, and if colors are selected it must contain any selected color.
- **Boards**: when boards are selected, a card matches if its board is selected, case-insensitively.

## Example raw-to-normalized mapping

Given a raw Cube Cobra card:

```json
{
  "name": "Black Lotus",
  "tags": ["Power"],
  "board": "mainboard",
  "details": {
    "type": "Artifact",
    "color_identity": ["C"],
    "image_normal": "https://cards.scryfall.io/normal/...jpg"
  }
}
```

The app normalizes it to:

```json
{
  "name": "Black Lotus",
  "imageUrl": "https://cards.scryfall.io/normal/...jpg",
  "typeLine": "Artifact",
  "colors": ["C"],
  "tags": ["Power"],
  "board": "mainboard"
}
```

## Extension notes

- If adding support for custom images or double-faced cards, start at `getImageUrl(card)`. Candidate raw fields include top-level `imgUrl`, top-level `imgBackUrl`, `details.image_normal`, and `details.image_flip`.
- If adding historical cube loading, pass Cube Cobra's `date=<milliseconds>` query through both direct fetch and `/api/cube`, then document how `changelog` is surfaced.
- If adding fields to filters or display, normalize them into a small internal schema first; avoid binding UI directly to raw Cube Cobra keys.
- Treat public API examples as illustrative. Validate against live `cubeJSON` responses before relying on exact casing or nesting.
