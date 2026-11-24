import type { AxialCoordinates, GameAction } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    isAttackPiece,
    isAttackSpread,
    isEventPick,
    isPlacePiece,
    isUseTacticalFeint,
    isUseTradeRouteWormhole,
    isUseTacticalShift,
    isUseColonyShip,
    isUseWarpDrive,
    isUseDimensionalRift,
    routeChangesOf
} from '@tabletop/earendel'

export type ScoreSource = {
    coords: AxialCoordinates
    points: number
    caption: 'complex' | 'route' | 'bounty'
    playerId: string
}

// A torpedo's shot is the impact: it blasts at the station, once the torpedo has run into it.
export type Shot = { coords: AxialCoordinates; destroyed: boolean; torpedo?: boolean }

export type TorpedoStrike = { pieceId: string; from: AxialCoordinates; to: AxialCoordinates }

export type PieceMove = { pieceId: string; from: AxialCoordinates; to: AxialCoordinates }

export function scoreSourcesOf(action: GameAction): ScoreSource[] {
    const arrival = arrivalOf(action)
    const sources: ScoreSource[] = []
    if (arrival?.stationGroupPoints) {
        sources.push({
            coords: arrival.coords,
            points: arrival.stationGroupPoints,
            caption: 'complex',
            playerId: action.playerId ?? ''
        })
    }
    const metadata = 'metadata' in action ? action.metadata : undefined
    for (const route of routeChangesOf(metadata).established) {
        if (route.points === 0) continue
        sources.push({
            coords:
                arrival && route.playerId === action.playerId ? arrival.coords : route.planets[0],
            points: route.points,
            caption: 'route',
            playerId: route.playerId
        })
    }
    if ((isAttackPiece(action) || isAttackSpread(action)) && action.metadata?.bounty) {
        const coords = isAttackPiece(action) ? action.coords : action.targets[0]
        if (coords) {
            sources.push({
                coords,
                points: action.metadata.bounty,
                caption: 'bounty',
                playerId: action.playerId
            })
        }
    }
    return sources
}

function arrivalOf(
    action: GameAction
): { coords: AxialCoordinates; stationGroupPoints?: number } | undefined {
    if (isPlacePiece(action)) return { coords: action.coords, ...action.metadata }
    if (isUseTradeRouteWormhole(action) || isUseTacticalFeint(action)) {
        return { coords: action.to, ...action.metadata }
    }
    if (isUseTacticalShift(action) || isUseWarpDrive(action) || isUseDimensionalRift(action)) {
        return { coords: action.to, ...action.metadata }
    }
    if (isUseColonyShip(action)) return { coords: action.planet, ...action.metadata }
    return undefined
}

export function shotsOf(action: GameAction, before: EarendelBoard): Shot[] {
    if (isAttackPiece(action)) {
        if (!action.coords || action.metadata?.declined) return []
        const strike = torpedoStrikeOf(action, before)
        if (strike) return [{ coords: strike.to, destroyed: true, torpedo: true }]
        return [{ coords: action.coords, destroyed: !action.metadata?.damaged }]
    }
    // A bombardment's pick blows its target up where it stood.
    if (isEventPick(action)) {
        return action.coords && action.metadata?.destroyed
            ? [{ coords: action.coords, destroyed: true }]
            : []
    }
    if (isAttackSpread(action)) {
        return action.targets.flatMap((coords) => {
            const targetId = getHex(before, coords)?.piece?.id
            const hit = action.metadata?.hits?.find((entry) => entry.target.id === targetId)
            return hit ? [{ coords, destroyed: !hit.damaged }] : []
        })
    }
    return []
}

// The torpedo a strike set off: where it stood on the board before, and the station it ran into.
export function torpedoStrikeOf(
    action: GameAction,
    before: EarendelBoard
): TorpedoStrike | undefined {
    if (!isAttackPiece(action) || !action.coords) return undefined
    const torpedo = action.metadata?.torpedo
    if (!torpedo) return undefined
    const launched = Object.values(before.hexes).find((hex) => hex.piece?.id === torpedo.id)
    if (!launched) return undefined
    return { pieceId: torpedo.id, from: launched.coords, to: action.coords }
}

export function pieceMovesBetween(from: EarendelBoard, to: EarendelBoard): PieceMove[] {
    const before = new Map<string, AxialCoordinates>()
    for (const hex of Object.values(from.hexes)) {
        if (hex.piece) before.set(hex.piece.id, hex.coords)
    }

    const moves: PieceMove[] = []
    for (const hex of Object.values(to.hexes)) {
        const origin = hex.piece ? before.get(hex.piece.id) : undefined
        if (!hex.piece || !origin) continue
        if (origin.q !== hex.coords.q || origin.r !== hex.coords.r) {
            moves.push({ pieceId: hex.piece.id, from: origin, to: hex.coords })
        }
    }
    return moves
}
