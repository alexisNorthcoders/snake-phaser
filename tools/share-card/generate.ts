import { parseArgs } from 'node:util'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import puppeteer, { type Page } from 'puppeteer-core'
import { LOBBY_PANEL, START_BUTTON, computeLobbyPanelLayout } from '../../src/utils/lobbyPanelLayout.ts'
import { THEME_BACKGROUND } from '../../src/theme.ts'

/** Rebuilds public/share-card.png: a real match captured from a running dev server, with the name and pitch over it. */
const CARD = { width: 1200, height: 630 } as const
const TITLE = 'Snake MP'
const PITCH = 'Multiplayer snake in your browser. Eat, grow, cut off rivals. No sign-up.'
/** Once the match is in play with two live snakes, how long to let them grow before capturing. */
const SETTLE_MS = 3000
const MATCH_TIMEOUT_MS = 60000
const ROOM_TIMEOUT_MS = 20000
const FONT_FILE = fileURLToPath(import.meta.resolve('@fontsource/pixelify-sans/files/pixelify-sans-latin-500-normal.woff2'))

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:5173' },
    out: { type: 'string', default: 'public/share-card.png' },
    chromium: { type: 'string', default: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium' },
    'arena-out': { type: 'string' },
  },
})

/** Presses the lobby's Play button; the canvas is FIT-scaled, so lobby coordinates are mapped through its bounding box. */
async function pressPlay(page: Page): Promise<void> {
  const canvas = await page.waitForSelector('#game-container canvas')
  const box = await canvas!.boundingBox()
  if (!box) throw new Error('canvas has no box')
  const scale = box.width / 800
  const layout = computeLobbyPanelLayout(true)
  const x = box.x + (LOBBY_PANEL.x + LOBBY_PANEL.width / 2) * scale
  const y = box.y + (layout.startY + START_BUTTON.height / 2) * scale
  await page.mouse.click(x, y)
}

/** True while the room is in play with at least two snakes alive. Reads the game's own room through its dev-served module. */
async function matchIsOn(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const { default: socketManager } = await import(/* @vite-ignore */ '/src/SocketManager.ts')
    const state = socketManager.getRoom()?.state
    if (!state || state.phase !== 'playing') return false
    return Array.from(state.players.values()).filter((p: any) => p.snake && !p.snake.isDead).length >= 2
  })
}

/** Polls until the page's SocketManager holds a joined room, so the match poll below never races the connection. */
async function waitForRoom(page: Page): Promise<void> {
  const deadline = Date.now() + ROOM_TIMEOUT_MS
  while (Date.now() < deadline) {
    const joined = await page.evaluate(async () => {
      const { default: socketManager } = await import(/* @vite-ignore */ '/src/SocketManager.ts')
      return !!socketManager.getRoom()?.state
    })
    if (joined) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`never joined a room within ${ROOM_TIMEOUT_MS / 1000}s; are the dev server and snake-colyseus up?`)
}

async function waitForMatch(page: Page): Promise<void> {
  await waitForRoom(page)
  const deadline = Date.now() + MATCH_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await matchIsOn(page)) {
      await new Promise((r) => setTimeout(r, SETTLE_MS))
      if (await matchIsOn(page)) return
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  const seen = await page.evaluate(async () => {
    const { default: socketManager } = await import(/* @vite-ignore */ '/src/SocketManager.ts')
    const state = socketManager.getRoom()?.state
    return state ? `phase ${state.phase}, ${JSON.stringify(Array.from(state.players.values()).map((p: any) => ({ bot: p.isBot, dead: p.snake?.isDead, has: !!p.snake })))}` : 'not in a room'
  })
  throw new Error(`no match with two live snakes within ${MATCH_TIMEOUT_MS / 1000}s (${seen}); are the dev server and snake-colyseus up?`)
}

async function captureArena(browser: Awaited<ReturnType<typeof puppeteer.launch>>): Promise<Buffer> {
  const page = await browser.newPage()
  await page.setViewport({ width: 800, height: 800, deviceScaleFactor: 1 })
  await page.goto(values.url!, { waitUntil: 'networkidle2' })
  await page.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 2500))
  await pressPlay(page)
  await waitForMatch(page)
  const canvas = await page.$('#game-container canvas')
  const png = Buffer.from(await canvas!.screenshot({ type: 'png' }))
  await page.close()
  return png
}

async function composeCard(browser: Awaited<ReturnType<typeof puppeteer.launch>>, arena: Buffer): Promise<Buffer> {
  const page = await browser.newPage()
  await page.setViewport({ ...CARD, deviceScaleFactor: 1 })
  const font = readFileSync(FONT_FILE).toString('base64')
  await page.setContent(`<!DOCTYPE html><style>
    @font-face { font-family: 'Pixelify Sans'; font-weight: 500; src: url(data:font/woff2;base64,${font}); }
    html, body { margin: 0; width: ${CARD.width}px; height: ${CARD.height}px; background: ${THEME_BACKGROUND}; overflow: hidden; }
    .arena { position: absolute; top: 0; right: 0; width: ${CARD.height}px; height: ${CARD.height}px; border-left: 6px solid #fff; box-sizing: border-box;
      background: url(data:image/png;base64,${arena.toString('base64')}) no-repeat; background-size: 100% 100%; image-rendering: pixelated; }
    .text { position: absolute; left: 0; top: 0; bottom: 0; width: ${CARD.width - CARD.height}px; padding: 0 44px; box-sizing: border-box;
      display: flex; flex-direction: column; justify-content: center; font-family: 'Pixelify Sans'; color: #fff; }
    h1 { margin: 0 0 28px; font-size: 92px; font-weight: 500; line-height: 1; text-shadow: 6px 6px 0 #008000; }
    p { margin: 0; font-size: 32px; line-height: 1.35; }
  </style><div class="arena"></div><div class="text"><h1>${TITLE}</h1><p>${PITCH}</p></div>`)
  await page.evaluate(() => document.fonts.load("500 40px 'Pixelify Sans'"))
  const png = Buffer.from(await page.screenshot({ type: 'png' }))
  await page.close()
  return png
}

const browser = await puppeteer.launch({ executablePath: values.chromium, args: ['--no-sandbox'] })
try {
  const arena = await captureArena(browser)
  if (values['arena-out']) writeFileSync(values['arena-out'], arena)
  const card = await composeCard(browser, arena)
  writeFileSync(values.out!, card)
  console.log(`wrote ${values.out} (${CARD.width}x${CARD.height})`)
} finally {
  await browser.close()
}
