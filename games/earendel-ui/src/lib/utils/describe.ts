import type { GameAction } from '@tabletop/common'
import {
    isAttackPiece,
    isChoosePlanet,
    isChooseTechnology,
    isDiscardPiece,
    isDrawPieces,
    isMovePiece,
    isPass,
    isPlacePiece,
    isPlaceTile,
    isUseImmediateDownload,
    isUseLogisticsUpgrade,
    isUseTacticalFeint,
    isUseTradeRouteWormhole,
    type Piece,
    PieceType,
    technologyName
} from '@tabletop/earendel'

export function describePiece(piece: Piece): string {
    if (piece.hub) return 'Station Hub'
    const name = piece.type === PieceType.Probe ? 'probe' : piece.type
    return piece.level ? `level ${piece.level} ${name}` : name
}

export function describeAction(action: GameAction): string {
    if (isPlacePiece(action)) {
        const placed = action
        const parts: string[] = [`placed a ${placed.metadata?.pieceType ?? 'ship'}`]
        if (placed.metadata?.returnedToBag) {
            parts.push(
                `(putting a ${describePiece(placed.metadata.returnedToBag)} back in the bag)`
            )
        }
        if (placed.metadata?.stationGroupPoints) {
            const points = placed.metadata.stationGroupPoints
            parts.push(
                points === 1 ? 'for 1' : `joining a group of ${points} stations for ${points}`
            )
        }
        for (const chain of placed.metadata?.chains ?? []) {
            parts.push(
                `and joined two ${chain.color} planets with ${chain.length} ${
                    chain.length === 1 ? 'ship' : 'ships'
                } for ${chain.points}`
            )
        }
        return parts.join(' ')
    }
    if (isChoosePlanet(action)) {
        const chosen = action
        if (chosen.metadata?.declined) return 'chose not to survey'
        if (chosen.metadata?.alreadyExplored) return 'surveyed an explored planet'
        const flipped = chosen.metadata?.flipped?.length ?? 0
        return `surveyed and explored a planet, turning over ${flipped} ${flipped === 1 ? 'card' : 'cards'}`
    }
    if (isChooseTechnology(action)) {
        const chosen = action
        return chosen.metadata?.noTechnologyAvailable
            ? 'found nothing the planet could hold'
            : `staked a claim on ${chosen.metadata?.technology ? technologyName(chosen.metadata.technology) : 'nothing'}`
    }
    if (isAttackPiece(action)) {
        const shot = action
        if (shot.metadata?.declined) return 'held fire'
        if (shot.metadata?.railgun) {
            return `railgunned a ${shot.metadata?.target?.type ?? 'ship'} out of existence`
        }
        if (shot.metadata?.damaged) {
            return `damaged a fighter down to level ${shot.metadata.levelAfter ?? 1}`
        }
        return `destroyed a ${shot.metadata?.target?.type ?? 'ship'}`
    }
    if (isDrawPieces(action)) {
        const drew = action
        const count = drew.metadata?.drawn?.length ?? 0
        const drawn = `drew ${count} ${count === 1 ? 'ship' : 'ships'}`

        // A claim settled as the turn opened is the more interesting half of this action, and
        // nobody was watching the board when it was decided - it is the outcome of a planet
        // surveyed and defended through everyone else's turns, so it gets said out loud.
        const claimed = drew.metadata?.technologiesClaimed ?? []
        const lapsed = drew.metadata?.technologiesLapsed ?? []
        const parts = [drawn]
        if (claimed.length > 0) parts.push(`gained ${claimed.map(technologyName).join(' and ')}`)
        if (lapsed.length > 0) {
            parts.push(`lost the claim on ${lapsed.map(technologyName).join(' and ')}`)
        }
        return parts.join(', ')
    }
    if (isUseImmediateDownload(action)) {
        const read = action
        const name = read.metadata?.technology
            ? technologyName(read.metadata.technology)
            : 'a technology'
        // Worth saying it went off at once: a downloaded Immediate effect is resolved in the
        // same breath, so the next entry in the log is its consequence.
        return read.metadata?.resolvedAtOnce
            ? `downloaded ${name} and used it on the spot`
            : `downloaded ${name} from a planet in sight`
    }
    if (isUseTradeRouteWormhole(action)) {
        const hop = action
        const parts: string[] = [
            `sent a ${hop.metadata?.pieceType ?? 'ship'} through a trade route wormhole`
        ]
        if (hop.metadata?.stationGroupPoints) {
            parts.push(`for ${hop.metadata.stationGroupPoints}`)
        }
        for (const chain of hop.metadata?.chains ?? []) {
            parts.push(
                `and joined two ${chain.color} planets with ${chain.length} ${
                    chain.length === 1 ? 'ship' : 'ships'
                } for ${chain.points}`
            )
        }
        return parts.join(' ')
    }
    if (isUseTacticalFeint(action)) {
        const feint = action
        const mine = feint.metadata?.movedType ?? 'ship'
        const theirs = feint.metadata?.displacedType ?? 'ship'
        const parts: string[] = [`feinted, swapping their ${mine} with a ${theirs}`]
        // The swap's own consequences, said out loud for the same reason a placement's are:
        // the score moved and history has to be able to say why.
        if (feint.metadata?.stationGroupPoints) {
            parts.push(`for ${feint.metadata.stationGroupPoints}`)
        }
        for (const chain of feint.metadata?.chains ?? []) {
            parts.push(
                `and joined two ${chain.color} planets with ${chain.length} ${
                    chain.length === 1 ? 'ship' : 'ships'
                } for ${chain.points}`
            )
        }
        return parts.join(' ')
    }
    if (isUseLogisticsUpgrade(action)) {
        const used = action
        return `spent a Logistics Upgrade, keeping all ${used.metadata?.piecesKept ?? 3} ships`
    }
    if (isDiscardPiece(action)) {
        const discard = action
        return discard.metadata?.nothingToDiscard
            ? 'drew the last of the bag, with nothing to discard'
            : `drafted three and discarded a ${discard.metadata?.discarded?.type ?? 'ship'}`
    }
    if (isPlaceTile(action)) {
        const laid = action
        return laid.metadata?.noTilePlaced
            ? 'had nowhere to lay the new tile'
            : laid.metadata?.noShipPlaced
              ? 'laid a new tile, with no ship left to put on it'
              : 'laid a new tile'
    }
    if (isMovePiece(action)) {
        const moved = action
        if (moved.metadata?.noMoveAvailable) return 'had nothing the technology could move'
        if (moved.metadata?.declined) return 'held position rather than moving'
        return `moved a ${moved.metadata?.piece?.type ?? 'ship'} one space`
    }
    if (isPass(action)) return 'could not place, ending the game'
    return action.type
}
