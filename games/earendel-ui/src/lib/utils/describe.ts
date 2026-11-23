import type { AxialCoordinates, GameAction } from '@tabletop/common'
import {
    ActionType,
    claimChangesOf,
    type ClaimChange,
    isAttackPiece,
    isAttackSpread,
    isChooseEventOrder,
    isEventPick,
    type EventPick,
    isChoosePlanet,
    isChooseTechnology,
    isDiscardPiece,
    isDrawPieces,
    isMovePiece,
    isUseTacticalShift,
    isUseWarpDrive,
    isUseDimensionalRift,
    type UseDimensionalRift,
    type UseWarpDrive,
    type UseTacticalShift,
    isUseBeyondTheFrontier,
    isUseSpoofedOrders,
    isUseAsteroidField,
    type UseAsteroidField,
    isUseSecurityBreach,
    isPlayScrap,
    isUseColonyShip,
    isUseFactoryOverride,
    isUseConscription,
    isEndTurn,
    isFoundPlanet,
    isStowShip,
    type StowShip,
    stowedShipKind,
    type StowChoice,
    isSeedNebula,
    isTerraform,
    type Terraform,
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
    type UseUpdatedLogistics,
    TECHNOLOGY_EFFECT_INFO
} from '@tabletop/earendel'
import { grantedPieceName, specialPieceInfo } from './specialPieces.js'

export function describePiece(piece: Piece): string {
    if (piece.hub) return 'Station Hub'
    const special = specialPieceInfo(piece)
    if (special) return special.name
    if (piece.type === PieceType.Scrap) return 'Scrap'
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
    [ActionType.UseDimensionalRift]: (action) =>
        isUseDimensionalRift(action)
            ? describeShift(
                  action,
                  'opened a Dimensional Rift to send',
                  'along the border of the map'
              )
            : undefined,
    [ActionType.UseWarpDrive]: (action) =>
        isUseWarpDrive(action)
            ? describeShift(action, 'used Warp Drive to send', 'through empty space')
            : undefined,
    [ActionType.UseTacticalShift]: (action) =>
        isUseTacticalShift(action) ? describeShift(action) : undefined,
    [ActionType.UseSpoofedOrders]: (action) =>
        isUseSpoofedOrders(action)
            ? `used Spoofed Orders to send a rival's ${action.metadata?.piece?.type ?? 'piece'} one space`
            : undefined,
    [ActionType.UseAsteroidField]: (action) =>
        isUseAsteroidField(action) ? describeAsteroidField(action) : undefined,
    [ActionType.UseSecurityBreach]: (action) =>
        isUseSecurityBreach(action)
            ? "used a Security Breach, slipping a piece of Scrap into an opponent's bag"
            : undefined,
    [ActionType.UseConscription]: (action) =>
        isUseConscription(action)
            ? `used Conscription, taking the discarded ${listOf((action.metadata?.conscripted ?? []).map(describePiece)) || 'ship'} back into their bag`
            : undefined,
    [ActionType.UseFactoryOverride]: (action) =>
        isUseFactoryOverride(action)
            ? `used a Factory Override, drawing ${listOf((action.metadata?.drawn ?? []).map((piece) => `a ${describePiece(piece)}`)) || 'nothing'} to place as well`
            : undefined,
    [ActionType.UseColonyShip]: (action) =>
        isUseColonyShip(action)
            ? [
                  'landed a Colony Ship, settling a planet as one of their stations',
                  ...describeStationScore(
                      action.metadata?.stationGroupPoints,
                      action.metadata?.stationComplex
                  )
              ].join(' ')
            : undefined,
    [ActionType.PlayScrap]: (action) =>
        isPlayScrap(action) ? 'played the Scrap, to no effect but to be rid of it' : undefined,
    [ActionType.UseBeyondTheFrontier]: (action) =>
        isUseBeyondTheFrontier(action)
            ? action.metadata?.drawn
                ? `used Beyond the Frontier, drawing a tile to lay and a ${describePiece(action.metadata.drawn)} to follow it`
                : 'used Beyond the Frontier, drawing a tile to lay, with no ship left to follow it'
            : undefined,
    [ActionType.Pass]: (action) =>
        isPass(action) ? 'could not place, ending the game' : undefined,
    [ActionType.ChooseEventOrder]: (action) =>
        isChooseEventOrder(action) ? 'set the order of picks for the event' : undefined,
    [ActionType.EventPick]: (action) =>
        isEventPick(action) ? describeEventPick(action) : undefined,
    [ActionType.Terraform]: (action) =>
        isTerraform(action) ? describeTerraform(action) : undefined,
    [ActionType.SeedNebula]: (action) =>
        isSeedNebula(action)
            ? action.metadata?.declined
                ? 'left the nebula unlaid'
                : 'laid nebula beside a seeder'
            : undefined,
    [ActionType.FoundPlanet]: (action) =>
        isFoundPlanet(action) ? `founded a ${action.color} planet` : undefined,
    [ActionType.StowShip]: (action) => (isStowShip(action) ? describeStow(action) : undefined),
    [ActionType.EndTurn]: (action) =>
        isEndTurn(action) ? 'ended their turn, keeping their technology for later' : undefined
}

