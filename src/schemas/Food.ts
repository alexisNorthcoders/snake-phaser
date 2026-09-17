import { Schema, type, ArraySchema } from "@colyseus/schema";
import { FoodType } from "../Food";

export class Food extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") index: number = 0;
    @type("string") type: FoodType = "redApple";
}

/** Mirrors the server's `Coordinates`, which backs tail segments, speed and direction. */
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
    @type("boolean") isDead: boolean = false;
    @type("number") score: number = 0;
    @type("number") size: number = 0;
    @type(Coordinates) speed = new Coordinates();
    @type(Coordinates) direction = new Coordinates();
    @type("string") type: string = "player";
    @type("string") playerId: string = "";
}

export class Player extends Schema {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("string") type: string = "player";
    @type(SnakeColours) colours = new SnakeColours();
    @type(SnakeState) snake?: SnakeState;
}

export class GameState extends Schema {
    @type("boolean") hasGameStarted: boolean = false;
    @type("number") nextPositionIndex: number = 0;
    @type("number") aliveCount: number = 0;
    @type("number") backgroundNumber: number = 0;
    @type([Player]) players = new ArraySchema<Player>();
    @type([Food]) foodCoordinates = new ArraySchema<Food>();
}
