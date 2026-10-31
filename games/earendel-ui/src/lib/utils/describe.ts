import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    claimChangesOf,
    type ClaimChange,
    isAttackPiece,
    isAttackSpread,
    isChoosePlanet,
    isChooseTechnology,
    isDiscardPiece,
    isDrawPieces,
    isMovePiece,
    isEndTurn,
    isPass,
    isPlacePiece,
    isPlaceTile,
    isUseImmediateDownload,
    isUseLogisticsUpgrade,
    isUseTacticalFeint,
    isUseTradeRouteWormhole,
    isUseUpdatedLogistics,
    type AttackSpread,
    type ChoosePlanet,
    type ChooseTechnology,
    type DiscardPiece,
    type DrawPieces,
    type MovePiece,
    type AttackPiece,
    type Piece,
    PieceType,
    type PlacePiece,
    type PlaceTile,
    type ScoredChain,
    technologyCard,
    technologyName,
    type UseImmediateDownload,
    type UseLogisticsUpgrade,
    type UseTacticalFeint,
    type UseTradeRouteWormhole,
    type UseUpdatedLogistics
} from '@tabletop/earendel'

export function describePiece(piece: Piece): string {
    if (piece.hub) return 'Station Hub'
    const name = piece.type === PieceType.Probe ? 'probe' : piece.type
    return piece.level ? `level ${piece.level} ${name}` : name
}

type Describer = (action: GameAction) => string | undefined

const DESCRIBERS: Record<ActionType, Describer> = {
    [ActionType.PlacePiece]: (action) =>
        isPlacePiece(action) ? describePlacement(action) : undefined,
    [ActionType.ChoosePlanet]: (action) =>
        isChoosePlanet(action) ? describeSurvey(action) : undefined,
    [ActionType.ChooseTechnology]: (action) =>
        isChooseTechnology(action) ? describeClaim(action) : undefined,
    [ActionType.AttackPiece]: (action) =>
        isAttackPiece(action) ? describeShot(action) : undefined,
    [ActionType.AttackSpread]: (action) =>
        isAttackSpread(action) ? describeSpread(action) : undefined,
    [ActionType.DrawPieces]: (action) => (isDrawPieces(action) ? describeDraw(action) : undefined),
    [ActionType.UseImmediateDownload]: (action) =>
        isUseImmediateDownload(action) ? describeDownload(action) : undefined,
    [ActionType.UseTradeRouteWormhole]: (action) =>
        isUseTradeRouteWormhole(action) ? describeWormhole(action) : undefined,
    [ActionType.UseTacticalFeint]: (action) =>
        isUseTacticalFeint(action) ? describeFeint(action) : undefined,
    [ActionType.UseUpdatedLogistics]: (action) =>
        isUseUpdatedLogistics(action) ? describeUpdatedLogistics(action) : undefined,
    [ActionType.UseLogisticsUpgrade]: (action) =>
        isUseLogisticsUpgrade(action) ? describeLogisticsUpgrade(action) : undefined,
    [ActionType.DiscardPiece]: (action) =>
        isDiscardPiece(action) ? describeDiscard(action) : undefined,
    [ActionType.PlaceTile]: (action) => (isPlaceTile(action) ? describeTile(action) : undefined),
    [ActionType.MovePiece]: (action) => (isMovePiece(action) ? describeMove(action) : undefined),
    [ActionType.Pass]: (action) =>
        isPass(action) ? 'could not place, ending the game' : undefined,
    [ActionType.EndTurn]: (action) =>
        isEndTurn(action) ? 'ended their turn, keeping their technology for later' : undefined
}

function isEarendelActionType(type: string): type is ActionType {
    return Object.values<string>(ActionType).includes(type)
}

export function describeAction(
    action: GameAction,
    nameOf: (playerId: string) => string = () => 'a rival'
): string {
    const describer = isEarendelActionType(action.type) ? DESCRIBERS[action.type] : undefined
    const text = describer?.(action) ?? action.type
    return [text, ...describeClaimChanges(action, nameOf)].join(' ')
}

// Pending claims the action broke or restored by changing who leads their planet.
function describeClaimChanges(action: GameAction, nameOf: (playerId: string) => string): string[] {
    const { broken, restored } = claimChangesOf('metadata' in action ? action.metadata : undefined)
    const claim = (change: ClaimChange) => {
        const whose =
            change.playerId === action.playerId ? 'their own' : `${nameOf(change.playerId)}'s`
        const technology = technologyName(technologyCard(change.technologyId))
        const planet = change.color ? `the ${change.color} planet` : 'its planet'
        return `${whose} pending ${technology} on ${planet}`
    }
    return [
        ...broken.map((change) => `and broke ${claim(change)}`),
        ...restored.map((change) => `and restored ${claim(change)}`)
    ]
}

function describeChains(chains: ScoredChain[] | undefined): string[] {
    return (chains ?? []).map(
        (chain) =>
            `and joined two ${chain.color} planets with ${chain.length} ${
                chain.length === 1 ? 'ship' : 'ships'
            } for ${chain.points}`
    )
}

function describePlacement(placed: PlacePiece): string {
    const parts: string[] = [`placed a ${placed.metadata?.pieceType ?? 'ship'}`]
    if (placed.metadata?.returnedToBag) {
        parts.push(`(putting a ${describePiece(placed.metadata.returnedToBag)} back in the bag)`)
    }
    if (placed.metadata?.stationGroupPoints) {
        const points = placed.metadata.stationGroupPoints
        parts.push(points === 1 ? 'for 1' : `joining a group of ${points} stations for ${points}`)
    }
    parts.push(...describeChains(placed.metadata?.chains))
    return parts.join(' ')
}

