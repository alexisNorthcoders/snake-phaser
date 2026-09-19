import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { theme } from '../../tools/assets/themes/goblin-treasure.ts'
import { FOOD_TYPES } from '../../tools/assets/theme.ts'
import { parsePicks, promote } from '../../tools/assets/promote.ts'
import { buildPrompt } from '../../tools/assets/prompt.ts'
import { resolveSlot } from '../../tools/assets/theme.ts'

async function setup() {
  const root = await mkdtemp(`${tmpdir()}/promote-`)
  const outputDir = `${root}/out`
  const publicDir = `${root}/public`
  await mkdir(`${outputDir}/food`, { recursive: true })
  for (const slot of FOOD_TYPES) for (let i = 1; i <= 4; i++) await writeFile(`${outputDir}/food/${slot}-${i}.png`, `${slot}${i}`)
  const themeDir = `${publicDir}/assets/images/themes/${theme.name}`
  return { outputDir, publicDir, themeDir }
}
const allPicks = Object.fromEntries(FOOD_TYPES.map((s) => [s, 2]))

test('parsePicks reports malformed, unknown, out-of-range and duplicate picks', () => {
  const { picks, errors } = parsePicks(['redApple=1', 'nope=1', 'cherry=9', 'banana', 'redApple=2', 'chili=x'])
  assert.deepEqual(picks, { redApple: 1 })
  assert.equal(errors.length, 5)
})

test('promote copies picks into the theme food folder and writes a manifest', async () => {
  const { outputDir, publicDir, themeDir } = await setup()
  const now = new Date('2026-01-01T00:00:00Z')
  const m = await promote({ theme, picks: allPicks, outputDir, publicDir, now })
  assert.equal(await readFile(`${themeDir}/food/cherry.png`, 'utf8'), 'cherry2')
  const written = JSON.parse(await readFile(`${themeDir}/food/manifest.json`, 'utf8'))
  assert.deepEqual(written, m)
  assert.equal(written.slots.banana?.prompt, buildPrompt(theme, resolveSlot(theme, 'banana')))
  assert.equal(written.slots.banana?.timestamp, now.toISOString())
  assert.ok(written.slots.banana?.model)
})

test('promote writes nothing and names missing and invalid slots', async () => {
  const { outputDir, publicDir, themeDir } = await setup()
  const { redApple, cherry, ...rest } = allPicks
  await assert.rejects(
    promote({ theme, picks: { ...rest, cherry: 3 } as any, outputDir: `${outputDir}-missing`, publicDir }),
    /redApple[\s\S]*cherry|cherry[\s\S]*redApple/,
  )
  await assert.rejects(promote({ theme, picks: rest as any, outputDir, publicDir }), /redApple: no pick[\s\S]*cherry: no pick/)
  await assert.rejects(readdir(themeDir))
})

test('a subset can be re-promoted when other slots already exist', async () => {
  const { outputDir, publicDir, themeDir } = await setup()
  await promote({ theme, picks: allPicks, outputDir, publicDir, now: new Date('2026-01-01T00:00:00Z') })
  const m = await promote({ theme, picks: { cherry: 4 }, outputDir, publicDir, now: new Date('2026-02-01T00:00:00Z') })
  assert.equal(await readFile(`${themeDir}/food/cherry.png`, 'utf8'), 'cherry4')
  assert.equal(await readFile(`${themeDir}/food/banana.png`, 'utf8'), 'banana2')
  assert.equal(m.slots.cherry?.timestamp, '2026-02-01T00:00:00.000Z')
  assert.equal(m.slots.banana?.timestamp, '2026-01-01T00:00:00.000Z')
})
