import { GAME_MODES, MODE_LABELS, type GameMode } from './gameMode.ts';

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

const RECORDS_URL = '/api/bot-records';

/** A snake's results against humans in one mode, from the snake's side. */
export interface BotRecord {
  wins: number;
  losses: number;
  draws: number;
}

/** Bot id -> mode -> record; a bot or mode with no rounds is absent. */
export type BotRecords = Map<string, Partial<Record<GameMode, BotRecord>>>;

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function recordOf(value: unknown): BotRecord | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { wins, losses, draws } = value as Record<string, unknown>;
  return isCount(wins) && isCount(losses) && isCount(draws) ? { wins, losses, draws } : undefined;
}

/**
 * Each snake's record against humans, from `GET /api/bot-records`. Entries that can't be read are ignored; when the
 * records can't be loaded at all, it is empty and the cards just show no record.
 */
export async function loadBotRecords(fetchRecords: RosterFetch = (input) => fetch(input)): Promise<BotRecords> {
  const records: BotRecords = new Map();
  let body: unknown;
  try {
    const response = await fetchRecords(RECORDS_URL);
    if (!response.ok) return records;
    body = await response.json();
  } catch {
    return records;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return records;
  for (const [botId, modes] of Object.entries(body)) {
    if (typeof modes !== 'object' || modes === null || Array.isArray(modes)) continue;
    const byMode: Partial<Record<GameMode, BotRecord>> = {};
    for (const mode of GAME_MODES) {
      const record = recordOf((modes as Record<string, unknown>)[mode]);
      if (record) byMode[mode] = record;
    }
    if (Object.keys(byMode).length > 0) records.set(botId, byMode);
  }
  return records;
}

/**
 * A snake's record as card lines, the chosen mode first: "Timed 5W 2L 1D". A mode with no rounds is left out, and a
 * snake with no results at all reads "No games yet". Empty when the records couldn't be loaded (`records` undefined).
 */
export function recordLines(records: BotRecords | undefined, botId: string, chosen: GameMode): string[] {
  if (!records) return [];
  const byMode = records.get(botId) ?? {};
  const modes = [chosen, ...GAME_MODES.filter((mode) => mode !== chosen)];
  const lines = modes.flatMap((mode) => {
    const record = byMode[mode];
    return record ? [`${MODE_LABELS[mode]} ${record.wins}W ${record.losses}L ${record.draws}D`] : [];
  });
  return lines.length > 0 ? lines : ['No games yet'];
}
