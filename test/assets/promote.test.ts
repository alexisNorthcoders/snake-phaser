import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { theme } from '../../tools/assets/themes/goblin-treasure.ts'
import { FOOD_TYPES } from '../../tools/assets/theme.ts'
import { parsePicks, promote } from '../../tools/assets/promote.ts'
import { buildBackgroundPrompt, buildPrompt } from '../../tools/assets/prompt.ts'
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

async function setup() {
  const root = await mkdtemp(`${tmpdir()}/promote-`)
  const outputDir = `${root}/out`
  const publicDir = `${root}/public`
  await mkdir(`${outputDir}/food`, { recursive: true })
  await mkdir(`${outputDir}/background`, { recursive: true })
  for (const slot of FOOD_TYPES) for (let i = 1; i <= 4; i++) await writeFile(`${outputDir}/food/${slot}-${i}.png`, Buffer.concat([PNG_SIGNATURE, Buffer.from(`${slot}${i}`)]))
  for (let i = 1; i <= 2; i++) await writeFile(`${outputDir}/background/tile-${i}.png`, Buffer.concat([PNG_SIGNATURE, Buffer.from(`tile${i}`)]))
  const themeDir = `${publicDir}/assets/images/themes/${theme.name}`
  return { outputDir, publicDir, themeDir }
}
const allPicks = Object.fromEntries(FOOD_TYPES.map((s) => [s, 2]))

test('parsePicks reports malformed, unknown, out-of-range and duplicate picks', () => {
  const { picks, errors } = parsePicks(['redApple=1', 'nope=1', 'cherry=9', 'banana', 'redApple=2', 'chili=x'])
  assert.deepEqual(picks, { redApple: 1 })
  assert.equal(errors.length, 5)
})

test('parsePicks reads background=<n> as the tile, apart from the food slots', () => {
  const { picks, background, errors } = parsePicks(['background=3', 'cherry=2'])
  assert.deepEqual(picks, { cherry: 2 })
  assert.equal(background, 3)
  assert.deepEqual(parsePicks(['background=0']).errors, ['Invalid pick for background: "0" (tile numbers start at 1)'])
  assert.deepEqual(parsePicks(['background=1', 'background=2']).errors, ['Duplicate pick for background'])
})

test('promote copies picks into the theme food folder and writes a manifest', async () => {
  const { outputDir, publicDir, themeDir } = await setup()
  const now = new Date('2026-01-01T00:00:00Z')
  const m = await promote({ theme, picks: allPicks, background: 1, outputDir, publicDir, now })
  assert.deepEqual(await readFile(`${themeDir}/food/cherry.png`), Buffer.concat([PNG_SIGNATURE, Buffer.from('cherry2')]))
  assert.deepEqual(await readFile(`${themeDir}/background/tile.png`), Buffer.concat([PNG_SIGNATURE, Buffer.from('tile1')]))
  const written = JSON.parse(await readFile(`${themeDir}/manifest.json`, 'utf8'))
  assert.deepEqual(written, m)
  assert.equal(written.slots.banana?.prompt, buildPrompt(theme, 'banana'))
  assert.equal(written.slots.banana?.timestamp, now.toISOString())
  assert.ok(written.slots.banana?.model)
  assert.equal(written.background?.prompt, buildBackgroundPrompt(theme))
  assert.equal(written.background?.timestamp, now.toISOString())
})

test('promote refuses a theme with no background tile, and names a missing tile candidate', async () => {
  const { outputDir, publicDir, themeDir } = await setup()
  await assert.rejects(promote({ theme, picks: allPicks, outputDir, publicDir }), /background: no pick given/)
  await assert.rejects(promote({ theme, picks: allPicks, background: 7, outputDir, publicDir }), /background: tile 7 is missing/)
  await assert.rejects(readdir(themeDir))
})

test('a new tile can be promoted on its own, and the food picks keep theirs', async () => {
  const { outputDir, publicDir, themeDir } = await setup()
  await promote({ theme, picks: allPicks, background: 1, outputDir, publicDir, now: new Date('2026-01-01T00:00:00Z') })
  const m = await promote({ theme, picks: {}, background: 2, outputDir, publicDir, now: new Date('2026-02-01T00:00:00Z') })
  assert.deepEqual(await readFile(`${themeDir}/background/tile.png`), Buffer.concat([PNG_SIGNATURE, Buffer.from('tile2')]))
  assert.equal(m.background?.timestamp, '2026-02-01T00:00:00.000Z')
  assert.equal(m.slots.banana?.timestamp, '2026-01-01T00:00:00.000Z')
})

test('promote writes nothing and names missing and invalid slots', async () => {
  const { outputDir, publicDir, themeDir } = await setup()
  const { redApple, cherry, ...rest } = allPicks
  await assert.rejects(
    promote({ theme, picks: { ...rest, cherry: 3 } as any, background: 1, outputDir: `${outputDir}-missing`, publicDir }),
    /redApple[\s\S]*cherry|cherry[\s\S]*redApple/,
  )
  await assert.rejects(promote({ theme, picks: rest as any, background: 1, outputDir, publicDir }), /redApple: no pick[\s\S]*cherry: no pick/)
  await assert.rejects(readdir(themeDir))
})

test('a subset can be re-promoted when other slots already exist', async () => {
  const { outputDir, publicDir, themeDir } = await setup()
  await promote({ theme, picks: allPicks, background: 1, outputDir, publicDir, now: new Date('2026-01-01T00:00:00Z') })
  const m = await promote({ theme, picks: { cherry: 4 }, outputDir, publicDir, now: new Date('2026-02-01T00:00:00Z') })
  assert.deepEqual(await readFile(`${themeDir}/food/cherry.png`), Buffer.concat([PNG_SIGNATURE, Buffer.from('cherry4')]))
  assert.deepEqual(await readFile(`${themeDir}/food/banana.png`), Buffer.concat([PNG_SIGNATURE, Buffer.from('banana2')]))
  assert.equal(m.slots.cherry?.timestamp, '2026-02-01T00:00:00.000Z')
  assert.equal(m.slots.banana?.timestamp, '2026-01-01T00:00:00.000Z')
})

test('parsePicks accepts sheet candidates as s<n>', () => {
  const { picks, errors } = parsePicks(['redApple=s3', 'cherry=2', 'banana=s0'])
  assert.deepEqual(picks, { redApple: { sheet: 3 }, cherry: 2 })
  assert.equal(errors.length, 1)
})

test('promote can assign any sheet candidate to a slot, and still requires every slot', async () => {
  const { outputDir, publicDir, themeDir } = await setup()
  await writeFile(`${outputDir}/food/sheet-5.png`, Buffer.concat([PNG_SIGNATURE, Buffer.from('sheet5')]))
  await assert.rejects(promote({ theme, picks: { cherry: { sheet: 5 } }, background: 1, outputDir, publicDir }), /redApple: no pick/)
  await assert.rejects(readdir(themeDir))
  const m = await promote({ theme, picks: { ...allPicks, cherry: { sheet: 5 }, banana: { sheet: 9 } } as any, background: 1, outputDir, publicDir }).catch((e) => e)
  assert.match(String(m), /banana: candidate s9 is missing/)
  await promote({ theme, picks: { ...allPicks, cherry: { sheet: 5 } }, background: 1, outputDir, publicDir })
  assert.deepEqual(await readFile(`${themeDir}/food/cherry.png`), Buffer.concat([PNG_SIGNATURE, Buffer.from('sheet5')]))
})
