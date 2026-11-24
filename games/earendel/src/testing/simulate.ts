import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { getHex, HexKind } from '../model/board.js'
import { isPlacePiece, PieceSource, PlacePiece } from '../actions/placePiece.js'
import { ChoosePlanet } from '../actions/choosePlanet.js'
import { ChooseTechnology } from '../actions/chooseTechnology.js'
import { AttackPiece, isAttackPiece } from '../actions/attackPiece.js'
import { Pass } from '../actions/pass.js'
import { EndTurn } from '../actions/endTurn.js'
import { Terraform } from '../actions/terraform.js'
import { SeedNebula } from '../actions/seedNebula.js'
import { FoundPlanet } from '../actions/foundPlanet.js'
import { PLANET_COLORS } from '../model/planetColor.js'
import { assertExists, type GameAction, type GameStartOptions, Prng } from '@tabletop/common'
import { PieceType, STARTING_BAG } from '../model/pieces.js'
import { buildStartingBoard, type BoardSetupOptions } from '../util/boardSetup.js'
import { buildBag } from '../util/bag.js'
import { TurnStyle } from '../definition/config.js'
import { legalPlacementsFor, legalPlacementsOnTile } from '../util/placement.js'
import { destinationsFrom, legalMovesFor, legalRiftsFor, legalWarpsFor } from '../util/movement.js'
import { MovePiece } from '../actions/movePiece.js'
import { PlaceTile } from '../actions/placeTile.js'
import { DiscardPiece, isDiscardPiece } from '../actions/discardPiece.js'
import { UseLogisticsUpgrade } from '../actions/useLogisticsUpgrade.js'
import { DrawPieces } from '../actions/drawPieces.js'
import { StowChoice, StowShip } from '../actions/stowShip.js'
import { UseTacticalShift } from '../actions/useTacticalShift.js'
import { UseWarpDrive } from '../actions/useWarpDrive.js'
import { isUseConscription, UseConscription } from '../actions/useConscription.js'
import { UseFactoryOverride } from '../actions/useFactoryOverride.js'
import { settleablePlanets, UseColonyShip } from '../actions/useColonyShip.js'
import { UseDimensionalRift } from '../actions/useDimensionalRift.js'
import { UseBeyondTheFrontier } from '../actions/useBeyondTheFrontier.js'
import { UseSpoofedOrders } from '../actions/useSpoofedOrders.js'
import { ASTEROID_FIELD_SHIPS, UseAsteroidField } from '../actions/useAsteroidField.js'
import { UseSecurityBreach } from '../actions/useSecurityBreach.js'
import { PlayScrap } from '../actions/playScrap.js'
import { spoofablePieces } from '../util/spoofing.js'
import { legalTilePlacements } from '../util/tilePlacement.js'
import { ChooseEventOrder } from '../actions/chooseEventOrder.js'
import { EventPick, isEventPick } from '../actions/eventPick.js'
import { TechnologyEffectKind } from '../model/technology.js'
import {
    bombardmentTargets,
    interceptTargets,
    salvageChoices,
    shipyardChoices,
    stormDestinations,
    stormOrigins
} from '../util/events.js'
import { TestGame } from './testHarness.js'
import type { EarendelGameState, HydratedEarendelGameState } from '../model/gameState.js'

export type SetupOverrides = BoardSetupOptions & {
    piecesPerType?: number
    turnStyle?: TurnStyle
    // The opening is off unless asked for, as in the rule tests.
    openingStations?: boolean
    start?: GameStartOptions<EarendelGameState>
}

export type GameSummary = {
    playerCount: number
    finalState: EarendelGameState
    actions: GameAction[]
    endedBy: 'empty bag' | 'no legal placement' | 'unfinished'
    turns: number
    finished: boolean
    stoppedBecause?: string
    scores: number[]
    planetsExplored: number
    planetsTotal: number
    openHexesLeft: number
    piecesLeftInBags: number[]
    piecesDestroyed: number
    chainsScored: number
    technologiesResolved: number
    technologiesClaimed: number
    tilesPlaced: number
    discards: number
    upgradesSpent: number
    piecesDamaged: number
    hubsGranted: number
    piecesUnaccounted: number
}

// Deliberately not the game's prng: drawing from it here would change what the game draws.
function lcg(seed: number): () => number {
    let value = seed >>> 0
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0
        return value / 4294967296
    }
}

