import { describe, expect, it } from 'vitest';
import { getPrintableCards } from './printableCards';

describe('Printable Card normalization', () => {
  it('normalizes Cube Cobra boards into printable cards with Board values', () => {
    const result = getPrintableCards({
      cards: {
        mainboard: [
          {
            name: 'Black Lotus',
            tags: ['Power'],
            details: {
              image_normal: 'https://cards.scryfall.io/normal/front/black-lotus.jpg',
              type: 'Artifact',
              color_identity: ['C'],
            },
          },
        ],
        maybeboard: [
          {
            name: 'Lightning Bolt',
            tags: ['Burn'],
            details: {
              image_normal: 'https://cards.scryfall.io/normal/front/lightning-bolt.jpg',
              type: 'Instant',
              color_identity: ['R'],
            },
          },
        ],
      },
    });

    expect(result).toEqual({
      printable: [
        {
          name: 'Black Lotus',
          imageUrl: 'https://cards.scryfall.io/png/front/black-lotus.png',
          imageFallbackUrls: [
            'https://cards.scryfall.io/large/front/black-lotus.jpg',
            'https://cards.scryfall.io/normal/front/black-lotus.jpg',
          ],
          typeLine: 'Artifact',
          colors: ['C'],
          tags: ['Power'],
          board: 'mainboard',
        },
        {
          name: 'Lightning Bolt',
          imageUrl: 'https://cards.scryfall.io/png/front/lightning-bolt.png',
          imageFallbackUrls: [
            'https://cards.scryfall.io/large/front/lightning-bolt.jpg',
            'https://cards.scryfall.io/normal/front/lightning-bolt.jpg',
          ],
          typeLine: 'Instant',
          colors: ['R'],
          tags: ['Burn'],
          board: 'maybeboard',
        },
      ],
      skippedWithoutImages: 0,
    });
  });

  it('treats legacy array-form cards as having no board', () => {
    const result = getPrintableCards({
      cards: [
        {
          name: 'Island',
          details: {
            image_normal: 'https://cards.scryfall.io/normal/front/island.jpg',
            type: 'Basic Land — Island',
            color_identity: ['U'],
          },
        },
      ],
    });

    expect(result.printable).toEqual([
      {
        name: 'Island',
        imageUrl: 'https://cards.scryfall.io/png/front/island.png',
        imageFallbackUrls: [
          'https://cards.scryfall.io/large/front/island.jpg',
          'https://cards.scryfall.io/normal/front/island.jpg',
        ],
        typeLine: 'Basic Land — Island',
        colors: ['U'],
        tags: [],
        board: 'no board',
      },
    ]);
    expect(result.skippedWithoutImages).toBe(0);
  });

  it('normalizes empty Board names to no board', () => {
    const result = getPrintableCards({
      cards: {
        '': [
          {
            name: 'Sol Ring',
            details: {
              image_normal: 'https://cards.scryfall.io/normal/front/sol-ring.jpg',
              type: 'Artifact',
              color_identity: ['C'],
            },
          },
        ],
      },
    });

    expect(result.printable[0]?.board).toBe('no board');
  });

  it('selects printable image sources by print-quality fallback order', () => {
    const result = getPrintableCards({
      cards: {
        mainboard: [
          {
            name: 'Explicit Images',
            details: {
              image_png: 'https://cards.scryfall.io/png/front/explicit.png',
              image_large: 'https://cards.scryfall.io/large/front/explicit.jpg',
              image_normal: 'https://cards.scryfall.io/normal/front/explicit.jpg',
            },
          },
          {
            name: 'Derived Images',
            details: {
              image_normal: 'https://cards.scryfall.io/normal/front/d/1/derived.jpg?1681081654',
            },
          },
          {
            name: 'Custom Image',
            imgUrl: 'https://example.test/custom-card.png',
          },
        ],
      },
    });

    expect(result.printable.map((card) => [card.imageUrl, card.imageFallbackUrls])).toEqual([
      [
        'https://cards.scryfall.io/png/front/explicit.png',
        [
          'https://cards.scryfall.io/large/front/explicit.jpg',
          'https://cards.scryfall.io/normal/front/explicit.jpg',
        ],
      ],
      [
        'https://cards.scryfall.io/png/front/d/1/derived.png?1681081654',
        [
          'https://cards.scryfall.io/large/front/d/1/derived.jpg?1681081654',
          'https://cards.scryfall.io/normal/front/d/1/derived.jpg?1681081654',
        ],
      ],
      ['https://example.test/custom-card.png', []],
    ]);
  });

  it('skips cards without printable image URLs and counts them', () => {
    const result = getPrintableCards({
      cards: {
        mainboard: [
          { name: 'Missing Image', details: { type: 'Creature', color_identity: ['G'] } },
          {
            name: 'Forest',
            details: {
              image_normal: 'https://cards.scryfall.io/normal/front/forest.jpg',
              type: 'Basic Land — Forest',
              color_identity: ['G'],
            },
          },
        ],
      },
    });

    expect(result.printable.map((card) => card.name)).toEqual(['Forest']);
    expect(result.skippedWithoutImages).toBe(1);
  });

  it('defaults missing card fields and removes duplicate tags and Color Identity values', () => {
    const result = getPrintableCards({
      cards: {
        mainboard: [
          {
            tags: ['Ramp', 'Ramp', 42, 'Fixing'],
            details: {
              image_normal: 'https://cards.scryfall.io/normal/front/unknown.jpg',
              color_identity: ['g', 'G', 'x', 'W'],
            },
          },
        ],
      },
    });

    expect(result.printable[0]).toEqual({
      name: '',
      imageUrl: 'https://cards.scryfall.io/png/front/unknown.png',
      imageFallbackUrls: [
        'https://cards.scryfall.io/large/front/unknown.jpg',
        'https://cards.scryfall.io/normal/front/unknown.jpg',
      ],
      typeLine: '',
      colors: ['G', 'W'],
      tags: ['Ramp', 'Fixing'],
      board: 'mainboard',
    });
  });

  it('throws when the Cube Cobra response has no cards object or array', () => {
    expect(() => getPrintableCards({})).toThrow('Unexpected API response (no cards object).');
    expect(() => getPrintableCards({ cards: null })).toThrow('Unexpected API response (no cards object).');
  });
});
