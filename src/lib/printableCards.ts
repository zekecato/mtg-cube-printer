const NO_BOARD = 'no board';
const COLOR_CODES = ['W', 'U', 'B', 'R', 'G', 'C'];

type CubeCard = {
  name?: unknown;
  tags?: unknown;
  details?: {
    image_normal?: unknown;
    type?: unknown;
    color_identity?: unknown;
  };
};

type CubeJSON = {
  cards?: unknown;
};

export type PrintableCard = {
  name: string;
  imageUrl: string;
  typeLine: string;
  colors: string[];
  tags: string[];
  board: string;
};

export type PrintableCardsResult = {
  printable: PrintableCard[];
  skippedWithoutImages: number;
};

function uniqueStrings(values: unknown[]) {
  const result: string[] = [];
  for (const value of values) {
    const s = String(value);
    if (s && !result.includes(s)) result.push(s);
  }
  return result;
}

function getImageUrl(card: CubeCard) {
  return typeof card.details?.image_normal === 'string' ? card.details.image_normal : '';
}

function getTypeLine(card: CubeCard) {
  return typeof card.details?.type === 'string' ? card.details.type : '';
}

function getColors(card: CubeCard) {
  const rawColors = card.details?.color_identity;

  return Array.isArray(rawColors)
    ? uniqueStrings(
        rawColors
          .map((color) => String(color).toUpperCase())
          .filter((color) => COLOR_CODES.includes(color)),
      )
    : [];
}

function normalizeCard(card: CubeCard, board: string): PrintableCard {
  return {
    name: typeof card.name === 'string' ? card.name : '',
    imageUrl: getImageUrl(card),
    typeLine: getTypeLine(card),
    colors: getColors(card),
    tags: Array.isArray(card.tags) ? uniqueStrings(card.tags.filter((tag) => typeof tag === 'string')) : [],
    board,
  };
}

export function getPrintableCards(data: CubeJSON): PrintableCardsResult {
  const boards = data.cards;
  const printable: PrintableCard[] = [];
  let skippedWithoutImages = 0;

  function addCard(card: CubeCard, board: string) {
    const normalized = normalizeCard(card, board);
    if (!normalized.imageUrl) {
      skippedWithoutImages += 1;
      return;
    }
    printable.push(normalized);
  }

  if (Array.isArray(boards)) {
    for (const card of boards) addCard(card as CubeCard, NO_BOARD);
  } else if (boards && typeof boards === 'object') {
    for (const [board, boardCards] of Object.entries(boards)) {
      if (!Array.isArray(boardCards)) continue;
      for (const card of boardCards) addCard(card as CubeCard, board || NO_BOARD);
    }
  } else {
    throw new Error('Unexpected API response (no cards object).');
  }

  return { printable, skippedWithoutImages };
}