export function playRandomGame(
    playerCount: number,
    seed: number,
    overrides: SetupOverrides = {},
    maxTurns = 2000
): GameSummary {
    const game = new TestGame(
        playerCount,
        seed,
        {
            turnStyle: overrides.turnStyle ?? TurnStyle.DraftThree,
            ...(overrides.openingStations === undefined
                ? {}
                : { openingStations: overrides.openingStations })
        },
        overrides.start
    )

    if (overrides.tilesPerPlayer !== undefined || overrides.planetsPerTile !== undefined) {
        game.state.board = buildStartingBoard(
            playerCount,
            new Prng({ seed, invocations: 0 }),
            overrides
        )
    }
    if (overrides.piecesPerType !== undefined) {
        const perType = { ...STARTING_BAG }
        for (const type of Object.values(PieceType)) {
            perType[type] = [PieceType.Probe, PieceType.Station, PieceType.Fighter].includes(type)
                ? overrides.piecesPerType
                : 0
        }
        game.stackBags((playerId) =>
            buildBag(playerId, new Prng({ seed: seed + 1, invocations: 0 }), perType)
        )
    } else if (overrides.tilesPerPlayer !== undefined || overrides.planetsPerTile !== undefined) {
        game.stackBags((playerId) => {
            const player = game.state.players.find((candidate) => candidate.playerId === playerId)
            assertExists(player, `No player ${playerId}`)
            return [...player.bag.items].reverse()
        })
    }
    const random = lcg(seed * 7919 + 13)
    const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]

    // Pieces a technology grants never came out of a bag, so they are left out of the count.
    const granted = (piece: { hub?: boolean; founding?: boolean; type: PieceType }) =>
        piece.hub === true ||
        piece.founding === true ||
        ![PieceType.Probe, PieceType.Station, PieceType.Fighter].includes(piece.type)

    let turns = 0
    let piecesDestroyed = 0
    let technologiesResolved = 0
    let tilesPlaced = 0
    let discards = 0
    let upgradesSpent = 0
    let piecesDamaged = 0
    let piecesSalvaged = 0
    let shipsStowed = 0
    let chainsScored = 0
    let stoppedBecause: string | undefined

    while (game.state.machineState !== MachineState.EndOfGame) {
        if (turns >= maxTurns) {
            stoppedBecause = `no end after ${maxTurns} turns`
            break
        }
        turns++

        const playerId = game.activePlayerId

        if (game.state.machineState === MachineState.StartOfTurn) {
            game.run(DrawPieces, { type: ActionType.DrawPieces, playerId })
        } else if (game.state.machineState === MachineState.StowingShip) {
            shipsStowed++
            game.run(StowShip, {
                type: ActionType.StowShip,
                playerId,
                choice: pick(Object.values(StowChoice))
            })
        } else if (game.state.machineState === MachineState.PlacingOpeningStation) {
            const station = game.state.heldPieces[0]
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId,
                coords: pick(legalPlacementsFor(game.state.board, playerId, station)),
                pieceSource: PieceSource.Bag,
                pieceId: station.id
            })
        } else if (game.state.machineState === MachineState.DraftingPieces) {
            const held = game.state.heldPieces
            const canUpgrade = game
                .validActionsFor(playerId)
                .includes(ActionType.UseLogisticsUpgrade)

            if (canUpgrade && random() < 0.8) {
                game.run(UseLogisticsUpgrade, {
                    type: ActionType.UseLogisticsUpgrade,
                    playerId
                })
                upgradesSpent++
            } else {
                const thrown = game
                    .run(DiscardPiece, {
                        type: ActionType.DiscardPiece,
                        playerId,
                        pieceId: pick(held).id
                    })
                    .find(isDiscardPiece)
                // Under Global Recycling the ship is in the bag again, not out of the game.
                if (!thrown?.metadata?.recycled) discards++
            }
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseBeyondTheFrontier) &&
            random() < 0.5
        ) {
            game.run(UseBeyondTheFrontier, { type: ActionType.UseBeyondTheFrontier, playerId })
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseDimensionalRift) &&
            random() < 0.5
        ) {
            const move = pick(legalRiftsFor(game.state.board, playerId))
            game.run(UseDimensionalRift, {
                type: ActionType.UseDimensionalRift,
                playerId,
                from: move.from,
                to: move.to
            })
            technologiesResolved++
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseColonyShip) &&
            random() < 0.5
        ) {
            game.run(UseColonyShip, {
                type: ActionType.UseColonyShip,
                playerId,
                planet: pick(settleablePlanets(game.hydrated, playerId))
            })
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseFactoryOverride) &&
            random() < 0.5
        ) {
            game.run(UseFactoryOverride, { type: ActionType.UseFactoryOverride, playerId })
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseConscription) &&
            random() < 0.5
        ) {
            const used = game
                .run(UseConscription, { type: ActionType.UseConscription, playerId })
                .find(isUseConscription)
            // Conscripted ships are in the bag again, not out of the game.
            discards -= used?.metadata?.conscripted?.length ?? 0
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseWarpDrive) &&
            random() < 0.5
        ) {
            const move = pick(legalWarpsFor(game.state.board, playerId))
            game.run(UseWarpDrive, {
                type: ActionType.UseWarpDrive,
                playerId,
                from: move.from,
                to: move.to
            })
            technologiesResolved++
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseTacticalShift) &&
            random() < 0.5
        ) {
            const move = pick(legalMovesFor(game.state.board, playerId))
            game.run(UseTacticalShift, {
                type: ActionType.UseTacticalShift,
                playerId,
                from: move.from,
                to: move.to
            })
            technologiesResolved++
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseAsteroidField) &&
            random() < 0.5
        ) {
            game.run(UseAsteroidField, {
                type: ActionType.UseAsteroidField,
                playerId,
                choice: pick(Object.values(StowChoice))
            })
            shipsStowed += ASTEROID_FIELD_SHIPS
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseSecurityBreach) &&
            random() < 0.5
        ) {
            game.run(UseSecurityBreach, {
                type: ActionType.UseSecurityBreach,
                playerId,
                targetPlayerId: pick(
                    game.state.players
                        .map((player) => player.playerId)
                        .filter((candidate) => candidate !== playerId)
                )
            })
        } else if (
            (game.state.machineState === MachineState.PlacingPiece ||
                game.state.machineState === MachineState.EndingTurn) &&
            game.validActionsFor(playerId).includes(ActionType.UseSpoofedOrders) &&
            random() < 0.5
        ) {
            const from = pick(spoofablePieces(game.state.board, playerId))
            game.run(UseSpoofedOrders, {
                type: ActionType.UseSpoofedOrders,
                playerId,
                from,
                to: pick(destinationsFrom(game.state.board, from))
            })
        } else if (game.state.machineState === MachineState.PlacingPiece) {
            // A special piece may be played instead of the draw, until a drawn ship is down.
            const specials = game.state.shipPlacedThisTurn
                ? []
                : (game.state.players.find((player) => player.playerId === playerId)
                      ?.specialPieces ?? [])
            const options = [
                ...game.state.heldPieces.map((piece) => ({ piece, source: PieceSource.Bag })),
                ...specials.map((piece) => ({ piece, source: PieceSource.Special }))
            ].flatMap(({ piece, source }) =>
                legalPlacementsFor(game.state.board, playerId, piece).map((coords) => ({
                    piece,
                    source,
                    coords
                }))
            )

            const scrap = game.state.heldPieces.find((piece) => piece.type === PieceType.Scrap)
            if (scrap && (options.length === 0 || random() < 0.3)) {
                game.run(PlayScrap, { type: ActionType.PlayScrap, playerId, pieceId: scrap.id })
                continue
            }

            if (options.length === 0) {
                stoppedBecause = 'no legal placement, but the game did not end'
                break
            }

            const choice = pick(options)
            const placed = game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId,
                coords: choice.coords,
                pieceSource: choice.source,
                pieceId: choice.piece.id
            })
            chainsScored += placed
                .filter(isPlacePiece)
                .reduce(
                    (total, action) => total + (action.metadata?.routesEstablished ?? []).length,
                    0
                )
        } else if (game.state.machineState === MachineState.Seeding) {
            // Random play leaves the nebula unlaid.
            game.run(SeedNebula, { type: ActionType.SeedNebula, playerId })
        } else if (game.state.machineState === MachineState.FoundingPlanet) {
            game.run(FoundPlanet, {
                type: ActionType.FoundPlanet,
                playerId,
                color: pick(PLANET_COLORS)
            })
        } else if (game.state.machineState === MachineState.Terraforming) {
            // Random play leaves the planets as they are.
            game.run(Terraform, { type: ActionType.Terraform, playerId })
        } else if (game.state.machineState === MachineState.EndingTurn) {
            // Random play leaves technologies in reserve rather than reaching for them.
            game.run(EndTurn, { type: ActionType.EndTurn, playerId })
        } else if (game.state.machineState === MachineState.Exploring) {
            const pending = game.state.pendingExploration
            assertExists(pending, 'Exploring has a pending exploration')
            if (!pending.exploringPlanet) {
                const unexplored = pending.candidatePlanets.filter(
                    (coords) => !getHex(game.state.board, coords)?.explored
                )
                game.run(ChoosePlanet, {
                    type: ActionType.ChoosePlanet,
                    playerId,
                    coords: pick(unexplored.length > 0 ? unexplored : pending.candidatePlanets)
                })
            } else {
                const candidates = pending.candidates ?? []
                game.run(ChooseTechnology, {
                    type: ActionType.ChooseTechnology,
                    playerId,
                    ...(candidates.length > 0 ? { technologyId: pick(candidates) } : {})
                })
            }
        } else if (game.state.machineState === MachineState.PlacingTile) {
            const placements = legalTilePlacements(game.state.board)
            if (placements.length === 0) {
                stoppedBecause = 'a tile could not be laid and the game did not move on'
                break
            }
            const placement = pick(placements)
            game.run(PlaceTile, {
                type: ActionType.PlaceTile,
                playerId,
                coords: placement.origin,
                rotation: placement.rotation
            })
            tilesPlaced++
        } else if (game.state.machineState === MachineState.PlacingBonusPiece) {
            const tileId = game.state.bonusPlacementTileId
            assertExists(tileId, 'A bonus placement names its tile')
            const drawn = game.state.heldPieces.find(
                (piece) => piece.id === game.state.bonusPlacementPieceId
            )
            assertExists(drawn, 'A bonus placement holds the ship drawn with the tile')
            const open = legalPlacementsOnTile(game.state.board, playerId, drawn, tileId)
            if (open.length === 0) {
                stoppedBecause = 'nowhere on the new tile to place the ship'
                break
            }
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId,
                coords: pick(open),
                pieceSource: PieceSource.Bag,
                pieceId: drawn.id
            })
        } else if (game.state.machineState === MachineState.ResolvingTechnology) {
            const moves = legalMovesFor(game.state.board, playerId)
            if (moves.length === 0) {
                stoppedBecause = 'a technology could not resolve and the game did not move on'
                break
            }
            const move = pick(moves)
            game.run(MovePiece, {
                type: ActionType.MovePiece,
                playerId,
                from: move.from,
                to: move.to
            })
            technologiesResolved++
        } else if (game.state.machineState === MachineState.ChoosingEventOrder) {
            // The discoverer first, the rest shuffled.
            const others = game.state.players
                .map((player) => player.playerId)
                .filter((candidate) => candidate !== playerId)
            for (let i = others.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1))
                ;[others[i], others[j]] = [others[j], others[i]]
            }
            game.run(ChooseEventOrder, {
                type: ActionType.ChooseEventOrder,
                playerId,
                order: [playerId, ...others]
            })
        } else if (game.state.machineState === MachineState.ResolvingEvent) {
            const pending = game.state.pendingEvent
            assertExists(pending, 'ResolvingEvent has a pending event')
            const hydrated = game.hydrated
            const picks = game.run(EventPick, {
                type: ActionType.EventPick,
                playerId,
                ...eventChoice(pending.kind, hydrated, pending, playerId, pick)
            })
            for (const action of picks.filter(isEventPick)) {
                if (action.metadata?.destroyed) piecesDestroyed++
                piecesSalvaged += action.metadata?.salvaged?.length ?? 0
            }
        } else if (game.state.machineState === MachineState.Attacking) {
            const pending = game.state.pendingAttack
            assertExists(pending, 'Attacking has a pending attack')
            const fire = random() < 0.67
            const shot = game
                .run(AttackPiece, {
                    type: ActionType.AttackPiece,
                    playerId,
                    ...(fire ? { coords: pick(pending.targets) } : {})
                })
                .find(isAttackPiece)
            const target = shot?.metadata?.target
            if (fire && target && !shot?.metadata?.damaged && !granted(target)) piecesDestroyed++
            if (shot?.metadata?.torpedo) piecesDestroyed++
            if (shot?.metadata?.damaged) piecesDamaged++
            // Salvaged ships are in a bag again, where they are counted once more.
            piecesSalvaged += shot?.metadata?.salvaged?.length ?? 0
        } else {
            stoppedBecause = `stuck in ${game.state.machineState}`
            break
        }
    }

    const planets = Object.values(game.state.board.hexes).filter(
        (hex) => hex.kind === HexKind.Planet
    )

    // Scrap is not a ship, so it is never counted.
    const shipsIn = (player: (typeof game.state.players)[number]) =>
        player.bag.items.filter((piece) => piece.type !== PieceType.Scrap).length
    const bagsEmpty = game.state.players.some((player) => player.bag.remaining === 0)

    const bagSize =
        overrides.piecesPerType !== undefined
            ? 3 * overrides.piecesPerType
            : Object.values(STARTING_BAG).reduce((total, count) => total + count, 0)

    const onBoard = Object.values(game.state.board.hexes)
        .map((hex) => hex.piece)
        .filter((piece) => piece !== undefined && !granted(piece)).length
    // An elevated planet's orbit holds a marker per rival that never came out of a bag.
    const inOrbit = Object.values(game.state.board.hexes).reduce(
        (total, hex) =>
            total + (hex.orbiters ?? []).filter((probe) => !probe.id.startsWith('orbit-')).length,
        0
    )
    const accountedFor =
        onBoard +
        inOrbit +
        game.state.heldPieces.filter((piece) => !granted(piece)).length +
        piecesDestroyed -
        piecesSalvaged +
        discards +
        game.state.players.reduce(
            (total, player) =>
                total +
                shipsIn(player) +
                player.specialPieces.filter((piece) => !granted(piece)).length,
            0
        )

    return {
        playerCount,
        finalState: game.state,
        actions: game.processed,
        endedBy:
            game.state.machineState !== MachineState.EndOfGame
                ? 'unfinished'
                : bagsEmpty
                  ? 'empty bag'
                  : 'no legal placement',
        turns,
        finished: game.state.machineState === MachineState.EndOfGame,
        stoppedBecause,
        scores: game.state.players.map((player) => player.score),
        planetsExplored: planets.filter((hex) => hex.explored).length,
        planetsTotal: planets.length,
        openHexesLeft: Object.values(game.state.board.hexes).filter(
            (hex) => hex.kind === HexKind.Open && !hex.piece
        ).length,
        piecesLeftInBags: game.state.players.map((player) => player.bag.remaining),
        piecesDestroyed,
        chainsScored,
        technologiesResolved,
        technologiesClaimed: game.state.players.reduce(
            (total, player) => total + player.technologies.length,
            0
        ),
        tilesPlaced,
        discards,
        upgradesSpent,
        piecesDamaged,
        hubsGranted:
            Object.values(game.state.board.hexes).filter((hex) => hex.piece?.hub).length +
            game.state.players.reduce(
                (total, player) => total + player.specialPieces.filter((piece) => piece.hub).length,
                0
            ),
        piecesUnaccounted: playerCount * bagSize + shipsStowed - accountedFor
    }
}

