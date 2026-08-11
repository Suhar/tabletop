import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HexKind } from '../model/board.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { ChoosePlanet } from '../actions/choosePlanet.js'
import { ChooseTechnology } from '../actions/chooseTechnology.js'
import { DestroyPiece } from '../actions/destroyPiece.js'
import { Pass } from '../actions/pass.js'
import { Prng } from '@tabletop/common'
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

// Setup numbers a simulation may override, to try a sizing without committing to it.
export type SetupOverrides = BoardSetupOptions & {
    piecesPerType?: number
    // Defaults to the game's own default turn style, so simulations measure what ships.
    turnStyle?: TurnStyle
}

export type GameSummary = {
    playerCount: number
    // How the game actually ended - the rules name the empty bag, but a gridlocked board
    // ends it too, and which one fires is the whole question about sizing.
    endedBy: 'empty bag' | 'no legal placement' | 'unfinished'
    turns: number
    finished: boolean
    // Why it stopped, when it didn't finish.
    stoppedBecause?: string
    scores: number[]
    planetsExplored: number
    planetsTotal: number
    openHexesLeft: number
    piecesLeftInBags: number[]
    piecesDestroyed: number
    chainsScored: number
    // Immediate technology effects actually carried out.
    technologiesResolved: number
    // Tiles laid during play by the board-growing technology.
    tilesPlaced: number
    // Ships thrown out of the game by the draft.
    discards: number
    // Logistics Upgrades actually spent.
    upgradesSpent: number
    // Pieces that started in a bag and ended up nowhere. Always zero if the rules are honest:
    // a piece is on the board, in a bag, in a hand, discarded, or destroyed. This is the check
    // that catches a turn ending while its player still held a ship - the ship just disappears,
    // and nothing else in the game would notice.
    piecesUnaccounted: number
}

// A tiny deterministic generator, so a simulation can be re-run exactly. Deliberately not the
// game's own prng - that one belongs to the game state and drawing from it here would change
// what the game itself draws.
function lcg(seed: number): () => number {
    let value = seed >>> 0
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0
        return value / 4294967296
    }
}

// Plays a whole game with every choice made at random. Not an AI and not meant to be one:
// its job is to find out whether the rules as written can reach the end of a game at all,
// and what the board looks like when they do.
export function playRandomGame(
    playerCount: number,
    seed: number,
    overrides: SetupOverrides = {},
    maxTurns = 2000
): GameSummary {
    const game = new TestGame(playerCount, seed, {
        turnStyle: overrides.turnStyle ?? TurnStyle.DraftThree
    })

    if (overrides.tilesPerPlayer !== undefined || overrides.planetsPerTile !== undefined) {
        game.state.board = buildStartingBoard(playerCount, new Prng({ seed, invocations: 0 }), overrides)
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
        // The opening draw happened against the old board; redraw so the turn is coherent.
        game.stackBags((playerId) =>
            game.state.players.find((player) => player.playerId === playerId)!.bag
        )
    }
    const random = lcg(seed * 7919 + 13)
    const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]

    let turns = 0
    let piecesDestroyed = 0
    let technologiesResolved = 0
    let tilesPlaced = 0
    let discards = 0
    let upgradesSpent = 0
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

            // Spends the upgrade most of the time it is available, so both branches of the
            // draft get exercised.
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
            // Any held ship with somewhere legal to go. A drafted hand may hold one that is
            // stuck and one that isn't, so the choice of ship is part of the move.
            const options = game.state.heldPieces.flatMap((piece) =>
                legalPlacementsFor(game.state.board, playerId, piece).map((coords) => ({
                    piece,
                    coords
                }))
            )

            if (options.length === 0) {
                // Shouldn't happen: the engine ends the game in enter() when nothing in hand
                // can be placed. Reaching here means that check has a hole.
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
            chainsScored += placed.reduce(
                (total, action) =>
                    total + (((action as PlacePiece).metadata?.chains ?? []).length),
                0
            )
        } else if (game.state.machineState === MachineState.Exploring) {
            const pending = game.state.pendingExploration!
            if (!pending.exploringPlanet) {
                game.run(ChoosePlanet, {
                    type: ActionType.ChoosePlanet,
                    playerId,
                    coords: pick(pending.candidatePlanets)
                })
            } else {
                const candidates = pending.candidates ?? []
                game.run(ChooseTechnology, {
                    type: ActionType.ChooseTechnology,
                    playerId,
                    ...(candidates.length > 0 ? { technologyId: pick(candidates).id } : {})
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
            const tileId = game.state.bonusPlacementTileId!
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
                // enter() should have taken this for us, so reaching here is a hole.
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
            const pending = game.state.pendingAttack!
            // Fires two times in three, so both branches get exercised.
            const fire = random() < 0.67
            game.run(DestroyPiece, {
                type: ActionType.DestroyPiece,
                playerId,
                ...(fire ? { coords: pick(pending.targets) } : {})
            })
            if (fire) piecesDestroyed++
        } else {
            stoppedBecause = `stuck in ${game.state.machineState}`
            break
        }
    }

    const planets = Object.values(game.state.board.hexes).filter(
        (hex) => hex.kind === HexKind.Planet
    )

    const bagsEmpty = game.state.players.some((player) => player.bag.length === 0)

    // Read from the bag definition rather than assumed: the three types are not dealt in equal
    // numbers, and guessing that they were is how this check first got its own arithmetic wrong.
    const bagSize =
        overrides.piecesPerType !== undefined
            ? 3 * overrides.piecesPerType
            : Object.values(STARTING_BAG).reduce((total, count) => total + count, 0)
    const onBoard = Object.values(game.state.board.hexes).filter((hex) => hex.piece).length
    const accountedFor =
        onBoard +
        game.state.heldPieces.length +
        piecesDestroyed +
        discards +
        game.state.players.reduce(
            (total, player) => total + player.bag.length + player.specialPieces.length,
            0
        )

    return {
        playerCount,
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
        piecesLeftInBags: game.state.players.map((player) => player.bag.length),
        piecesDestroyed,
        chainsScored,
        technologiesResolved,
        tilesPlaced,
        discards,
        upgradesSpent,
        piecesUnaccounted: playerCount * bagSize - accountedFor
    }
}

// Kept so a simulation can pass a Pass without importing the action separately.
export { Pass }
