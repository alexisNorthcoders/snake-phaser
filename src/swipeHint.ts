type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'swipeHintSeen';

export interface SwipeHint {
  /** Whether this countdown should show "Swipe to steer". Answering yes marks the hint as seen. */
  take(): boolean;
}

/**
 * The once-per-device "Swipe to steer" hint for phone players. Seen-ness is also kept in memory, so with
 * blocked storage the hint shows once per page load.
 */
export function createSwipeHint(storage: HintStorage | undefined, isCoarsePointer: () => boolean): SwipeHint {
  let seen = false;

  function storedSeen(): boolean {
    try {
      return storage?.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  return {
    take() {
      if (seen || !isCoarsePointer() || storedSeen()) return false;
      seen = true;
      try {
        storage?.setItem(STORAGE_KEY, '1');
      } catch {
        // Blocked or full storage: the hint will show again after a reload.
      }
      return true;
    },
  };
}
