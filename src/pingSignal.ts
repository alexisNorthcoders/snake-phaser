export const BAR_COUNT = 4;

// Lit bars for a round-trip time in ms; undefined (no ping yet) lights none.
export function litBars(pingMs: number | undefined): number {
  if (pingMs === undefined) return 0;
  if (pingMs < 50) return 4;
  if (pingMs < 100) return 3;
  if (pingMs < 200) return 2;
  return 1;
}

export function formatPingReadout(pingMs: number | undefined): string {
  return `Ping: ${pingMs === undefined ? '--' : pingMs}ms`;
}

export const HEADER = {
  height: 40,
  ruleHeight: 4,
  paddingX: 20,
  barWidth: 4,
  barGap: 2,
  barHeightStep: 4,
  litColour: 0x00ff00,
  unlitColour: 0x555555,
} as const;

// Total height of the strip including its bottom rule; content below starts here.
export const HEADER_BOTTOM = HEADER.height + HEADER.ruleHeight;
