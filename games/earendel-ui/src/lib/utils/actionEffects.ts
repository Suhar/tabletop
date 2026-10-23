import type { AxialCoordinates, GameAction } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    isAttackPiece,
    isAttackSpread,
    isPlacePiece,
    isUseTacticalFeint,
    isUseTradeRouteWormhole,
    type ScoredChain
} from '@tabletop/earendel'

export type ScoreSource = {
    coords: AxialCoordinates
    points: number
    caption: 'complex' | 'chain'
    playerId: string
}

export type Shot = { coords: AxialCoordinates; destroyed: boolean }

export type PieceMove = { pieceId: string; from: AxialCoordinates; to: AxialCoordinates }

// A placement can be paid for its station complex and for each chain at once; each source is
// shown on its own so the jump in score can be accounted for.
export function scoreSourcesOf(action: GameAction): ScoreSource[] {
    const arrival = arrivalOf(action)
    if (!arrival) return []

    const sources: ScoreSource[] = []
    if (arrival.stationGroupPoints) {
        sources.push({
            coords: arrival.coords,
            points: arrival.stationGroupPoints,
            caption: 'complex',
            playerId: action.playerId ?? ''
        })
    }
    for (const chain of arrival.chains ?? []) {
        sources.push({
            coords: arrival.coords,
            points: chain.points,
            caption: 'chain',
            playerId: action.playerId ?? ''
        })
    }
    return sources
}

function arrivalOf(
    action: GameAction
): { coords: AxialCoordinates; stationGroupPoints?: number; chains?: ScoredChain[] } | undefined {
    if (isPlacePiece(action)) return { coords: action.coords, ...action.metadata }
    if (isUseTradeRouteWormhole(action) || isUseTacticalFeint(action)) {
        return { coords: action.to, ...action.metadata }
    }
    return undefined
}

export function shotsOf(action: GameAction, before: EarendelBoard): Shot[] {
    if (isAttackPiece(action)) {
        if (!action.coords || action.metadata?.declined) return []
        return [{ coords: action.coords, destroyed: !action.metadata?.damaged }]
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
