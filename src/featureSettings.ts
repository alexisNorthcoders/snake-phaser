export type AssetTheme = 'classic' | 'goblin-treasure'

export type SnakeBodyStyle = 'blocks' | 'joints' | 'arcs'

export interface FeatureSettings {
    snakeBody: SnakeBodyStyle
    snakeBodyWidth: number
    /** Only used by 'arcs': the head follows the curve instead of sliding straight. */
    snakeHeadFollowsArc: boolean
    /** Shows a live FPS readout on a second HUD row. */
    showFps: boolean
    /** Decorative snake wandering the edge of the initial lobby. */
    lobbyAmbience: boolean
    /** Folder under assets/images/themes that food textures load from. */
    assetTheme: AssetTheme
    /** How far the background is dimmed behind the board, 0 (untouched) to 1 (black). */
    backgroundDim: number
    /** Shows the "Play vs Computer" entry point in the lobby. Off until the vs-bot mode ships. */
    vsBot: boolean
    /** How many ticks the bot waits before reacting, an integer 0–4. One tick is one move, 125 ms. Sent when a vs-bot room is created. */
    botReactionTicks: number
    /** Ticks per second the room simulates at, an integer 4–15. Sent as `speed` when entering a room. */
    gameSpeed: number
    /** Prints every setting with its current value and the values it accepts. */
    list(): void
}

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>
type Logger = Pick<Console, 'log' | 'warn'>

const STORAGE_KEY = 'feature'

const BODY_STYLES: SnakeBodyStyle[] = ['blocks', 'joints', 'arcs']
const ASSET_THEMES: AssetTheme[] = ['classic', 'goblin-treasure']
const MIN_WIDTH = 0.5
const MAX_WIDTH = 1
const MIN_DIM = 0
const MAX_DIM = 1
const MIN_REACTION_TICKS = 0
const MAX_REACTION_TICKS = 4
const MIN_GAME_SPEED = 4
const MAX_GAME_SPEED = 15

type Values = Pick<FeatureSettings, 'snakeBody' | 'snakeBodyWidth' | 'snakeHeadFollowsArc' | 'showFps' | 'lobbyAmbience' | 'assetTheme' | 'backgroundDim' | 'vsBot' | 'botReactionTicks' | 'gameSpeed'>

