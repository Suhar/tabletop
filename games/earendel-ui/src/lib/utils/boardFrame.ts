import type { AxialCoordinates } from '@tabletop/common'
import { hexGeometry } from './hexDefinition.js'

const PADDING = 60

export type BoardFrame = { minX: number; minY: number; maxX: number; maxY: number }

// The frame that holds these hexes with room around them: the board's SVG viewBox.
export function boardFrame(hexes: AxialCoordinates[]): BoardFrame {
    if (hexes.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    const boxes = hexes.map((coords) => hexGeometry(coords).boundingBox)

    return {
        minX: Math.min(...boxes.map((box) => box.x)) - PADDING,
        minY: Math.min(...boxes.map((box) => box.y)) - PADDING,
        maxX: Math.max(...boxes.map((box) => box.x + box.width)) + PADDING,
        maxY: Math.max(...boxes.map((box) => box.y + box.height)) + PADDING
    }
}

export function viewBoxOf(frame: BoardFrame): string {
    return `${frame.minX} ${frame.minY} ${frame.maxX - frame.minX} ${frame.maxY - frame.minY}`
}
