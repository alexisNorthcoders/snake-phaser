type ModeStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'gameMode';

/** The kind of round a room plays, fixed when the room is created; mirrors the server's modes. */
export type GameMode = 'timed' | 'endless';

export const GAME_MODES: readonly GameMode[] = ['timed', 'endless'];

export const DEFAULT_MODE: GameMode = 'timed';

/** Mirrors the server's round length (`roundSeconds: 180`). */
export const TIMED_ROUND_MINUTES = 3;

export const MODE_LABELS: Record<GameMode, string> = { timed: 'Timed', endless: 'Endless' };

export const MODE_BLURBS: Record<GameMode, string> = {
  timed: `Timed: ${TIMED_ROUND_MINUTES} minutes, top score wins`,
  endless: 'Endless: last snake alive wins — don’t starve',
};

/** `value` as a mode, or `fallback` (timed, the same as the server's) when it isn't one. */
export function modeOf(value: unknown, fallback: GameMode = DEFAULT_MODE): GameMode {
  return GAME_MODES.includes(value as GameMode) ? (value as GameMode) : fallback;
}

export interface ModeStore {
  /** The mode chosen last time on this device; timed when none is saved or storage fails. */
  load(): GameMode;
  save(mode: GameMode): void;
}

export function createModeStore(storage: ModeStorage | undefined): ModeStore {
  return {
    load() {
      try {
        return modeOf(storage?.getItem(STORAGE_KEY));
      } catch {
        return DEFAULT_MODE;
      }
    },
    save(mode) {
      try {
        storage?.setItem(STORAGE_KEY, mode);
      } catch {
        // Blocked or full storage: the choice just won't survive a reload.
      }
    },
  };
}
