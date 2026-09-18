export interface Appearance {
  head: string;
  body: string;
  eyes: string;
}

/** The colours a player can pick from: 12 hex strings that read well on the light-blue background. */
export const PALETTE: readonly string[] = [
  '#e63946', '#f4831f', '#f2c200', '#2a9d3f', '#0b6e4f', '#1d3557',
  '#7b2cbf', '#d81b8c', '#6d4c41', '#111111', '#ffffff', '#6c757d',
];

type AppearanceStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'appearance';
const PARTS: (keyof Appearance)[] = ['head', 'body', 'eyes'];
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface AppearanceStore {
  /** The saved colours; parts that are missing or invalid are random palette colours. Saves what it returns. */
  load(): Appearance;
  save(colours: Appearance): void;
}

export function createAppearanceStore(
  storage: AppearanceStorage | undefined,
  random: () => number = Math.random
): AppearanceStore {
  const randomColor = () => PALETTE[Math.min(PALETTE.length - 1, Math.floor(random() * PALETTE.length))];

  function readStored(): Record<string, unknown> {
    try {
      const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function save(colours: Appearance): void {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(colours));
    } catch {
      // Blocked or full storage: the colours just won't survive a reload.
    }
  }

  return {
    load() {
      const stored = readStored();
      const colours = {} as Appearance;
      for (const part of PARTS) {
        const value = stored[part];
        colours[part] = typeof value === 'string' && HEX.test(value) ? value : randomColor();
      }
      save(colours);
      return colours;
    },
    save,
  };
}
