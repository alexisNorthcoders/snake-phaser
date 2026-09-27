import type { GameMode } from './gameMode.ts';

export interface RoomEntry {
    /** `create` always opens a fresh room; `joinOrCreate` may match into someone else's. */
    method: 'create' | 'joinOrCreate'
    options: { vsBot?: true; botId?: string; botReactionTicks?: number; speed: number; mode: GameMode }
}

/**
 * A vs-bot match, against the roster snake `botId`, must be a create, so it can never be matched into another
 * player's room; no `botId` means the public lobby. Both paths send the mode; the server filters matchmaking by it,
 * so a public join never lands in a room of another mode.
 */
export function roomEntry(botId: string | undefined, botReactionTicks: number, speed: number, mode: GameMode): RoomEntry {
    return botId !== undefined
        ? { method: 'create', options: { vsBot: true, botId, botReactionTicks, speed, mode } }
        : { method: 'joinOrCreate', options: { speed, mode } }
}
