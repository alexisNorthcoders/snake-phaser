export interface FpsReport {
    fps: number
    avgMs: number
    worstMs: number
}

export interface FpsMeter {
    /** Adds one frame. Returns the report of the window it just closed, or undefined while the window is still filling. */
    frame(deltaMs: number): FpsReport | undefined
}

/** Gaps longer than this (a tab switch, a debugger pause) are not frames and are ignored. */
export const MAX_FRAME_MS = 1000

/** Frames per second over a window; an empty window (no frames or no time) is 0. */
export function fpsOf(frames: number, elapsedMs: number): number {
    if (frames <= 0 || elapsedMs <= 0) return 0
    return Math.round((frames * 1000) / elapsedMs)
}

/** Average and worst frame time of a window; an empty window is 0 for both. */
export function frameTimesOf(frames: number, elapsedMs: number, worstMs: number): { avgMs: number; worstMs: number } {
    if (frames <= 0) return { avgMs: 0, worstMs: 0 }
    return { avgMs: elapsedMs / frames, worstMs }
}

export function formatFpsReadout({ fps, avgMs, worstMs }: FpsReport): string {
    return `FPS: ${fps} (${avgMs.toFixed(1)}ms, worst ${Math.round(worstMs)}ms)`
}

export function createFpsMeter(windowMs = 500): FpsMeter {
    let frames = 0
    let elapsed = 0
    let worst = 0
    return {
        frame(deltaMs) {
            if (deltaMs > MAX_FRAME_MS) return undefined
            frames += 1
            elapsed += deltaMs
            worst = Math.max(worst, deltaMs)
            if (elapsed < windowMs) return undefined
            const report = { fps: fpsOf(frames, elapsed), ...frameTimesOf(frames, elapsed, worst) }
            frames = 0
            worst = 0
            // Carry the overshoot into the next window; % keeps one huge frame from closing several windows.
            elapsed %= windowMs
            return report
        },
    }
}
