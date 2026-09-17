# Port Issue Tracker

Features from the old p5.js project (`p5_snake_game`) that were not fully carried over during the migration to Phaser/Colyseus. Each item lists the current state, what's missing, and file references for both projects.

## Related repositories

- **Old p5.js game:** `/root/Projects/p5_snake_game`
- **New Phaser client (this repo):** `/root/Projects/snake-phaser`
- **Colyseus game server:** `/root/Projects/snake-colyseus`
- **Go API server** (auth, scores, any new REST endpoints needed): `/root/Projects/go-server`

## 1. Game-over flow is unwired

- [x] Implement game-over screen (ranked players, high scores) and wire up the `GAME_OVER` event.

**Current state:** `GAME_OVER: "gameOver"` is defined in `src/SocketManager.ts:19` but no handler is ever registered for it, and `isGameOver` is never set to `true` anywhere in the new project.

**Old reference:** `showGameOverScreen()` in old `sketch.js:405` — drew a ranked player list and high scores when the game ended.

**Server side:** confirm/emit the `gameOver` message from the Colyseus room in `/root/Projects/snake-colyseus` (`src`).

## 2. No reconnect logic

- [x] Add reconnect/retry handling for dropped Colyseus connections.

**Current state:** `SocketManager.ts` has no handling for `room.onLeave` or any dropped-connection case — a network blip ends the session with no recovery.

**Old reference:** `retryConnection()` in old `websockets.js` — retried up to 10 times with a 3s backoff.

**Client-only:** no server changes expected; reconnect logic belongs in `snake-phaser`'s `SocketManager.ts` using Colyseus client reconnection APIs.

## 3. High scores fetched but never displayed

- [x] Render fetched high scores in the UI (e.g. login/waiting screen or game-over screen).

**Current state:** `getHighScores()` in `src/Snake.ts:149` fetches high scores but only `console.log`s the result — nothing renders it.

**Old reference:** Waiting-room and game-over screens in old `sketch.js` displayed `highScore`/`highScores`.

**API:** verify the `/api/high-scores` endpoint (and any per-user high score endpoint) returns what the UI needs; new endpoints, if required, go in `/root/Projects/go-server` (see `handlers/user_handlers.go`).

**Note (added when issue #1 was implemented):** the game-over screen (`GameScene.onGameOver` in `src/scenes/GameScene.ts`) was intentionally built with a ranked player list only, no high scores. When implementing this issue, revisit that screen and add a top-3 high scores section to it, matching the old `showGameOverScreen()` reference.

## 4. Other players' live scores not rendered

- [ ] Render a live scoreboard for all connected players, not just the local one.

**Current state:** `state.players` (Colyseus) carries every player's score, but `SocketManager.ts:63` only updates `scoreText` for the local player — other players' scores are never shown.

**Old reference:** `drawUIBox()` in old `sketch.js:470` — listed every connected player's name and score in a sidebar.

**Client-only:** the data already exists on `state.players` from `/root/Projects/snake-colyseus`; this is purely a `snake-phaser` rendering gap.

## 5. Background rotation half-wired

- [ ] Either wire up random background rotation end-to-end, or remove the dead code.

**Current state:** `drawBackground()` (`src/utils.ts:17`) exists and background images are preloaded, but nothing calls it. There's no `backgroundNumber` (or similar) field on the Colyseus `GameState` schema (`src/schemas/Food.ts`) to drive it.

**Old reference:** Old server config included `backgroundNumber`, consumed by `drawBackground(img)` in old `sketch.js`.

**Server side:** add a `backgroundNumber` (or similar) field to the `GameState` schema in `/root/Projects/snake-colyseus` if rotation is kept; otherwise delete `drawBackground()` from `snake-phaser`.

## 6. Snake color customization dropped

- [ ] Decide whether to bring back pre-match color customization (head/body/eyes), or leave it as an intentional simplification.

**Current state:** Colors are hardcoded in `src/scenes/GameScene.ts:25-29` (`head: '#00FF00'`, `body: '#008000'`, `eyes: '#FFFFFF'`). No UI exists to change them.

**Old reference:** Old `sketch.js` `mousePressed()` / `updateColors()` — clicking swatches in the waiting room randomized head/body/eye colors and sent the update to the server.

**Server side:** the Colyseus room in `/root/Projects/snake-colyseus` already accepts `colours` on join (see `SocketManager.ts`'s `joinOrCreate` call) — an `updatePlayer` message to update colors mid-lobby may need to be re-added there if not already present.
