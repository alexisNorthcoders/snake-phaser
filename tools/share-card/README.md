# Share card

Rebuilds `public/share-card.png` (1200×630), the preview image named by `og:image` / `twitter:image` in `index.html`. It captures a real match from the dev server and sets "Snake MP" and the pitch beside it in Pixelify Sans.

```
npm run share-card
```

Needs the dev client and server running (pm2 `snake-phaser` on :5173 and `snake-colyseus`), and Chromium at `/usr/bin/chromium`. The script opens the game, presses Play (the server seats the rookie when you're alone), waits until the room is in play with two live snakes, captures the arena and composes the card.

Options (after `--`): `--url` (default `http://localhost:5173`), `--out` (default `public/share-card.png`), `--chromium` (or set `CHROMIUM_PATH`), `--arena-out <file>` to also keep the raw arena capture.

Rerun and commit the PNG after a theme change. The tags need `https://snakemp.duckdns.org/share-card.png`, so keep the file name.
