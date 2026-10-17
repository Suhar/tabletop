import { assertExists, type BoundingBox, type Point } from '@tabletop/common'
import { MapId, type RailroadId } from '@tabletop/south-african-railroads'
import { SOUTH_AFRICA_LAYOUT } from './maps/southAfrica.js'

export const LINK_BOX_SIZE = 28
export const METRO_CELL = 27
export const ACTION_TRACK_CELL = 24
export const ACTION_TRACK_PER_ROW = 18

export type MapLabel = Point & { rotate?: number }
export type BaseName = Point & { railroadId: RailroadId }
export type MetroGrid = { columns: number; origin: Point }
export type RegionLabel = Point & { lines: string[]; rotate?: number }

export type BoardLayoutSpec = {
    width: number
    // The printed board's rows above the play area are cropped away; the map keeps the printed
    // coordinates.
    top: number
    bottom: number
    actionTrack: Point
    roundIndicator: Point
    legend: Point
    finalPayoff: Point
    // The centre of the title's baseline.
    logo: Point
    credit: string
    metroGrids: Readonly<Record<string, MetroGrid>>
    baseNames: readonly BaseName[]
    // Where the printed board sets each settlement name: the start of its baseline.
    printedLabels: Readonly<Record<string, MapLabel>>
    regions: readonly RegionLabel[]
}

export const LEGEND_SIZE = { width: 226, height: 162 }
export const FINAL_PAYOFF_SIZE = { width: 300, height: 112 }
export const ROUND_INDICATOR_SIZE = { width: 200, height: 48 }
export const LOGO_SIZE = { width: 360, height: 62 }

export class BoardLayout {
    readonly width: number
    readonly top: number
    readonly height: number

    constructor(readonly spec: BoardLayoutSpec) {
        this.width = spec.width
        this.top = spec.top
        this.height = spec.bottom - spec.top
    }

    get legend(): BoundingBox {
        return { x: this.spec.legend.x - 2, y: this.spec.legend.y - 2, ...LEGEND_SIZE }
    }

    get finalPayoff(): BoundingBox {
        return { ...this.spec.finalPayoff, ...FINAL_PAYOFF_SIZE }
    }

    get roundIndicator(): BoundingBox {
        return {
            x: this.spec.roundIndicator.x - 2,
            y: this.spec.roundIndicator.y - 4,
            ...ROUND_INDICATOR_SIZE
        }
    }

    get actionTrack(): BoundingBox {
        return {
            x: this.spec.actionTrack.x - 4,
            y: this.spec.actionTrack.y - 26,
            width: ACTION_TRACK_PER_ROW * ACTION_TRACK_CELL + 8,
            height: 2 * ACTION_TRACK_CELL + 30
        }
    }

    get logo(): BoundingBox {
        return {
            x: this.spec.logo.x - LOGO_SIZE.width / 2,
            y: this.spec.logo.y - 30,
            ...LOGO_SIZE
        }
    }

    // Printed furniture the settlement names must stay off.
    get furniture(): BoundingBox[] {
        return [this.legend, this.finalPayoff, this.roundIndicator, this.actionTrack, this.logo]
    }

    metroGrid(settlementId: string): MetroGrid {
        const grid = this.spec.metroGrids[settlementId]
        assertExists(grid, `No development grid for ${settlementId}`)
        return grid
    }
}

const BOARD_LAYOUTS: Record<MapId, BoardLayout> = {
    [MapId.SouthAfrica]: new BoardLayout(SOUTH_AFRICA_LAYOUT)
}

export function boardLayout(mapId: MapId): BoardLayout {
    return BOARD_LAYOUTS[mapId]
}
