import type { ResolvedSlot, Theme } from './theme.ts'

export function buildPrompt(theme: Theme, slot: ResolvedSlot): string {
    return `${slot.description}, ${theme.style}, single centred object on flat ${slot.keyColour} background`
}
