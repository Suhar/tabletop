import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HEX_STEPS, HexKind, hexKey } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'

type Sighting = { piece: Piece; coords: AxialCoordinates }

type Along = Sighting & { clear: boolean }

// Every piece along a line from `from`, until a planet or the board's edge, each with whether
// nothing stands between it and `from`.
function piecesAlong(
    board: EarendelBoard,
    from: AxialCoordinates,
    step: AxialCoordinates
): Along[] {
    const found: Along[] = []
    let clear = true
    let coords = { q: from.q + step.q, r: from.r + step.r }

    for (;;) {
        const hex = getHex(board, coords)
        if (!hex || hex.kind === HexKind.Planet) return found
        if (hex.piece) {
            found.push({ piece: hex.piece, coords, clear })
            clear = false
        }
        coords = { q: coords.q + step.q, r: coords.r + step.r }
    }
}

const isRelay = (piece: Piece) => piece.type === PieceType.Relay

// Stations and relays anchor every sight line rule (rules.md, Relay).
export function isSightAnchor(piece: Piece | undefined): boolean {
    return piece?.type === PieceType.Station || piece?.type === PieceType.Relay
}

// A line between two pieces holds if nothing stands between them, or either is a relay, whose
// sight only planets block.
function holds(from: Piece, to: Along): boolean {
    return to.clear || isRelay(from) || isRelay(to.piece)
}

export function probeBlockedBy(
    board: EarendelBoard,
    coords: AxialCoordinates,
    playerId: string
): string | undefined {
    for (let axis = 0; axis < 3; axis++) {
        const one = piecesAlong(board, coords, HEX_STEPS[axis]).filter(
            (seen) => isSightAnchor(seen.piece) && seen.piece.playerId !== playerId
        )
        const other = piecesAlong(board, coords, HEX_STEPS[axis + 3]).filter(
            (seen) => isSightAnchor(seen.piece) && seen.piece.playerId !== playerId
        )

        for (const a of one) {
            for (const b of other) {
                if (a.piece.playerId !== b.piece.playerId) continue
                if ((a.clear && b.clear) || isRelay(a.piece) || isRelay(b.piece)) {
                    return a.piece.playerId
                }
            }
        }
    }

    return undefined
}

// The pieces belonging to the same player as the piece at `coords` that it can see along the six
// axes and that `wanted` accepts (rules.md, Relay).
function ownPiecesInSight(
    board: EarendelBoard,
    coords: AxialCoordinates,
    wanted: (piece: Piece) => boolean
): AxialCoordinates[] {
    const piece = getHex(board, coords)?.piece
    if (!piece) return []

    return HEX_STEPS.flatMap((step) =>
        piecesAlong(board, coords, step)
            .filter(
                (seen) =>
                    seen.piece.playerId === piece.playerId &&
                    wanted(seen.piece) &&
                    holds(piece, seen)
            )
            .map((seen) => seen.coords)
    )
}

// The player's own stations and relays a probe at `coords` is relayed by.
export function relayStationsOf(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates[] {
    if (getHex(board, coords)?.piece?.type !== PieceType.Probe) return []
    return ownPiecesInSight(board, coords, isSightAnchor)
}

// The player's own probes a station or relay at `coords` relays.
export function relayedProbesOf(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates[] {
    if (!isSightAnchor(getHex(board, coords)?.piece)) return []
    return ownPiecesInSight(board, coords, (piece) => piece.type === PieceType.Probe)
}

// The player's own stations and relays a station or relay at `coords` links to by sight, across
// at least one hex: next door is a link by touch instead.
export function sightLinkedStations(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates[] {
    const anchor = getHex(board, coords)?.piece
    if (!anchor || !isSightAnchor(anchor)) return []

    return HEX_STEPS.flatMap((step) => {
        const next = { q: coords.q + step.q, r: coords.r + step.r }
        return piecesAlong(board, coords, step)
            .filter(
                (seen) =>
                    !(seen.coords.q === next.q && seen.coords.r === next.r) &&
                    isSightAnchor(seen.piece) &&
                    seen.piece.playerId === anchor.playerId &&
                    holds(anchor, seen)
            )
            .map((seen) => seen.coords)
    })
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
        if (!station || !isSightAnchor(station)) continue

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
