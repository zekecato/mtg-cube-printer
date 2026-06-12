# TODO

## Use highest-quality Scryfall PNG images for printable cards

### Goal

Improve print output quality by using the highest-resolution full-card image available from Scryfall for card rendering and printing. Print quality is the top priority, even if cube loading and image loading become slower.

### Why this matters

The app is intended to produce physical proxy sheets. Lower-resolution card images may look acceptable in the browser preview but can appear soft or blurry when printed at card size. The printable output should prioritize sharp text, crisp borders, and high-fidelity card art over faster loading.

### Desired outcome

- Printable card images use Scryfall's PNG-quality full-card images where available.
- Printed cards are suitable for high-quality proxy-sheet output at standard Magic card dimensions.
- The app should prefer image quality over load speed.
- The browser preview and print output should use the same high-quality printable image source unless there is a documented reason not to.
- Cards without a usable high-quality image should continue to be handled gracefully.

### External API notes

- Cube data is loaded from Cube Cobra's `cubeJSON` endpoint:

  ```txt
  GET https://cubecobra.com/cube/api/cubeJSON/:cube-id
  ```

- Cube Cobra card records include nested Scryfall-like card details.
- Current live Cube Cobra responses expose full-card image URLs such as `details.image_normal`.
- `details.image_normal` points to Scryfall's `normal` JPEG image size, which is not the highest-resolution printable image.
- Scryfall serves multiple full-card image variants from `cards.scryfall.io`, including:
  - `normal` JPEG images, commonly around 488×680 px.
  - `large` JPEG images, commonly around 672×936 px.
  - `png` PNG images, commonly around 745×1040 px.
- For standard Magic card dimensions, Scryfall PNG images are the preferred print-quality source.
- Scryfall image URLs generally encode the image variant in the path, for example:

  ```txt
  https://cards.scryfall.io/normal/front/...
  https://cards.scryfall.io/large/front/...
  https://cards.scryfall.io/png/front/...
  ```

- Scryfall image availability should be treated as an external dependency and may vary for unusual records, custom images, digital-only cards, tokens, or double-faced cards.

### Acceptance criteria

- A loaded Cube Cobra cube prints using the highest-quality Scryfall full-card image source available for each printable card.
- Print output no longer relies on Scryfall `normal` JPEG images when a PNG-quality full-card image is available.
- The app's user-facing behavior remains focused on **Cube ID**, **Layout**, and **Print Selection** terminology.
- Existing filtering behavior for Board, Type Line, Color Identity, tags, and Multicolor cards remains unchanged.
- The app still supports the existing Cube Cobra fetch flow, including the `/api/cube` fallback.
- Documentation describing the Cube Cobra/Scryfall image fields is updated to reflect the print-quality image source.
- The final behavior is verified with at least one live Cube Cobra cube and browser print preview.

### Non-goals

- Do not optimize for fastest image loading as part of this task.
- Do not add client-side storage for image preferences.
- Do not change card layout dimensions, margins, spacing, cut marks, or cards-per-page behavior.
- Do not change Print Selection filtering semantics.
