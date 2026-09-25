import type { GameMode } from './gameMode.ts';

export interface RoomEntry {
    /** `create` always opens a fresh room; `joinOrCreate` may match into someone else's. */
    method: 'create' | 'joinOrCreate'
    options: { vsBot?: true; botReactionTicks?: number; speed: number; mode: GameMode }
}

/**
 * A vs-bot match must be a create, so it can never be matched into another player's room. Both paths send the
 * mode; the server filters matchmaking by it, so a public join never lands in a room of another mode.
 */
export function roomEntry(vsBot: boolean, botReactionTicks: number, speed: number, mode: GameMode): RoomEntry {
    return vsBot
        ? { method: 'create', options: { vsBot: true, botReactionTicks, speed, mode } }
        : { method: 'joinOrCreate', options: { speed, mode } }
}
