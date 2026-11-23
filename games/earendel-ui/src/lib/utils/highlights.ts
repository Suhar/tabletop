import type { AxialCoordinates } from '@tabletop/common'

export const HighlightPrecedence = [
    // An elevated event's pick owns the board while it is being made.
    'event',
    // A nebula seeder's hexes, and the artificial planet awaiting its color.
    'seeding',
    'founding',
    'shift',
    'warp',
    'rift',
    'spoof',
    'feint',
    'wormhole',
    'download',
    'updatedLogistics',
    'colony',
    'tileOrigins',
    'bonusPlacement',
    'technologyMove',
    'terraform',
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
