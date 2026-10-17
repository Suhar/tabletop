import { assertExists, type BoundingBox, type Point } from '@tabletop/common'
import { ACTION_TRACK_LIMIT, MapId, type RailroadId } from '@tabletop/south-african-railroads'
import { SOUTH_AFRICA_LAYOUT } from './maps/southAfrica.js'
import { TEXAS_SPECIAL_LAYOUT } from './maps/texasSpecial.js'

export const LINK_BOX_SIZE = 28
export const METRO_CELL = 27
export const ACTION_TRACK_CELL = 24

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
    actionTrackColumns: number
    roundIndicator: Point
    legend: Point
    finalPayoff: Point
    // The centre of the title's baseline.
    logo: Point
    title: string
    credit: string
    // Where the map's special connection, if it has one, is explained.
    specialConnection?: Point
    // Where the order of Automatic Metro Development is printed, when there is more than one.
    automaticDevelopment?: Point
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
export const SPECIAL_CONNECTION_SIZE = { width: 300, height: 132 }
export const AUTOMATIC_DEVELOPMENT_SIZE = { width: 300, height: 52 }

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

    get actionTrackRows(): number {
        return Math.ceil((ACTION_TRACK_LIMIT + 1) / this.spec.actionTrackColumns)
    }

    // The heading sits above the cells and the note below them.
    get actionTrack(): BoundingBox {
        return {
            x: this.spec.actionTrack.x - 4,
            y: this.spec.actionTrack.y - 26,
            width: this.spec.actionTrackColumns * ACTION_TRACK_CELL + 8,
            height: this.actionTrackRows * ACTION_TRACK_CELL + 46
        }
    }

    get logo(): BoundingBox {
        return {
            x: this.spec.logo.x - LOGO_SIZE.width / 2,
            y: this.spec.logo.y - 30,
            ...LOGO_SIZE
        }
    }

    get specialConnection(): BoundingBox | undefined {
        const origin = this.spec.specialConnection
        return origin ? { ...origin, ...SPECIAL_CONNECTION_SIZE } : undefined
    }

    get automaticDevelopment(): BoundingBox | undefined {
        const origin = this.spec.automaticDevelopment
        return origin ? { ...origin, ...AUTOMATIC_DEVELOPMENT_SIZE } : undefined
    }

    // Printed furniture the settlement names must stay off.
    get furniture(): BoundingBox[] {
        return [
            this.legend,
            this.finalPayoff,
            this.roundIndicator,
            this.actionTrack,
            this.logo,
            ...(this.specialConnection ? [this.specialConnection] : []),
            ...(this.automaticDevelopment ? [this.automaticDevelopment] : [])
        ]
    }

    metroGrid(settlementId: string): MetroGrid {
        const grid = this.spec.metroGrids[settlementId]
        assertExists(grid, `No development grid for ${settlementId}`)
        return grid
    }
}

const BOARD_LAYOUTS: Record<MapId, BoardLayout> = {
    [MapId.SouthAfrica]: new BoardLayout(SOUTH_AFRICA_LAYOUT),
    [MapId.TexasSpecial]: new BoardLayout(TEXAS_SPECIAL_LAYOUT)
}

export function boardLayout(mapId: MapId): BoardLayout {
    return BOARD_LAYOUTS[mapId]
}
