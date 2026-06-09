# MTG Cube Printer

MTG Cube Printer helps players prepare printable proxy sheets from a Magic: The Gathering cube.

## Language

**Cube ID**:
The Cube Cobra identifier for the cube being prepared for printing.
_Avoid_: Full cube URL

**Layout**:
The physical arrangement of cards on printed pages, including page size, margins, spacing, and cards per page.
_Avoid_: Filtered cards, card list

**Print Selection**:
The subset of loaded cube cards currently included in the printable output.
_Avoid_: Layout filter, filtered layout

**Board**:
A Cube Cobra grouping that indicates where a card belongs within the cube list; cards without an API-provided grouping are treated as having no board.
_Avoid_: Section, bucket

**Type Line**:
The canonical Magic type text assigned to a card, used to identify types such as land, creature, artifact, instant, and sorcery.
_Avoid_: Rules text, tag, card name

**Color Identity**:
The canonical color values assigned to a card by Cube Cobra, expressed as one or more of white, blue, black, red, green, and colorless.
_Avoid_: Mana cost color

**Multicolor**:
A card with more than one Cube Cobra color identity value.
_Avoid_: Gold-only card