// Only its own player is sent the choice; everyone else reads that a ship went in.
function describeStow(stow: StowShip): string {
    const choice: StowChoice | undefined = stow.choice
    if (choice === undefined) return 'stowed an extra ship in their bag, unseen'
    return `stowed an extra ${describePiece({ id: stow.id, playerId: stow.playerId, ...stowedShipKind(choice) })} in their bag, unseen by the others`
}

// Only its own player is sent the choice; everyone else reads that three ships went in.
function describeAsteroidField(used: UseAsteroidField): string {
    const choice: StowChoice | undefined = used.choice
    if (choice === undefined) {
        return 'mined an Asteroid Field, adding three ships to their bag, unseen'
    }
    const built = describePiece({ id: used.id, playerId: used.playerId, ...stowedShipKind(choice) })
    return `mined an Asteroid Field, adding three ${built}s to their bag, unseen by the others`
}

function isEarendelActionType(type: string): type is ActionType {
    return Object.values<string>(ActionType).includes(type)
}

// A description is plain words, with the claimant of a pending claim and its technology marked
// out so the panel can draw them as a player pill and a technology chip.
export type DescriptionSegment =
    | { kind: 'text'; text: string }
    | { kind: 'claimant'; playerId: string }
    | { kind: 'technology'; technologyId: string; planet: AxialCoordinates }

const text = (words: string): DescriptionSegment => ({ kind: 'text', text: words })

export function describeActionSegments(action: GameAction): DescriptionSegment[] {
    // A Security Breach names the opponent it struck, as a player pill.
    if (isUseSecurityBreach(action)) {
        return [
            text('used a Security Breach, slipping a piece of Scrap into'),
            { kind: 'claimant', playerId: action.targetPlayerId },
            text('bag')
        ]
    }
    const describer = isEarendelActionType(action.type) ? DESCRIBERS[action.type] : undefined
    return [text(describer?.(action) ?? action.type), ...claimChangeSegments(action)]
}

export function describeAction(
    action: GameAction,
    nameOf: (playerId: string) => string = () => 'a rival'
): string {
    return describeActionSegments(action)
        .map((segment) => {
            if (segment.kind === 'text') return segment.text
            if (segment.kind === 'claimant') return `${nameOf(segment.playerId)}'s`
            return technologyName(technologyCard(segment.technologyId))
        })
        .join(' ')
}

// Pending claims the action broke or restored by changing who leads their planet.
function claimChangeSegments(action: GameAction): DescriptionSegment[] {
    const { broken, restored } = claimChangesOf('metadata' in action ? action.metadata : undefined)
    const claim = (verb: string, change: ClaimChange): DescriptionSegment[] => [
        ...(change.playerId === action.playerId
            ? [text(`and ${verb} their own pending`)]
            : [
                  text(`and ${verb}`),
                  { kind: 'claimant' as const, playerId: change.playerId },
                  text('pending')
              ]),
        { kind: 'technology', technologyId: change.technologyId, planet: change.coords },
        text(change.color ? `on the ${change.color} planet` : 'on its planet')
    ]
    return [
        ...broken.flatMap((change) => claim('broke', change)),
        ...restored.flatMap((change) => claim('restored', change))
    ]
}

function describeChains(chains: ScoredChain[] | undefined): string[] {
    return (chains ?? []).map(
        (chain) =>
            `and joined two ${chain.color} planets with ${chain.length} ${
                chain.length === 1 ? 'ship' : 'ships'
            } for ${pointsText(chain.points)}`
    )
}

function describePlacement(placed: PlacePiece): string {
    if (placed.metadata?.torpedo) return 'placed a fighter as a Gamma Torpedo'
    if (placed.metadata?.founding) return 'placed their free opening station'
    const parts: string[] = [`placed a ${placed.metadata?.pieceType ?? 'ship'}`]
    if (placed.metadata?.returnedToBag) {
        parts.push(`(putting a ${describePiece(placed.metadata.returnedToBag)} back in the bag)`)
    }
    parts.push(
        ...describeStationScore(
            placed.metadata?.stationGroupPoints,
            placed.metadata?.stationComplex
        )
    )
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
    if (chosen.metadata?.elevated && technologyId) {
        const event = chosen.metadata.event
        return chosen.metadata.everyone
            ? `discovered ${nameOf(technologyId)}, an event for everyone`
            : `discovered ${nameOf(technologyId)}, a global for everyone${event ? `, with one pick of ${TECHNOLOGY_EFFECT_INFO[event].name}` : ''}`
    }
    return `staked a claim on ${technologyId ? nameOf(technologyId) : 'nothing'}`
}

function describeEventPick(pick: EventPick): string {
    const meta = pick.metadata
    if (!meta || meta.skipped) return 'had nothing to pick from the event'
    if (meta.destroyed) {
        const salvage = (meta.salvaged?.length ?? 0) > 0 ? ', salvaged by a drone' : ''
        return `bombarded a ${describePiece(meta.destroyed)}${salvage}`
    }
    if (meta.moved) return `rode the wormhole storm with a ${describePiece(meta.moved)}`
    if (meta.technologyId && meta.planet) return `intercepted ${nameOf(meta.technologyId)}`
    if (meta.technologyId) return `salvaged ${nameOf(meta.technologyId)}`
    if (meta.piece) return `took a ${grantedPieceName(meta.piece) ?? 'unit'} from the shipyard`
    return 'took a pick from the event'
}

