import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HexKind } from '../model/board.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { ChoosePlanet } from '../actions/choosePlanet.js'
import { ChooseTechnology } from '../actions/chooseTechnology.js'
import { DestroyPiece } from '../actions/destroyPiece.js'
import { Pass } from '../actions/pass.js'
import { Prng } from '@tabletop/common'
import { PieceType } from '../model/pieces.js'
import { buildStartingBoard, type BoardSetupOptions } from './boardSetup.js'
import { buildBag } from './bag.js'
import { TestGame } from './testHarness.js'

// Setup numbers a simulation may override, to try a sizing without committing to it.
export type SetupOverrides = BoardSetupOptions & {
    piecesPerType?: number
}

export type GameSummary = {
    playerCount: number
    // How the game actually ended - the rules name the empty bag, but a gridlocked board
    // ends it too, and which one fires is the whole question about sizing.
    endedBy: 'empty bag' | 'gridlock' | 'unfinished'
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
    const game = new TestGame(playerCount, seed)

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
    let chainsScored = 0
    let stoppedBecause: string | undefined

    while (game.state.machineState !== MachineState.EndOfGame) {
        if (turns >= maxTurns) {
            stoppedBecause = `no end after ${maxTurns} turns`
            break
        }
        turns++

        const playerId = game.activePlayerId

        if (game.state.machineState === MachineState.PlacingPiece) {
            const open = Object.values(game.state.board.hexes).filter(
                (hex) => hex.kind === HexKind.Open && !hex.piece
            )

            if (open.length === 0) {
                stoppedBecause = 'the board filled up: no open hex left to place on'
                break
            }

            const placed = game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId,
                coords: pick(open).coords,
                pieceSource: PieceSource.Bag
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

    return {
        playerCount,
        endedBy:
            game.state.machineState !== MachineState.EndOfGame
                ? 'unfinished'
                : bagsEmpty
                  ? 'empty bag'
                  : 'gridlock',
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
        chainsScored
    }
}

// Kept so a simulation can pass a Pass without importing the action separately.
export { Pass }
