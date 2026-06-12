import type { PrintableCard } from './printableCards';

const COLOR_CODES = ['W', 'U', 'B', 'R', 'G', 'C'];

export type PrintSelectionFilters = {
  typeQuery?: string;
  selectedTags?: readonly string[];
  selectedColors?: readonly string[];
  includeMulticolor?: boolean;
  multicolorOnly?: boolean;
  selectedBoards?: readonly string[];
};

export function filterPrintSelection(
  cards: readonly PrintableCard[],
  filters: PrintSelectionFilters,
): PrintableCard[] {
  const normalized = normalizeFilters(filters);
  return cards.filter((card) => matchesPrintSelectionFilter(card, normalized));
}

type NormalizedFilters = {
  typeFragments: string[];
  selectedTags: string[];
  selectedColors: string[];
  includeMulticolor: boolean;
  multicolorOnly: boolean;
  selectedBoards: string[];
};

function normalizeFilters(filters: PrintSelectionFilters): NormalizedFilters {
  return {
    typeFragments: normalizeTypeFragments(filters.typeQuery),
    selectedTags: normalizeCaseInsensitiveSelection(filters.selectedTags),
    selectedColors: normalizeColors(filters.selectedColors),
    includeMulticolor: filters.includeMulticolor === true,
    multicolorOnly: filters.multicolorOnly === true,
    selectedBoards: normalizeCaseInsensitiveSelection(filters.selectedBoards),
  };
}

function matchesPrintSelectionFilter(card: PrintableCard, filters: NormalizedFilters) {
  if (!matchesTypeLine(card, filters.typeFragments)) return false;
  if (!matchesTags(card, filters.selectedTags)) return false;
  if (!matchesColorIdentity(card, filters)) return false;
  if (!matchesBoard(card, filters.selectedBoards)) return false;
  return true;
}

function matchesTypeLine(card: PrintableCard, fragments: readonly string[]) {
  if (fragments.length === 0) return true;

  const typeLine = card.typeLine.toLowerCase();
  return fragments.every((fragment) => typeLine.includes(fragment));
}

function matchesTags(card: PrintableCard, selectedTags: readonly string[]) {
  if (selectedTags.length === 0) return true;

  return card.tags.some((tag) => selectedTags.includes(tag.toLowerCase()));
}

function matchesColorIdentity(card: PrintableCard, filters: NormalizedFilters) {
  if (filters.multicolorOnly && card.colors.length <= 1) return false;

  if (filters.selectedColors.length === 0) return true;

  if (filters.includeMulticolor || filters.multicolorOnly) {
    return card.colors.some((color) => filters.selectedColors.includes(color));
  }

  return card.colors.length === 1 && filters.selectedColors.includes(card.colors[0]);
}

function matchesBoard(card: PrintableCard, selectedBoards: readonly string[]) {
  if (selectedBoards.length === 0) return true;

  return selectedBoards.includes(card.board.toLowerCase());
}

function normalizeTypeFragments(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeCaseInsensitiveSelection(values: readonly string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.toLowerCase()).filter(Boolean))];
}

function normalizeColors(values: readonly string[] | undefined) {
  const requested = new Set((values ?? []).map((value) => value.toUpperCase()));
  return COLOR_CODES.filter((code) => requested.has(code));
}