const DEFAULTS: Values = { snakeBody: 'blocks', snakeBodyWidth: 0.8, snakeHeadFollowsArc: true, showFps: false, lobbyAmbience: true, assetTheme: 'goblin-treasure', backgroundDim: 0.4, vsBot: false, botReactionTicks: 2, gameSpeed: 8 }

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

    const ambienceFlag = (value: unknown): boolean => {
        if (typeof value === 'boolean') return value
        warn(`lobbyAmbience must be a boolean, got ${JSON.stringify(value)}; using ${DEFAULTS.lobbyAmbience}`)
        return DEFAULTS.lobbyAmbience
    }

    const assetTheme = (value: unknown): AssetTheme => {
        if (ASSET_THEMES.includes(value as AssetTheme)) return value as AssetTheme
        warn(`unknown assetTheme ${JSON.stringify(value)}, expected one of ${ASSET_THEMES.join(', ')}; using '${DEFAULTS.assetTheme}'`)
        return DEFAULTS.assetTheme
    }

    const backgroundDim = (value: unknown): number => {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            warn(`backgroundDim must be a number, got ${JSON.stringify(value)}; using ${DEFAULTS.backgroundDim}`)
            return DEFAULTS.backgroundDim
        }
        const clamped = Math.min(MAX_DIM, Math.max(MIN_DIM, value))
        if (clamped !== value) warn(`backgroundDim ${value} is outside ${MIN_DIM}–${MAX_DIM}; clamped to ${clamped}`)
        return clamped
    }

    const vsBotFlag = (value: unknown): boolean => {
        if (typeof value === 'boolean') return value
        warn(`vsBot must be a boolean, got ${JSON.stringify(value)}; using ${DEFAULTS.vsBot}`)
        return DEFAULTS.vsBot
    }

    const botReactionTicks = (value: unknown): number => {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            warn(`botReactionTicks must be an integer, got ${JSON.stringify(value)}; using ${DEFAULTS.botReactionTicks}`)
            return DEFAULTS.botReactionTicks
        }
        const clamped = Math.min(MAX_REACTION_TICKS, Math.max(MIN_REACTION_TICKS, value))
        if (clamped !== value) warn(`botReactionTicks ${value} is outside ${MIN_REACTION_TICKS}–${MAX_REACTION_TICKS}; clamped to ${clamped}`)
        return clamped
    }

    const gameSpeed = (value: unknown): number => {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            warn(`gameSpeed must be an integer, got ${JSON.stringify(value)}; using ${DEFAULTS.gameSpeed}`)
            return DEFAULTS.gameSpeed
        }
        const clamped = Math.min(MAX_GAME_SPEED, Math.max(MIN_GAME_SPEED, value))
        if (clamped !== value) warn(`gameSpeed ${value} is outside ${MIN_GAME_SPEED}–${MAX_GAME_SPEED}; clamped to ${clamped}`)
        return clamped
    }

    const stored = readStored()
    const values: Values = {
        snakeBody: 'snakeBody' in stored ? bodyStyle(stored.snakeBody) : DEFAULTS.snakeBody,
        snakeBodyWidth: 'snakeBodyWidth' in stored ? bodyWidth(stored.snakeBodyWidth) : DEFAULTS.snakeBodyWidth,
        snakeHeadFollowsArc: 'snakeHeadFollowsArc' in stored ? headFollowsArc(stored.snakeHeadFollowsArc) : DEFAULTS.snakeHeadFollowsArc,
        showFps: 'showFps' in stored ? fpsFlag(stored.showFps) : DEFAULTS.showFps,
        lobbyAmbience: 'lobbyAmbience' in stored ? ambienceFlag(stored.lobbyAmbience) : DEFAULTS.lobbyAmbience,
        assetTheme: 'assetTheme' in stored ? assetTheme(stored.assetTheme) : DEFAULTS.assetTheme,
        backgroundDim: 'backgroundDim' in stored ? backgroundDim(stored.backgroundDim) : DEFAULTS.backgroundDim,
        vsBot: 'vsBot' in stored ? vsBotFlag(stored.vsBot) : DEFAULTS.vsBot,
        botReactionTicks: 'botReactionTicks' in stored ? botReactionTicks(stored.botReactionTicks) : DEFAULTS.botReactionTicks,
        gameSpeed: 'gameSpeed' in stored ? gameSpeed(stored.gameSpeed) : DEFAULTS.gameSpeed,
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
        get lobbyAmbience() { return values.lobbyAmbience },
        set lobbyAmbience(show) {
            values.lobbyAmbience = ambienceFlag(show)
            save()
        },
        get assetTheme() { return values.assetTheme },
        set assetTheme(theme) {
            values.assetTheme = assetTheme(theme)
            save()
        },
        get backgroundDim() { return values.backgroundDim },
        set backgroundDim(dim) {
            values.backgroundDim = backgroundDim(dim)
            save()
        },
        get vsBot() { return values.vsBot },
        set vsBot(show) {
            values.vsBot = vsBotFlag(show)
            save()
        },
        get botReactionTicks() { return values.botReactionTicks },
        set botReactionTicks(ticks) {
            values.botReactionTicks = botReactionTicks(ticks)
            save()
        },
        get gameSpeed() { return values.gameSpeed },
        set gameSpeed(speed) {
            values.gameSpeed = gameSpeed(speed)
            save()
        },
        list() {
            log([
                'settings (assign in the console to change them):',
                `  feature.snakeBody = '${values.snakeBody}'    // ${BODY_STYLES.map((style) => `'${style}'`).join(' | ')}`,
                `  feature.snakeBodyWidth = ${values.snakeBodyWidth}    // ${MIN_WIDTH}–${MAX_WIDTH} cells, ignored by 'blocks'`,
                `  feature.snakeHeadFollowsArc = ${values.snakeHeadFollowsArc}    // true | false, only used by 'arcs'`,
                `  feature.showFps = ${values.showFps}    // true | false, live FPS readout under Score`,
                `  feature.lobbyAmbience = ${values.lobbyAmbience}    // true | false, decorative snake around the lobby edge`,
                `  feature.assetTheme = '${values.assetTheme}'    // ${ASSET_THEMES.map((theme) => `'${theme}'`).join(' | ')}, folder food textures load from (reload to apply)`,
                `  feature.backgroundDim = ${values.backgroundDim}    // ${MIN_DIM}–${MAX_DIM}, dims the background behind the board (applies immediately)`,
                `  feature.vsBot = ${values.vsBot}    // true | false, shows "Play vs Computer" in the lobby (reload to apply)`,
                `  feature.botReactionTicks = ${values.botReactionTicks}    // ${MIN_REACTION_TICKS}–${MAX_REACTION_TICKS} ticks (1 tick = 125 ms), bot reaction time, used by the next "Play vs Computer"`,
                `  feature.gameSpeed = ${values.gameSpeed}    // ${MIN_GAME_SPEED}–${MAX_GAME_SPEED} ticks per second, sent as 'speed' when entering the next room`,
            ].join('\n'))
        },
    }
}
