export interface FpsMeter {
    /** Adds one frame. Returns the FPS of the window it just closed, or undefined while the window is still filling. */
    frame(deltaMs: number): number | undefined
}

/** Frames per second over a window; an empty window (no frames or no time) is 0. */
export function fpsOf(frames: number, elapsedMs: number): number {
    if (frames <= 0 || elapsedMs <= 0) return 0
    return Math.round((frames * 1000) / elapsedMs)
}

export function createFpsMeter(windowMs = 500): FpsMeter {
    let frames = 0
    let elapsed = 0
    return {
        frame(deltaMs) {
            frames += 1
            elapsed += deltaMs
            if (elapsed < windowMs) return undefined
            const fps = fpsOf(frames, elapsed)
            frames = 0
            // Carry the overshoot into the next window; % keeps one huge frame from closing several windows.
            elapsed %= windowMs
            return fps
        },
    }
}
