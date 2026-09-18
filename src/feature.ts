import { createFeatureSettings, type FeatureSettings } from './featureSettings'

declare global {
    interface Window {
        feature: FeatureSettings
    }
}

/**
 * The app's feature settings. They are a dev tool: only dev builds read and
 * persist them and expose them in the console as `window.feature`; production
 * always runs on the defaults.
 */
export const feature = createFeatureSettings(import.meta.env.DEV ? localStorageOrNothing() : undefined, console)

if (import.meta.env.DEV) {
    window.feature = feature
    feature.list()
}

// Merely touching `window.localStorage` throws when site data is blocked.
function localStorageOrNothing(): Storage | undefined {
    try {
        return window.localStorage
    } catch {
        return undefined
    }
}
