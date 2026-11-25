import type { OffsetCoordinates, Point } from '@tabletop/common'
import { type Board, CentralCell, neighborCell, SidesClockwise } from '@tabletop/conduit'

export const CellSize = 100

export interface BoardBounds {
    minCol: number
    maxCol: number
    minRow: number
    maxRow: number
}

// The board shows every placed tile and every empty cell beside one, so it does not jump when a
// placement lights up its candidate cells.
export function boardBounds(board: Board): BoardBounds {
    const occupied = [CentralCell, ...board.stations.map((station) => station.cell)]
    const cells = occupied.flatMap((cell) => [
        cell,
        ...SidesClockwise.map((side) => neighborCell(cell, side))
    ])
    return {
        minCol: Math.min(...cells.map((cell) => cell.col)),
        maxCol: Math.max(...cells.map((cell) => cell.col)),
        minRow: Math.min(...cells.map((cell) => cell.row)),
        maxRow: Math.max(...cells.map((cell) => cell.row))
    }
}

export function boardSize(bounds: BoardBounds): { width: number; height: number } {
    return {
        width: (bounds.maxCol - bounds.minCol + 1) * CellSize,
        height: (bounds.maxRow - bounds.minRow + 1) * CellSize
    }
}

export function cellOrigin(cell: OffsetCoordinates, bounds: BoardBounds): Point {
    return {
        x: (cell.col - bounds.minCol) * CellSize,
        y: (cell.row - bounds.minRow) * CellSize
    }
}

export function cellKey(cell: OffsetCoordinates): string {
    return `${cell.col}_${cell.row}`
}

// Element ids anchor the placement popup; a minus sign is spelt 'm' to keep the selector plain.
export function cellElementId(cell: OffsetCoordinates): string {
    const part = (value: number) => (value < 0 ? `m${-value}` : `${value}`)
    return `conduit-cell-${part(cell.col)}-${part(cell.row)}`
}