function describeShot(shot: AttackPiece): string {
    if (shot.metadata?.declined) return 'held fire'
    const salvage = (shot.metadata?.salvaged?.length ?? 0) > 0 ? ', salvaged by a drone' : ''
    if (shot.metadata?.torpedo) {
        const target = shot.metadata.target
        const whose = target && target.playerId === shot.playerId ? 'their own' : 'a'
        return `set off the torpedo, destroying ${whose} ${target ? describePiece(target) : 'station'}`
    }
    if (shot.metadata?.railgun) {
        return `railgunned a ${shot.metadata?.target?.type ?? 'ship'} out of existence`
    }
    if (shot.metadata?.damaged) {
        return `damaged a fighter down to level ${shot.metadata.levelAfter ?? 1}`
    }
    return `destroyed a ${shot.metadata?.target ? describePiece(shot.metadata.target) : 'ship'}${salvage}`
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
    return `downloaded ${name} from a planet within reach`
}

function describeWormhole(hop: UseTradeRouteWormhole): string {
    const parts: string[] = [
        `sent a ${hop.metadata?.pieceType ?? 'ship'} through a trade route wormhole`
    ]
    parts.push(
        ...describeStationScore(hop.metadata?.stationGroupPoints, hop.metadata?.stationComplex)
    )
    parts.push(...describeChains(hop.metadata?.chains))
    return parts.join(' ')
}

function describeFeint(feint: UseTacticalFeint): string {
    const mine = feint.metadata?.movedType ?? 'ship'
    const theirs = feint.metadata?.displacedType ?? 'ship'
    const parts: string[] = [`feinted, swapping their ${mine} with a ${theirs}`]
    parts.push(
        ...describeStationScore(feint.metadata?.stationGroupPoints, feint.metadata?.stationComplex)
    )
    parts.push(...describeChains(feint.metadata?.chains))
    return parts.join(' ')
}

function describeLogisticsUpgrade(used: UseLogisticsUpgrade): string {
    return `used Logistics Upgrade, keeping all ${used.metadata?.piecesKept ?? 3} ships`
}

function describeDiscard(discard: DiscardPiece): string {
    return discard.metadata?.nothingToDiscard
        ? 'drew the last of the bag, with nothing to discard'
        : `drafted three and discarded ${
              discard.metadata?.discarded?.type === PieceType.Scrap
                  ? 'the Scrap'
                  : `a ${discard.metadata?.discarded?.type ?? 'ship'}`
          }${discard.metadata?.recycled ? ', which went back into the bag' : ''}`
}

function describeTile(laid: PlaceTile): string {
    if (laid.metadata?.noTilePlaced) return 'had nowhere to lay the new tile'
    if (laid.metadata?.tileClosedToShip) {
        return 'laid a new tile, with no hex of it open to the ship drawn, which went back in the bag'
    }
    if (laid.metadata?.noShipPlaced) return 'laid a new tile, with no ship to put on it'
    return 'laid a new tile'
}

function describeMove(moved: MovePiece): string {
    if (moved.metadata?.noMoveAvailable) return 'had nothing that could drift'
    if (moved.metadata?.declined) return 'held position rather than drifting'
    return `drifted a ${moved.metadata?.piece?.type ?? 'ship'} one space`
}

function describeShift(
    shifted: UseTacticalShift | UseWarpDrive | UseDimensionalRift,
    verb = 'used Tactical Shift to move',
    distance = 'one space'
): string {
    const parts: string[] = [`${verb} a ${shifted.metadata?.pieceType ?? 'ship'} ${distance}`]
    parts.push(
        ...describeStationScore(
            shifted.metadata?.stationGroupPoints,
            shifted.metadata?.stationComplex
        )
    )
    parts.push(...describeChains(shifted.metadata?.chains))
    return parts.join(' ')
}

function listOf(items: string[]): string {
    if (items.length <= 1) return items.join('')
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function describeTerraform(terraform: Terraform): string {
    const { fromColor, toColor } = terraform.metadata ?? {}
    if (!toColor) return 'left the planets beside their terraformer as they were'
    return fromColor
        ? `terraformed the ${fromColor} planet to ${toColor}`
        : `terraformed a planet to ${toColor}`
}

function pointsText(points: number): string {
    return `${points} ${points === 1 ? 'point' : 'points'}`
}

// The station count comes from the recorded complex; older records only have the points, which
// equal the count unless a hub doubled them.
function describeStationScore(
    points: number | undefined,
    complex: { stations: number } | undefined
): string[] {
    if (!points) return []
    const stations = complex?.stations ?? points
    return [
        stations === 1
            ? `for ${pointsText(points)}`
            : `joining a group of ${stations} stations for ${pointsText(points)}`
    ]
}
