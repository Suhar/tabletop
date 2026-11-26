import type { OffsetCoordinates, Point } from '@tabletop/common'
import { AuctionSpots, BidTrackSpaces, type Board } from '@tabletop/conduit'
import { boardBounds, boardSize, CellSize, cellOrigin, type BoardBounds } from './boardLayout.js'

export const TrackCell = 30
export const TrackWidth = 2 * TrackCell
export const TrackHeight = ((BidTrackSpaces + 1) * TrackCell) / 2
export const TileInSpot = 92
const SpotPadding = 8
const TrackToTile = 8
export const SpotWidth = 2 * SpotPadding + TrackWidth + TrackToTile + TileInSpot
export const SpotHeight = 2 * SpotPadding + TrackHeight
export const SpotGap = 12
export const TableMargin = 20
export const AuctionToBoardGap = 34
// A 6x6 grid and the ring of empty cells shown around it.
export const GridReach = 8 * CellSize

export const TileOrigin: Point = { x: TrackWidth + TrackToTile, y: TrackHeight - TileInSpot }

export function trackCellOrigin(index: number): Point {
    return { x: (index % 2) * TrackCell, y: ((BidTrackSpaces - 1 - index) * TrackCell) / 2 }
}

export function centredTextShift(fontSize: number): number {
    return fontSize * 0.35
}

// On a wide screen the grid gets room for its full reach, so the table keeps its size and the
// auction never moves.
export interface TableGeometry {
    width: number
    height: number
    auctionColumns: number
    beside: boolean
    auction: Point
    auctionScale: number
    grid: Point
    bounds: BoardBounds
}

export function auctionSize(columns: number): { width: number; height: number } {
    const rows = Math.ceil(AuctionSpots / columns)
    return {
        width: columns * SpotWidth + (columns - 1) * SpotGap,
        height: rows * SpotHeight + (rows - 1) * SpotGap
    }
}

export function spotOrigin(spot: number, columns: number): Point {
    const index = spot - 1
    return {
        x: (index % columns) * (SpotWidth + SpotGap),
        y: Math.floor(index / columns) * (SpotHeight + SpotGap)
    }
}

export function tableGeometry(board: Board, auctionColumns: number, beside = false): TableGeometry {
    const bounds = boardBounds(board)
    const grid = boardSize(bounds)
    const auction = auctionSize(auctionColumns)
    if (beside) {
        const room = {
            width: Math.max(GridReach, grid.width),
            height: Math.max(GridReach, grid.height)
        }
        const auctionScale = GridReach / auction.height
        const roomX = TableMargin + auction.width * auctionScale + AuctionToBoardGap
        return {
            width: roomX + room.width + TableMargin,
            height: Math.max(auction.height * auctionScale, room.height) + 2 * TableMargin,
            auctionColumns,
            beside,
            auction: { x: TableMargin, y: TableMargin },
            auctionScale,
            grid: {
                x: roomX + (room.width - grid.width) / 2,
                y: TableMargin + (room.height - grid.height) / 2
            },
            bounds
        }
    }
    const width = Math.max(auction.width, grid.width) + 2 * TableMargin
    return {
        width,
        height: auction.height + AuctionToBoardGap + grid.height + 2 * TableMargin,
        auctionColumns,
        beside,
        auction: { x: (width - auction.width) / 2, y: TableMargin },
        auctionScale: 1,
        grid: { x: (width - grid.width) / 2, y: TableMargin + auction.height + AuctionToBoardGap },
        bounds
    }
}

export function spotTileOrigin(spot: number, geometry: TableGeometry): Point {
    const origin = spotOrigin(spot, geometry.auctionColumns)
    const scale = geometry.auctionScale
    return {
        x: geometry.auction.x + scale * (origin.x + SpotPadding + TileOrigin.x),
        y: geometry.auction.y + scale * (origin.y + SpotPadding + TileOrigin.y)
    }
}

export function cellTableOrigin(cell: OffsetCoordinates, geometry: TableGeometry): Point {
    const origin = cellOrigin(cell, geometry.bounds)
    return { x: geometry.grid.x + origin.x, y: geometry.grid.y + origin.y }
}
