import type { OffsetCoordinates, Point } from '@tabletop/common'
import {
    type Board,
    CentralCell,
    MaxGridSize,
    neighborCell,
    SidesClockwise
} from '@tabletop/conduit'

export const CellSize = 100

export interface BoardBounds {
    minCol: number
    maxCol: number
    minRow: number
    maxRow: number
}

// The board includes every empty cell beside a tile that could still take one, so it does not jump
// when placement targets light up. Cells past the 6x6 limit never can, so the board is at most
// one cell wider than the limit.
export function boardBounds(board: Board): BoardBounds {
    const occupied = [CentralCell, ...board.stations.map((station) => station.cell)]
    const cols = occupied.map((cell) => cell.col)
    const rows = occupied.map((cell) => cell.row)
    const fits = (values: number[], value: number) =>
        Math.max(...values, value) - Math.min(...values, value) + 1 <= MaxGridSize
    const cells = occupied.flatMap((cell) => [
        cell,
        ...SidesClockwise.map((side) => neighborCell(cell, side)).filter(
            (neighbor) => fits(cols, neighbor.col) && fits(rows, neighbor.row)
        )
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
