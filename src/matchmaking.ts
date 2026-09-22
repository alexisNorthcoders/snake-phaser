export interface RoomEntry {
    /** `create` always opens a fresh room; `joinOrCreate` may match into someone else's. */
    method: 'create' | 'joinOrCreate'
    options: { vsBot?: true; botReactionTicks?: number; speed: number }
}

/** A vs-bot match must be a create, so it can never be matched into another player's room. */
export function roomEntry(vsBot: boolean, botReactionTicks: number, speed: number): RoomEntry {
    return vsBot
        ? { method: 'create', options: { vsBot: true, botReactionTicks, speed } }
        : { method: 'joinOrCreate', options: { speed } }
}
