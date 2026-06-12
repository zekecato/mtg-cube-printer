# Cube Cobra Schemas

## `CubeJSON`

Live responses commonly use camelCase for cube metadata and a board-keyed `cards` object.

```ts
type CubeJSON = {
  name?: string;
  shortId?: string;
  id?: string;
  owner?: CubeOwner | string;
  description?: string;
  cards: CubeBoards | CubeCard[];
  changelog?: { id: string; date: number }; // only with date query

  // Common metadata; usually not needed for print-selection features.
  cardCount?: number;
  dateLastUpdated?: number;
  defaultSorts?: string[];
  tagColors?: unknown[];
  tags?: string[];
  basics?: CubeCard[];
};

type CubeBoards = Record<string, CubeCard[]>;
```

## Boards

Typical shape:

```json
{
  "cards": {
    "mainboard": [],
    "maybeboard": [],
    "basics": []
  }
}
```

Rules:

- Treat each key under `cards` as a board name.
- Preserve raw board names for display and URL state.
- Normalize missing/empty board names to a sentinel such as `"no board"`.
- Defensively support `cards` as an array if existing code already does.

## `CubeCard`

A cube card has cube-list metadata plus nested Scryfall-like details.

```ts
type CubeCard = {
  // Top-level cube-list metadata.
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

  // Nested card details. Prefer live shape over docs/examples.
  details?: CubeCardDetails;
};
```

## `CubeCardDetails`

Fields most relevant for app features:

```ts
type CubeCardDetails = {
  name?: string;
  full_name?: string;

  // Images. Live app currently prefers `image_normal` for printing.
  image_normal?: string;
  image_small?: string;
  image_flip?: string | null;
  art_crop?: string;

  // Type line. Live responses commonly expose this as `details.type`.
  // Docs/examples may show top-level `type_line`.
  type?: string;
  type_line?: string;

  // Color identity for Magic identity filters.
  color_identity?: ColorCode[];
  colors?: ColorCode[];

  // Common detail metadata.
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

## Internal normalized printable schema

Use an app-owned schema for filtering, layout, and rendering:

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

Recommended mapping:

- `name`: top-level `card.name`, fallback `""`.
- `imageUrl`: `card.details.image_normal`; consider `card.imgUrl`, `card.details.image_flip`, and `card.imgBackUrl` only when explicitly adding custom/double-faced support.
- `typeLine`: live `card.details.type`, fallback `card.type_line`, fallback `""`.
- `colors`: uppercase known values from `card.details.color_identity`; fallback carefully only after inspecting live data.
- `tags`: top-level string array `card.tags`, unique and stable order.
- `board`: board key from `cards` object, fallback top-level `card.board`, fallback `"no board"`.

## Filter semantics commonly expected by this app

- Type line query: whitespace fragments are ANDed, case-insensitive.
- Tags: selected-any match, case-insensitive.
- Boards: selected-any match, case-insensitive.
- Color identity:
  - no selected colors allows any card;
  - default selected colors require exactly one identity matching the selected color;
  - include-multicolor allows any card containing a selected color;
  - multicolor-only requires more than one identity, optionally containing a selected color.

## Raw-to-normalized example

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

Normalizes to:

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
