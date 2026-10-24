import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { getHex, HexKind } from '../model/board.js'
import { isPlacePiece, PieceSource, PlacePiece } from '../actions/placePiece.js'
import { ChoosePlanet } from '../actions/choosePlanet.js'
import { ChooseTechnology } from '../actions/chooseTechnology.js'
import { AttackPiece, isAttackPiece } from '../actions/attackPiece.js'
import { Pass } from '../actions/pass.js'
import { assertExists, type GameAction, type GameStartOptions, Prng } from '@tabletop/common'
import { PieceType, STARTING_BAG } from '../model/pieces.js'
import { buildStartingBoard, type BoardSetupOptions } from './boardSetup.js'
import { buildBag } from './bag.js'
import { TurnStyle } from '../definition/config.js'
import { legalPlacementsFor } from './placement.js'
import { legalMovesFor } from './movement.js'
import { MovePiece } from '../actions/movePiece.js'
import { PlaceTile } from '../actions/placeTile.js'
import { DiscardPiece } from '../actions/discardPiece.js'
import { UseLogisticsUpgrade } from '../actions/useLogisticsUpgrade.js'
import { DrawPieces } from '../actions/drawPieces.js'
import { legalTilePlacements, openHexesOfTile } from './tilePlacement.js'
import { TestGame } from './testHarness.js'
import type { EarendelGameState } from '../model/gameState.js'

export type SetupOverrides = BoardSetupOptions & {
    piecesPerType?: number
    turnStyle?: TurnStyle
    start?: GameStartOptions
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
        { turnStyle: overrides.turnStyle ?? TurnStyle.DraftThree },
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
        const perType = {
            [PieceType.Probe]: overrides.piecesPerType,
            [PieceType.Station]: overrides.piecesPerType,
            [PieceType.Fighter]: overrides.piecesPerType
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

    let turns = 0
    let piecesDestroyed = 0
    let technologiesResolved = 0
    let tilesPlaced = 0
    let discards = 0
    let upgradesSpent = 0
    let piecesDamaged = 0
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
                game.run(DiscardPiece, {
                    type: ActionType.DiscardPiece,
                    playerId,
                    pieceId: pick(held).id
                })
                discards++
            }
        } else if (game.state.machineState === MachineState.PlacingPiece) {
            const options = game.state.heldPieces.flatMap((piece) =>
                legalPlacementsFor(game.state.board, playerId, piece).map((coords) => ({
                    piece,
                    coords
                }))
            )

            if (options.length === 0) {
                stoppedBecause = 'no legal placement, but the game did not end'
                break
            }

            const choice = pick(options)
            const placed = game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId,
                coords: choice.coords,
                pieceSource: PieceSource.Bag,
                pieceId: choice.piece.id
            })
            chainsScored += placed
                .filter(isPlacePiece)
                .reduce((total, action) => total + (action.metadata?.chains ?? []).length, 0)
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
            const open = openHexesOfTile(game.state.board, tileId)
            if (open.length === 0) {
                stoppedBecause = 'nowhere on the new tile to place the ship'
                break
            }
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId,
                coords: pick(open),
                pieceSource: PieceSource.Bag,
                pieceId: game.state.bonusPlacementPieceId
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
            if (fire && !shot?.metadata?.damaged) piecesDestroyed++
            if (shot?.metadata?.damaged) piecesDamaged++
        } else {
            stoppedBecause = `stuck in ${game.state.machineState}`
            break
        }
    }

    const planets = Object.values(game.state.board.hexes).filter(
        (hex) => hex.kind === HexKind.Planet
    )

    const bagsEmpty = game.state.players.some((player) => player.bag.remaining === 0)

    const bagSize =
        overrides.piecesPerType !== undefined
            ? 3 * overrides.piecesPerType
            : Object.values(STARTING_BAG).reduce((total, count) => total + count, 0)

    const granted = (piece: { hub?: boolean }) => piece.hub === true
    const onBoard = Object.values(game.state.board.hexes)
        .map((hex) => hex.piece)
        .filter((piece) => piece !== undefined && !granted(piece)).length
    const inOrbit = Object.values(game.state.board.hexes).reduce(
        (total, hex) => total + (hex.orbiters?.length ?? 0),
        0
    )
    const accountedFor =
        onBoard +
        inOrbit +
        game.state.heldPieces.filter((piece) => !granted(piece)).length +
        piecesDestroyed +
        discards +
        game.state.players.reduce(
            (total, player) =>
                total +
                player.bag.remaining +
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
        piecesUnaccounted: playerCount * bagSize - accountedFor
    }
}

export { Pass }
