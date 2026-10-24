import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HEX_STEPS, HexKind, hexKey } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'

type Sighting = { piece: Piece; coords: AxialCoordinates }

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

// The pieces of `type` belonging to the same player as the piece at `coords` that it can see
// along the six axes, past empty space only (rules.md, Relay).
function ownPiecesInSight(
    board: EarendelBoard,
    coords: AxialCoordinates,
    type: PieceType
): AxialCoordinates[] {
    const piece = getHex(board, coords)?.piece
    if (!piece) return []

    return HEX_STEPS.flatMap((step) => {
        const seen = firstPieceAlong(board, coords, step)
        return seen?.piece.type === type && seen.piece.playerId === piece.playerId
            ? [seen.coords]
            : []
    })
}

// The player's own stations a probe at `coords` is relayed by.
export function relayStationsOf(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates[] {
    if (getHex(board, coords)?.piece?.type !== PieceType.Probe) return []
    return ownPiecesInSight(board, coords, PieceType.Station)
}

// The player's own probes a station at `coords` relays.
export function relayedProbesOf(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates[] {
    if (getHex(board, coords)?.piece?.type !== PieceType.Station) return []
    return ownPiecesInSight(board, coords, PieceType.Probe)
}

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

export function planetsInSightOf(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates[] {
    const seen: AxialCoordinates[] = []

    for (const step of HEX_STEPS) {
        let at = { q: coords.q + step.q, r: coords.r + step.r }

        for (;;) {
            const hex = getHex(board, at)
            if (!hex) break
            if (hex.kind === HexKind.Planet) {
                seen.push(hex.coords)
                break
            }
            if (hex.piece) break
            at = { q: at.q + step.q, r: at.r + step.r }
        }
    }

    return seen
}

export type SightLine = {
    playerId: string
    from: AxialCoordinates
    to: AxialCoordinates
}

export function sightLines(board: EarendelBoard): SightLine[] {
    const lines: SightLine[] = []
    const seen = new Set<string>()

    for (const hex of Object.values(board.hexes)) {
        const station = hex.piece
        if (station?.type !== PieceType.Station) continue

        for (const far of sightLinkedStations(board, hex.coords)) {
            const key = [hexKey(hex.coords), hexKey(far)].sort((a, b) => a - b).join(':')
            if (seen.has(key)) continue
            seen.add(key)

            lines.push({ playerId: station.playerId, from: hex.coords, to: far })
        }
    }

    return lines
}

export function hexesClosedToProbesOf(board: EarendelBoard, playerId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.kind === HexKind.Open && !hex.piece)
        .filter((hex) => probeBlockedBy(board, hex.coords, playerId) !== undefined)
        .map((hex) => hex.coords)
}
