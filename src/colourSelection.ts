import type { Appearance } from './appearanceStore';

export type Part = keyof Appearance;

export interface ColourSelection {
  readonly selectedPart: Part;
  /** The committed colours; a live object, so callers can hand it to code that reads the current colours. */
  readonly colours: Appearance;
  select(part: Part): void;
  /** Commits a colour to the selected part; the part stays selected. */
  pick(colour: string): void;
  /** Replaces all three committed colours (e.g. once the account's colours have loaded). */
  setColours(colours: Appearance): void;
  /** Previews a colour on the selected part without committing it. */
  hover(colour: string): void;
  unhover(): void;
  /** What the preview snake shows: the committed colours with any hover applied to the selected part. */
  displayedColours(): Appearance;
  /** The colour to outline in the palette: the committed colour of the part being edited. */
  outlinedColour(): string;
}

export function createColourSelection(initial: Appearance, initialPart: Part = 'body'): ColourSelection {
  const colours: Appearance = { ...initial };
  let selectedPart = initialPart;

  let hovered: string | null = null;

  return {
    get selectedPart() { return selectedPart; },
    colours,
    select(part) { selectedPart = part; hovered = null; },
    pick(colour) { colours[selectedPart] = colour; },
    setColours(next) { Object.assign(colours, next); },
    hover(colour) { hovered = colour; },
    unhover() { hovered = null; },
    displayedColours() { return hovered === null ? { ...colours } : { ...colours, [selectedPart]: hovered }; },
    outlinedColour() { return colours[selectedPart]; },
  };
}
