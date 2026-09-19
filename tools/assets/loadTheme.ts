import type { Theme } from './theme.ts'

export async function loadTheme(name: string): Promise<Theme> {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid theme name "${name}"`)
    try {
        return (await import(`./themes/${name}.ts`)).theme
    } catch (err) {
        throw new Error(`Could not load theme "${name}" from tools/assets/themes/${name}.ts: ${(err as Error).message}`)
    }
}