export { Pass }

// A random legal pick for an elevated event, or nothing when the player has no pick.
function eventChoice(
    kind: TechnologyEffectKind,
    state: HydratedEarendelGameState,
    pending: NonNullable<EarendelGameState['pendingEvent']>,
    playerId: string,
    pick: <T>(items: T[]) => T
): Partial<EventPick> {
    switch (kind) {
        case TechnologyEffectKind.OrbitalBombardment: {
            const targets = bombardmentTargets(state, playerId)
            return targets.length > 0 ? { coords: pick(targets) } : {}
        }
        case TechnologyEffectKind.WormholeStorm: {
            const moves = stormOrigins(state, playerId).flatMap((from) =>
                stormDestinations(state, from).map((to) => ({ from, to }))
            )
            return moves.length > 0 ? pick(moves) : {}
        }
        case TechnologyEffectKind.SalvageRights: {
            const cards = salvageChoices(state, playerId)
            return cards.length > 0 ? { technologyId: pick(cards) } : {}
        }
        case TechnologyEffectKind.SignalIntercept: {
            const planets = interceptTargets(state, pending, playerId)
            return planets.length > 0 ? { coords: pick(planets) } : {}
        }
        case TechnologyEffectKind.ShipyardWorld: {
            const pieces = shipyardChoices(pending)
            return pieces.length > 0 ? { piece: pick(pieces) } : {}
        }
        default:
            return {}
    }
}
