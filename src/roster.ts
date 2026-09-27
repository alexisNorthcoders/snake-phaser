type BotChoiceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type RosterFetch = (input: string) => Promise<Response>;

const ROSTER_URL = '/colyseus/roster';
const STORAGE_KEY = 'botId';
/** Roster ids are slugs; anything else stored is treated as unreadable. */
const BOT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/i;

/** A snake the server can play in a vs-bot room: what the picker shows of a `GET /roster` entry. */
export interface RosterEntry {
  /** A stable slug: what the vs-bot room is created with. */
  id: string;
  /** Also the bot's player name in game. */
  name: string;
  /** Left out for a snake that wasn't trained for one. */
  personality?: string;
  /** 0 for a snake that wasn't trained. */
  generation: number;
  method: string;
  kind: string;
}

/** The server's scripted baseline, and the whole roster when it can't be loaded. */
export const ROOKIE: RosterEntry = { id: 'rookie', name: 'Rookie', generation: 0, method: 'scripted', kind: 'scripted' };

const METHOD_LABELS: Record<string, string> = {
  scripted: 'Scripted',
  'hand-made': 'Hand-made',
  neuroevolution: 'Neuroevolution',
  ppo: 'PPO',
};

const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** How a snake was made, in plain words; a method this client doesn't know yet is shown capitalised. */
export function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? capitalise(method);
}

export function personalityLabel(personality: string): string {
  return capitalise(personality);
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** `value` as an entry the picker can show, or undefined when it can't be read. */
function entryOf(value: unknown): RosterEntry | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { id, name, personality, generation, method, kind } = value as Record<string, unknown>;
  if (!isText(id) || !isText(name) || !isText(method) || !isText(kind)) return undefined;
  if (!Number.isInteger(generation) || (generation as number) < 0) return undefined;
  if (personality !== undefined && !isText(personality)) return undefined;
  return { id, name, ...(personality === undefined ? {} : { personality }), generation: generation as number, method, kind };
}

/**
 * The snakes the server can play, in its order. Entries that can't be read, or repeat an id, are dropped; when the
 * roster can't be loaded at all, or nothing in it can be read, it is just the rookie, so a match can still be played.
 */
export async function loadRoster(fetchRoster: RosterFetch = (input) => fetch(input)): Promise<RosterEntry[]> {
  let body: unknown;
  try {
    const response = await fetchRoster(ROSTER_URL);
    if (!response.ok) return [ROOKIE];
    body = await response.json();
  } catch {
    return [ROOKIE];
  }
  if (!Array.isArray(body)) return [ROOKIE];
  const entries: RosterEntry[] = [];
  for (const value of body) {
    const entry = entryOf(value);
    if (entry && !entries.some((seen) => seen.id === entry.id)) entries.push(entry);
  }
  return entries.length > 0 ? entries : [ROOKIE];
}

export interface BotChoiceStore {
  /** The id of the opponent chosen last time on this device; the rookie when none is saved or it can't be read. */
  load(): string;
  save(id: string): void;
}

export function createBotChoiceStore(storage: BotChoiceStorage | undefined): BotChoiceStore {
  return {
    load() {
      try {
        const id = storage?.getItem(STORAGE_KEY);
        return id && BOT_ID.test(id) ? id : ROOKIE.id;
      } catch {
        return ROOKIE.id;
      }
    },
    save(id) {
      try {
        storage?.setItem(STORAGE_KEY, id);
      } catch {
        // Blocked or full storage: the choice just won't survive a reload.
      }
    },
  };
}
