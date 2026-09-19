export const FONT_FAMILY = "'Pixelify Sans', Courier, 'Courier New', monospace";

const FONT_LOADS = ["400 16px 'Pixelify Sans'", "500 16px 'Pixelify Sans'"];

interface FontSet {
  load(font: string): Promise<unknown>;
}

/** Resolves once both weights are ready; never rejects, so a failed load falls back to monospace. */
export async function loadGameFont(fonts: FontSet | undefined = globalThis.document?.fonts): Promise<void> {
  if (!fonts) return;
  try {
    await Promise.all(FONT_LOADS.map((f) => fonts.load(f)));
  } catch {
    // fall through: FONT_FAMILY already lists the fallback
  }
}

/** Fills in the default fontFamily for a Phaser text style without overriding an explicit one. */
export function withDefaultFont<T extends { fontFamily?: string }>(style?: T): T & { fontFamily: string } {
  return { fontFamily: FONT_FAMILY, ...style } as T & { fontFamily: string };
}
