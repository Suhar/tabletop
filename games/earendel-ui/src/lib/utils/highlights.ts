import type { AxialCoordinates } from '@tabletop/common'

export const HighlightPrecedence = [
    'feint',
    'wormhole',
    'download',
    'updatedLogistics',
    'tileOrigins',
    'bonusPlacement',
    'technologyMove',
    'survey',
    'attack',
    'placement'
] as const

export type HighlightLayer = (typeof HighlightPrecedence)[number]

export type ActiveHighlights = Partial<Record<HighlightLayer, AxialCoordinates[]>>

export function highlightedHexesOf(active: ActiveHighlights): AxialCoordinates[] {
    const owner = HighlightPrecedence.find((layer) => active[layer] !== undefined)
    return owner ? (active[owner] ?? []) : []
}
