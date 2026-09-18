type NameStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'playerName';

export const MAX_NAME_LENGTH = 16;
export const DEFAULT_NAME = 'anonymous';

/** Trims and cuts to the length limit; may return an empty string. */
export function clampName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH).trim();
}

/** The name a player plays under: trimmed, at most 16 characters, "anonymous" when empty. */
export function normaliseName(name: string | null | undefined): string {
  return clampName(name ?? '') || DEFAULT_NAME;
}

export interface NameStore {
  /** The saved name for prefilling the field; empty when none is saved or storage fails. */
  saved(): string;
  /** The name to play under: the saved one, or "anonymous". */
  load(): string;
  /** Normalises and saves the name, returning what was saved. An empty name forgets the saved one. */
  save(name: string): string;
}

export function createNameStore(storage: NameStorage | undefined): NameStore {
  function saved(): string {
    try {
      return clampName(storage?.getItem(STORAGE_KEY) ?? '');
    } catch {
      return '';
    }
  }

  return {
    saved,
    load: () => normaliseName(saved()),
    save(name) {
      const clamped = clampName(name);
      try {
        storage?.setItem(STORAGE_KEY, clamped);
      } catch {
        // Blocked or full storage: the name just won't survive a reload.
      }
      return clamped || DEFAULT_NAME;
    },
  };
}
