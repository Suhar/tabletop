import type { Point } from '@tabletop/common'
import { Side, StationLetter, Terminal } from '@tabletop/conduit'

export const TileArtSize = 531.496
export const TileArtCentre = TileArtSize / 2
export const TileBoardColor = 'rgb(20,50,96)'

export const TraceHalfWidth = 16.5
export const TraceOutlineHalfWidth = 19
export const TraceOutlineColor = 'rgb(35,31,32)'
export const CopperEdgeColor = 'rgb(150,104,55)'
export const CopperCentreColor = 'rgb(219,116,13)'

export const TraceRunStart = TileArtCentre - TraceHalfWidth
export const TraceRunEnd = TileArtCentre + TraceHalfWidth
export const TraceOutlineStart = TileArtCentre - TraceOutlineHalfWidth
// The north and south runs end in mitred points over the east-west run, as the art draws them.
export const NorthTraceRun = `M${TraceRunStart} 0L${TraceRunEnd} 0L${TraceRunEnd} ${TraceRunStart}L${TileArtCentre} ${TileArtCentre}L${TraceRunStart} ${TraceRunStart}Z`
export const SouthTraceRun = `M${TraceRunStart} ${TileArtSize}L${TraceRunEnd} ${TileArtSize}L${TraceRunEnd} ${TraceRunEnd}L${TileArtCentre} ${TileArtCentre}L${TraceRunStart} ${TraceRunEnd}Z`

export const TerminalRadius = 59.172
export const TerminalColors: Record<Terminal, string> = {
    [Terminal.Positive]: 'rgb(242,13,13)',
    [Terminal.Negative]: '#000'
}

export const EmblemStroke = 4.17
export const LetterGlowWidths = [12, 8, 4]

type EmblemShape =
    | { kind: 'hexagon'; circumradius: number }
    | { kind: 'square'; halfSide: number }
    | { kind: 'circle'; radius: number }
    | { kind: 'diamond'; halfDiagonal: number }

export interface EmblemArt {
    shape: EmblemShape
    fill: string
    // The letter, as outlines of OCR-A (Matthew Skala's public-domain font), centred by its ink.
    letter: string
}

export const Emblems: Record<StationLetter, EmblemArt> = {
    [StationLetter.A]: {
        shape: { kind: 'hexagon', circumradius: 112.84 },
        fill: 'rgb(198,144,0)',
        letter: 'M-42.5 57.4C-42.5 62.1-38.4 66-33.7 66C-29.8 66-26.4 63.5-25.4 59.9L-18.8 37.2L19.0 37.2L25.6 59.9C26.6 63.5 29.8 66 33.7 66C38.4 66 42.5 62.1 42.5 57.4L8.3-59.9C7.3-63.5 3.7-66 0.0-66C-3.9-66-7.1-63.5-8.1-59.9ZM-13.7 20.1L0.0-26.9L13.9 20.1Z'
    },
    [StationLetter.B]: {
        shape: { kind: 'square', halfSide: 98.66 },
        fill: 'rgb(77,153,230)',
        letter: 'M-42.1 66L8.0 66C26.6 66 42.1 50.3 42.1 31.8L42.1 25.6C42.1 15.6 37.4 6.3 30.3 0C37.4-6.3 42.1-15.6 42.1-25.6L42.1-31.8C42.1-50.3 26.6-66 8.0-66L-42.1-66ZM-25.0 48.9L-25.0 8.5L8.0 8.5C17.1 8.5 25.0 16.4 25.0 25.6L25.0 31.8C25.0 41.0 17.1 48.9 8.0 48.9ZM-25.0-8.6L-25.0-48.9L8.0-48.9C17.1-48.9 25.0-41.0 25.0-31.8L25.0-25.6C25.0-16.4 17.1-8.6 8.0-8.6Z'
    },
    [StationLetter.C]: {
        shape: { kind: 'circle', radius: 106.58 },
        fill: 'rgb(103,162,105)',
        letter: 'M-42.1 0C-42.1 6.9-40.4 12.4-38.1 17.4C-32.7 29.3-26.7 40.4-20.8 51.8C-16.9 59.4-8.5 66 2.0 66L33.5 66C38.2 66 42.1 62.1 42.1 57.4C42.1 52.8 38.2 48.9 33.5 48.9L2.0 48.9C-1.4 48.9-4.2 46.7-5.4 44.2L-22.8 9.8C-24.2 6.9-25.0 3.9-25.0 0C-25.0-3.9-24.2-6.9-22.8-9.8L-5.4-44.2C-4.2-46.7-1.4-48.9 2.0-48.9L33.5-48.9C38.2-48.9 42.1-52.8 42.1-57.5C42.1-62.1 38.2-66 33.5-66L2.0-66C-8.5-66-17.4-59.7-21.0-52.0L-38.1-17.4C-40.4-12.5-42.1-6.9-42.1 0Z'
    },
    [StationLetter.D]: {
        shape: { kind: 'diamond', halfDiagonal: 143.62 },
        fill: 'rgb(131,99,175)',
        letter: 'M-42.1 57.4C-42.1 62.1-38.4 66-33.7 66L-2.2 66C8.3 66 17.3 59.7 20.8 52.0L37.9 17.4C40.3 12.5 42.1 6.8 42.1 0C42.1-6.8 40.3-12.5 37.9-17.4L20.6-51.8C16.8-59.4 8.3-66-2.2-66L-33.7-66C-38.4-66-42.1-62.1-42.1-57.5C-42.1-52.8-38.4-48.9-33.7-48.9L-25.4-48.9L-25.4 48.9L-33.7 48.9C-38.4 48.9-42.1 52.8-42.1 57.4ZM-8.3 48.9L-8.3-48.9L-2.2-48.9C1.2-48.9 4.1-46.7 5.2-44.2L22.7-9.8C23.9-6.9 25.0-3.7 25.0 0C25.0 3.7 23.9 6.9 22.7 9.8L5.2 44.2C4.1 46.7 1.2 48.9-2.2 48.9Z'
    }
}

