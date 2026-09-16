import { Schema, type, ArraySchema } from "@colyseus/schema";
import { FoodType } from "../Food";

export class Food extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") index: number = 0;
    @type("string") type: FoodType = "redApple";
}

export class GameState extends Schema {
    @type("boolean") hasGameStarted: boolean = false;
    @type("number") nextPositionIndex: number = 0;
    @type("number") aliveCount: number = 0;
    @type([Food]) foodCoordinates = new ArraySchema<Food>();
}