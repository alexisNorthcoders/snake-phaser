import { Schema, type, ArraySchema } from "@colyseus/schema";
import { FoodType } from "../Food";
import type { Phase } from "../countdownOverlay";
import type { GameMode } from "../gameMode";

export class Food extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") index: number = 0;
    @type("string") type: FoodType = "redApple";
}

/** Mirrors the server's `Coordinates`, which backs tail segments and direction. */
export class Coordinates extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
}

export class SnakeColours extends Schema {
    @type("string") head: string = "";
    @type("string") body: string = "";
    @type("string") eyes: string = "";
}

export class SnakeState extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type([Coordinates]) tail = new ArraySchema<Coordinates>();
    @type("number") tailCursor: number = 0;
    @type("boolean") isDead: boolean = false;
    @type("number") score: number = 0;
    @type("number") size: number = 0;
    /** Ticks since the snake last ate; counted in an endless round only. */
    @type("number") hunger: number = 0;
    @type(Coordinates) direction = new Coordinates();
    @type("string") playerId: string = "";
}

/**
 * The server keeps the tail as a ring buffer: `tailCursor` is the slot holding
 * the oldest segment, and walking forward from it runs oldest to newest,
 * wrapping round. Mirrors the server's `tailCells` — returns the cells in body
 * order, newest (next to the head) first.
 */
export const tailCells = ({ tail, tailCursor }: SnakeState): { x: number; y: number }[] => {
    const { length } = tail;
    return Array.from({ length }, (_, i) => {
        const { x, y } = tail[(tailCursor - 1 - i + length) % length];
        return { x, y };
    });
};

export class Player extends Schema {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type(SnakeColours) colours = new SnakeColours();
    @type(SnakeState) snake?: SnakeState;
    /** Set by the server for its computer opponent; the only trustworthy way to tell a bot apart. */
    @type("boolean") isBot: boolean = false;
}

export class GameState extends Schema {
    @type("string") phase: Phase = "lobby";
    @type("number") countdown: number = 0;
    /** The kind of round the room plays, fixed at room creation from the `mode` room option. */
    @type("string") mode: GameMode = "timed";
    /** Length of one simulation tick in ms, fixed at room creation, so clients can pace their animation. */
    @type("number") tickMs: number = 125;
    @type("number") aliveCount: number = 0;
    /** Ticks left in a timed round, counted down each tick; this times `tickMs` is the ms left. Unused in an endless round. */
    @type("number") ticksLeft: number = 0;
    /** Ticks a snake can go without food before its score starts draining in an endless round. */
    @type("number") hungerTicks: number = 80;
    @type("number") backgroundNumber: number = 0;
    @type([Player]) players = new ArraySchema<Player>();
    @type([Food]) foodCoordinates = new ArraySchema<Food>();
}
