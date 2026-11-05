type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'countdownHintShown';
export const HINT_MATCHES = 3;

export interface CountdownHint {
  /** The hint lines for this countdown, or null once the device has had its first matches' worth. Answering with lines counts a match. */
  take(): string[] | null;
}

/**
 * The countdown hint for a device's first few matches: how to steer for the pointer type, plus the goal.
 * With blocked storage the count can't be kept, so it shows every time.
 */
export function createCountdownHint(storage: HintStorage | undefined, isCoarsePointer: () => boolean): CountdownHint {
  function storedCount(): number {
    try {
      const n = Number(storage?.getItem(STORAGE_KEY));
      return Number.isInteger(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  return {
    take() {
      const count = storedCount();
      if (count >= HINT_MATCHES) return null;
      try {
        storage?.setItem(STORAGE_KEY, String(count + 1));
      } catch {
        // Blocked or full storage: the hint will keep showing.
      }
      return [isCoarsePointer() ? 'Swipe to steer' : 'Arrows / WASD to steer', "Eat · grow · don't crash"];
    },
  };
}