function nameOf(technologyId: string): string {
    return technologyName(technologyCard(technologyId))
}

function describeSurvey(chosen: ChoosePlanet): string {
    if (chosen.metadata?.declined) return 'chose not to survey'
    if (chosen.metadata?.alreadyExplored) return 'surveyed an explored planet'
    const flipped = chosen.metadata?.flipped?.length ?? 0
    return `surveyed and explored a planet, turning over ${flipped} ${flipped === 1 ? 'card' : 'cards'}`
}

function describeClaim(chosen: ChooseTechnology): string {
    if (chosen.metadata?.noTechnologyAvailable) return 'found nothing the planet could hold'
    const technologyId = chosen.metadata?.technologyId
    return `staked a claim on ${technologyId ? nameOf(technologyId) : 'nothing'}`
}

function describeShot(shot: AttackPiece): string {
    if (shot.metadata?.declined) return 'held fire'
    if (shot.metadata?.railgun) {
        return `railgunned a ${shot.metadata?.target?.type ?? 'ship'} out of existence`
    }
    if (shot.metadata?.damaged) {
        return `damaged a fighter down to level ${shot.metadata.levelAfter ?? 1}`
    }
    return `destroyed a ${shot.metadata?.target?.type ?? 'ship'}`
}

function describeSpread(spread: AttackSpread): string {
    const hits = spread.metadata?.hits ?? []
    const destroyed = hits
        .filter((hit) => !hit.damaged)
        .map((hit) => `a ${describePiece(hit.target)}`)
    const damaged = hits
        .filter((hit) => hit.damaged)
        .map((hit) => `a ${hit.target.type} down to level ${hit.levelAfter ?? 1}`)

    const outcomes: string[] = []
    if (destroyed.length > 0) outcomes.push(`destroying ${listOf(destroyed)}`)
    if (damaged.length > 0) outcomes.push(`damaging ${listOf(damaged)}`)
    return ['fired a Full Torpedo Spread', ...outcomes].join(', ')
}

function describeUpdatedLogistics(woke: UseUpdatedLogistics): string {
    const reach = woke.metadata?.targetCount
    const base = 'used Updated Logistics to send a fighter into the attack'
    if (reach === undefined) return base
    return `${base}, with ${reach} ${reach === 1 ? 'target' : 'targets'} in reach`
}

function describeDraw(drew: DrawPieces): string {
    const count = drew.metadata?.drawn?.length ?? 0
    const parts = [`drew ${count} ${count === 1 ? 'ship' : 'ships'}`]

    const claimed = drew.metadata?.technologiesClaimed ?? []
    const lapsed = drew.metadata?.technologiesLapsed ?? []
    if (claimed.length > 0) parts.push(`gained ${claimed.map(nameOf).join(' and ')}`)
    if (lapsed.length > 0) {
        parts.push(`lost the claim on ${lapsed.map(nameOf).join(' and ')}`)
    }
    return parts.join(', ')
}

function describeDownload(read: UseImmediateDownload): string {
    const technologyId = read.metadata?.technologyId
    const name = technologyId ? nameOf(technologyId) : 'a technology'
    return read.metadata?.resolvedAtOnce
        ? `downloaded ${name} and used it on the spot`
        : `downloaded ${name} from a planet in sight`
}

function describeWormhole(hop: UseTradeRouteWormhole): string {
    const parts: string[] = [
        `sent a ${hop.metadata?.pieceType ?? 'ship'} through a trade route wormhole`
    ]
    if (hop.metadata?.stationGroupPoints) parts.push(`for ${hop.metadata.stationGroupPoints}`)
    parts.push(...describeChains(hop.metadata?.chains))
    return parts.join(' ')
}

function describeFeint(feint: UseTacticalFeint): string {
    const mine = feint.metadata?.movedType ?? 'ship'
    const theirs = feint.metadata?.displacedType ?? 'ship'
    const parts: string[] = [`feinted, swapping their ${mine} with a ${theirs}`]
    if (feint.metadata?.stationGroupPoints) parts.push(`for ${feint.metadata.stationGroupPoints}`)
    parts.push(...describeChains(feint.metadata?.chains))
    return parts.join(' ')
}

function describeLogisticsUpgrade(used: UseLogisticsUpgrade): string {
    return `spent a Logistics Upgrade, keeping all ${used.metadata?.piecesKept ?? 3} ships`
}

function describeDiscard(discard: DiscardPiece): string {
    return discard.metadata?.nothingToDiscard
        ? 'drew the last of the bag, with nothing to discard'
        : `drafted three and discarded a ${discard.metadata?.discarded?.type ?? 'ship'}`
}

function describeTile(laid: PlaceTile): string {
    if (laid.metadata?.noTilePlaced) return 'had nowhere to lay the new tile'
    if (laid.metadata?.noShipPlaced) return 'laid a new tile, with no ship left to put on it'
    return 'laid a new tile'
}

function describeMove(moved: MovePiece): string {
    if (moved.metadata?.noMoveAvailable) return 'had nothing the technology could move'
    if (moved.metadata?.declined) return 'held position rather than moving'
    return `moved a ${moved.metadata?.piece?.type ?? 'ship'} one space`
}

function listOf(items: string[]): string {
    if (items.length <= 1) return items.join('')
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
