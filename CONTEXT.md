# snake-phaser

The browser client: the lobby, the game screen and the game-over screen, played against snake-colyseus and backed by go-server.

## Language

**Casual match**: a match in a `snake` room: any mode, any speed, nothing at stake. Started with Start, or with Play vs Computer against a roster snake.
**Ranked match**: a 1v1 timed match in the `ranked` room, joined from the Ranked button. Its result changes the player's Rating.
**Searching**: the wait in the Ranked queue before the match is dealt. It shows how long it has lasted and can be Cancelled.
**Account**: a registered user. Only Accounts can play Ranked.
**Guest**: someone playing with an anonymous token. Sees the Ranked button disabled.
**Rating**: an Account's skill estimate, 1500 by default. Held by go-server; the client only shows the change reported in `ratingUpdate`.
**Provisional**: a Rating based on fewer than 5 Ranked matches, shown with its progress ("Provisional (2/5)").
**Stand-in**: a roster bot that plays a Ranked match in place of a human after a wait alone.
**Rankings**: the game-over list of each snake's score and how it died.
