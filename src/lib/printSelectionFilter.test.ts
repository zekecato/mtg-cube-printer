import { describe, expect, it } from 'vitest';
import { filterPrintSelection, type PrintSelectionFilters } from './printSelectionFilter';
import type { PrintableCard } from './printableCards';

const CARDS: PrintableCard[] = [
  card({ name: 'Llanowar Elves', typeLine: 'Creature — Elf Druid', colors: ['G'], tags: ['Ramp'], board: 'mainboard' }),
  card({ name: 'Lightning Bolt', typeLine: 'Instant', colors: ['R'], tags: ['Burn'], board: 'MainBoard' }),
  card({ name: 'Growth Spiral', typeLine: 'Instant', colors: ['G', 'U'], tags: ['Ramp', 'Draw'], board: 'maybeboard' }),
  card({ name: 'Sol Ring', typeLine: 'Artifact', colors: ['C'], tags: ['Power'], board: 'basics' }),
  card({ name: 'Swords to Plowshares', typeLine: 'Instant', colors: ['W'], tags: ['Removal'], board: 'mainboard' }),
];

const EMPTY_FILTERS: PrintSelectionFilters = {
  typeQuery: '',
  selectedTags: [],
  selectedColors: [],
  includeMulticolor: false,
  multicolorOnly: false,
  selectedBoards: [],
};

describe('Print Selection filtering', () => {
  it('matches every Type Line fragment case-insensitively', () => {
    expect(names(filter({ typeQuery: 'cre elf' }))).toEqual(['Llanowar Elves']);
    expect(names(filter({ typeQuery: 'INSTANT' }))).toEqual([
      'Lightning Bolt',
      'Growth Spiral',
      'Swords to Plowshares',
    ]);
  });

  it('matches any selected tag case-insensitively', () => {
    expect(names(filter({ selectedTags: ['ramp'] }))).toEqual(['Llanowar Elves', 'Growth Spiral']);
    expect(names(filter({ selectedTags: ['draw', 'power'] }))).toEqual(['Growth Spiral', 'Sol Ring']);
  });

  it('matches selected Boards case-insensitively', () => {
    expect(names(filter({ selectedBoards: ['MAINBOARD'] }))).toEqual([
      'Llanowar Elves',
      'Lightning Bolt',
      'Swords to Plowshares',
    ]);
  });

  it('defaults selected colors to exact one-color Color Identity matches', () => {
    expect(names(filter({ selectedColors: ['G', 'R'] }))).toEqual(['Llanowar Elves', 'Lightning Bolt']);
  });

  it('can include multicolor cards that contain any selected Color Identity', () => {
    expect(names(filter({ selectedColors: ['g'], includeMulticolor: true }))).toEqual([
      'Llanowar Elves',
      'Growth Spiral',
    ]);
  });

  it('can require multicolor cards, optionally narrowed by selected Color Identity', () => {
    expect(names(filter({ multicolorOnly: true }))).toEqual(['Growth Spiral']);
    expect(names(filter({ selectedColors: ['U'], multicolorOnly: true }))).toEqual(['Growth Spiral']);
    expect(names(filter({ selectedColors: ['R'], multicolorOnly: true }))).toEqual([]);
  });

  it('ANDs Type Line, tag, Board, Color Identity, and Multicolor rules', () => {
    expect(
      names(
        filter({
          typeQuery: 'instant',
          selectedTags: ['ramp'],
          selectedColors: ['G'],
          includeMulticolor: true,
          selectedBoards: ['maybeboard'],
        }),
      ),
    ).toEqual(['Growth Spiral']);
  });
});

function filter(filters: PrintSelectionFilters) {
  return filterPrintSelection(CARDS, { ...EMPTY_FILTERS, ...filters });
}

function names(cards: PrintableCard[]) {
  return cards.map((card) => card.name);
}

function card(overrides: Partial<PrintableCard>): PrintableCard {
  return {
    name: '',
    imageUrl: 'https://cards.scryfall.io/png/front/card.png',
    imageFallbackUrls: [],
    typeLine: '',
    colors: [],
    tags: [],
    board: 'mainboard',
    ...overrides,
  };
}