export function emblemPath(letter: StationLetter, grow = 0, scale = 1): string {
    const shape = Emblems[letter].shape
    switch (shape.kind) {
        case 'hexagon': {
            const radius =
                (shape.circumradius * Math.cos(Math.PI / 6) + grow) / Math.cos(Math.PI / 6)
            return polygonPath(
                [0, 1, 2, 3, 4, 5].map((corner) => {
                    const angle = ((corner * 60 - 90) * Math.PI) / 180
                    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
                }),
                scale
            )
        }
        case 'square': {
            const half = shape.halfSide + grow
            return polygonPath(
                [
                    { x: -half, y: -half },
                    { x: half, y: -half },
                    { x: half, y: half },
                    { x: -half, y: half }
                ],
                scale
            )
        }
        case 'circle': {
            const radius = (shape.radius + grow) * scale
            return `M${radius} 0A${radius} ${radius} 0 1 1 ${-radius} 0A${radius} ${radius} 0 1 1 ${radius} 0Z`
        }
        case 'diamond': {
            const half = shape.halfDiagonal + grow * Math.SQRT2
            return polygonPath(
                [
                    { x: 0, y: -half },
                    { x: half, y: 0 },
                    { x: 0, y: half },
                    { x: -half, y: 0 }
                ],
                scale
            )
        }
    }
}

function polygonPath(points: Point[], scale: number): string {
    return (
        points
            .map(
                (point, index) =>
                    `${index === 0 ? 'M' : 'L'}${round(point.x * scale)} ${round(point.y * scale)}`
            )
            .join('') + 'Z'
    )
}

function round(value: number): number {
    return Math.round(value * 100) / 100
}

export const TileBoardId = 'conduit-tile-board'

export function emblemId(letter: StationLetter): string {
    return `conduit-emblem-${letter}`
}

export function terminalCentre(side: Side): Point {
    switch (side) {
        case Side.North:
            return { x: TileArtCentre, y: 0 }
        case Side.East:
            return { x: TileArtSize, y: TileArtCentre }
        case Side.South:
            return { x: TileArtCentre, y: TileArtSize }
        case Side.West:
            return { x: 0, y: TileArtCentre }
    }
}
