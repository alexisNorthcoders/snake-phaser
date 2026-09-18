export type SnakeBodyStyle = 'blocks' | 'joints' | 'arcs'

export interface FeatureSettings {
    snakeBody: SnakeBodyStyle
    snakeBodyWidth: number
    /** Only used by 'arcs': the head follows the curve instead of sliding straight. */
    snakeHeadFollowsArc: boolean
    /** Shows a live FPS readout on a second HUD row. */
    showFps: boolean
    /** Prints every setting with its current value and the values it accepts. */
    list(): void
}

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>
type Logger = Pick<Console, 'log' | 'warn'>

const STORAGE_KEY = 'feature'

const BODY_STYLES: SnakeBodyStyle[] = ['blocks', 'joints', 'arcs']
const MIN_WIDTH = 0.5
const MAX_WIDTH = 1

type Values = Pick<FeatureSettings, 'snakeBody' | 'snakeBodyWidth' | 'snakeHeadFollowsArc' | 'showFps'>

const DEFAULTS: Values = { snakeBody: 'blocks', snakeBodyWidth: 0.8, snakeHeadFollowsArc: true, showFps: false }

export function createFeatureSettings(storage: SettingsStorage | undefined, logger: Logger): FeatureSettings {
    const log = (message: string) => logger.log(`[feature] ${message}`)
    const warn = (message: string) => logger.warn(`[feature] ${message}`)

    const bodyStyle = (value: unknown): SnakeBodyStyle => {
        if (BODY_STYLES.includes(value as SnakeBodyStyle)) return value as SnakeBodyStyle
        warn(`unknown snakeBody ${JSON.stringify(value)}, expected one of ${BODY_STYLES.join(', ')}; using '${DEFAULTS.snakeBody}'`)
        return DEFAULTS.snakeBody
    }

    const bodyWidth = (value: unknown): number => {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            warn(`snakeBodyWidth must be a number, got ${JSON.stringify(value)}; using ${DEFAULTS.snakeBodyWidth}`)
            return DEFAULTS.snakeBodyWidth
        }
        const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))
        if (clamped !== value) warn(`snakeBodyWidth ${value} is outside ${MIN_WIDTH}–${MAX_WIDTH}; clamped to ${clamped}`)
        return clamped
    }

    const headFollowsArc = (value: unknown): boolean => {
        if (typeof value === 'boolean') return value
        warn(`snakeHeadFollowsArc must be a boolean, got ${JSON.stringify(value)}; using ${DEFAULTS.snakeHeadFollowsArc}`)
        return DEFAULTS.snakeHeadFollowsArc
    }

    const fpsFlag = (value: unknown): boolean => {
        if (typeof value === 'boolean') return value
        warn(`showFps must be a boolean, got ${JSON.stringify(value)}; using ${DEFAULTS.showFps}`)
        return DEFAULTS.showFps
    }

    const stored = readStored()
    const values: Values = {
        snakeBody: 'snakeBody' in stored ? bodyStyle(stored.snakeBody) : DEFAULTS.snakeBody,
        snakeBodyWidth: 'snakeBodyWidth' in stored ? bodyWidth(stored.snakeBodyWidth) : DEFAULTS.snakeBodyWidth,
        snakeHeadFollowsArc: 'snakeHeadFollowsArc' in stored ? headFollowsArc(stored.snakeHeadFollowsArc) : DEFAULTS.snakeHeadFollowsArc,
        showFps: 'showFps' in stored ? fpsFlag(stored.showFps) : DEFAULTS.showFps,
    }
    const save = () => {
        try {
            storage?.setItem(STORAGE_KEY, JSON.stringify(values))
        } catch (error) {
            warn(`could not save settings, they will reset on reload: ${error}`)
        }
    }

    function readStored(): Record<string, unknown> {
        try {
            const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}')
            return parsed && typeof parsed === 'object' ? parsed : {}
        } catch {
            return {}
        }
    }

    return {
        get snakeBody() { return values.snakeBody },
        set snakeBody(style) {
            values.snakeBody = bodyStyle(style)
            save()
        },
        get snakeBodyWidth() { return values.snakeBodyWidth },
        set snakeBodyWidth(width) {
            values.snakeBodyWidth = bodyWidth(width)
            save()
        },
        get snakeHeadFollowsArc() { return values.snakeHeadFollowsArc },
        set snakeHeadFollowsArc(follows) {
            values.snakeHeadFollowsArc = headFollowsArc(follows)
            save()
        },
        get showFps() { return values.showFps },
        set showFps(show) {
            values.showFps = fpsFlag(show)
            save()
        },
        list() {
            log([
                'settings (assign in the console to change them):',
                `  feature.snakeBody = '${values.snakeBody}'    // ${BODY_STYLES.map((style) => `'${style}'`).join(' | ')}`,
                `  feature.snakeBodyWidth = ${values.snakeBodyWidth}    // ${MIN_WIDTH}–${MAX_WIDTH} cells, ignored by 'blocks'`,
                `  feature.snakeHeadFollowsArc = ${values.snakeHeadFollowsArc}    // true | false, only used by 'arcs'`,
                `  feature.showFps = ${values.showFps}    // true | false, live FPS readout under Score`,
            ].join('\n'))
        },
    }
}
