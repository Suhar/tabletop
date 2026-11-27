import type { StationLetter } from '@tabletop/conduit'
import { CellSize } from './boardLayout.js'
import { EmblemStroke, TileArtSize, emblemPath } from './tileArt.js'

export const RingStroke = 4.5
const RingGap = 3

export function emblemRing(letter: StationLetter): string {
    const scale = CellSize / TileArtSize
    const outsideOutline = EmblemStroke / 2 + (RingGap + RingStroke / 2) / scale
    return emblemPath(letter, outsideOutline, scale)
}
