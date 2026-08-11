import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HEX_STEPS, HexKind, hexKey } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'

type Sighting = { piece: Piece; coords: AxialCoordinates }

// The first piece met walking out from a hex in one direction, with where it stands.
// Undefined if the walk leaves the board or meets a planet first: a planet blocks the view,
// being a world rather than a gap to see past.
function firstPieceAlong(
    board: EarendelBoard,
    from: AxialCoordinates,
    step: AxialCoordinates
): Sighting | undefined {
    let coords = { q: from.q + step.q, r: from.r + step.r }

    for (;;) {
        const hex = getHex(board, coords)
        if (!hex || hex.kind === HexKind.Planet) return undefined
        if (hex.piece) return { piece: hex.piece, coords }
        coords = { q: coords.q + step.q, r: coords.r + step.r }
    }
}

// Whether this empty hex sits on a clear line between two stations belonging to one other
// player, and if so which player. Their blockade stops probes only: an opponent may still
// put a station or a fighter here, and doing so is exactly what breaks the line.
//
// Only the three axes need testing rather than all six directions, because a line runs both
// ways: step i and step i+3 are opposite. Walking out from the hex itself also settles
// "clear" for free - if the walk reaches a station without meeting anything, every hex
// between the two stations is empty by construction.
export function probeBlockedBy(
    board: EarendelBoard,
    coords: AxialCoordinates,
    playerId: string
): string | undefined {
    for (let axis = 0; axis < 3; axis++) {
        const near = firstPieceAlong(board, coords, HEX_STEPS[axis])
        if (near?.piece.type !== PieceType.Station || near.piece.playerId === playerId) continue

        const far = firstPieceAlong(board, coords, HEX_STEPS[axis + 3])
        if (far?.piece.type !== PieceType.Station) continue

        if (far.piece.playerId === near.piece.playerId) return near.piece.playerId
    }

    return undefined
}

// The stations of the same player that this station has a clear line to. A wavy line on the
// board is exactly one of these, and it now links a station complex for scoring as well as
// closing the space to enemy probes.
//
// The walk starts one hex out, so a station standing right next door is not a sight link -
// there is no clear space between them. That costs nothing, since touching stations are
// already linked by adjacency.
export function sightLinkedStations(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates[] {
    const station = getHex(board, coords)?.piece
    if (station?.type !== PieceType.Station) return []

    const linked: AxialCoordinates[] = []

    for (const step of HEX_STEPS) {
        const gap = getHex(board, { q: coords.q + step.q, r: coords.r + step.r })
        if (!gap || gap.kind === HexKind.Planet || gap.piece) continue

        const far = firstPieceAlong(board, gap.coords, step)
        if (far?.piece.type !== PieceType.Station) continue
        if (far.piece.playerId !== station.playerId) continue

        linked.push(far.coords)
    }

    return linked
}

export type SightLine = {
    playerId: string
    from: AxialCoordinates
    to: AxialCoordinates
}

// Every pair of one player's stations with clear empty space between them along an axis - the
// wavy lines on the board. One entry per pair; the walk finds each line from both ends.
//
// Adjacent stations don't count: with no space between them there is nothing to close off,
// and they are already one complex by adjacency.
export function sightLines(board: EarendelBoard): SightLine[] {
    const lines: SightLine[] = []
    const seen = new Set<string>()

    for (const hex of Object.values(board.hexes)) {
        const station = hex.piece
        if (station?.type !== PieceType.Station) continue

        for (const far of sightLinkedStations(board, hex.coords)) {
            // One entry per pair, however it was found - the walk sees each line from both
            // ends, and drawing it twice would double the beam.
            const key = [hexKey(hex.coords), hexKey(far)].sort((a, b) => a - b).join(':')
            if (seen.has(key)) continue
            seen.add(key)

            lines.push({ playerId: station.playerId, from: hex.coords, to: far })
        }
    }

    return lines
}

// Every hex this player's probes are shut out of. The engine enforces the rule one hex at a
// time in PlacePiece; this is for showing the blockade.
export function hexesClosedToProbesOf(
    board: EarendelBoard,
    playerId: string
): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.kind === HexKind.Open && !hex.piece)
        .filter((hex) => probeBlockedBy(board, hex.coords, playerId) !== undefined)
        .map((hex) => hex.coords)
}
