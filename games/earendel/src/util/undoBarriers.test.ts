import { describe, expect, it } from 'vitest'
import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { focusedCardId } from '../model/technologyCards.js'
import type { Tile } from '../model/tile.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PlaceTile } from '../actions/placeTile.js'
import { MovePiece } from '../actions/movePiece.js'
import { UseImmediateDownload } from '../actions/useImmediateDownload.js'
import { legalTilePlacements, openHexesOfTile } from './tilePlacement.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { legalMovesFor } from './movement.js'
import { TestGame, stackedBag } from './testHarness.js'

// A tile drawn from the hidden supply is information nobody had before. Whatever action led to
// the draw must be an Undo barrier (revealsInfo), or a player could undo, peek again, and redo.

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

const card = (effect: TechnologyEffectKind, copy = 0) =>
    focusedCardId(effect, PlanetColor.Periwinkle, copy)

const DOWNLOAD = card(TechnologyEffectKind.ImmediateDownload)

const spareTiles = (count: number): Tile[] =>
    Array.from({ length: count }, (_unused, index) => ({
        id: `spare-${index}`,
        planetOffset: 0,
        color: PlanetColor.Teal
    }))

// Two rows of open space with room around them for new tiles.
function openRows(): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < 12; q++) {
        for (const r of [0, 3]) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    return board
}

function planet(board: EarendelBoard, coords: AxialCoordinates, technologyId: string) {
    board.hexes[hexKey(coords)] = {
        coords,
        tileId: 't1',
        kind: HexKind.Planet,
        color: PlanetColor.Periwinkle,
        explored: true,
        technologyId
    }
}

// The mover surveyed two planets last turn and their probes still lead on both, so opening the
// turn claims both technologies at once: the first acts, the second waits in the queue.
function twoClaims(first: string, second: string, supply: number, moverBag: number) {
    const game = new TestGame()
    const mover = game.activePlayerId

    const board = openRows()
    planet(board, at(2, 0), first)
    planet(board, at(8, 0), second)
    board.hexes[hexKey(at(1, 0))].piece = ship(mover, PieceType.Probe, PieceLevel.Two)
    board.hexes[hexKey(at(7, 0))].piece = ship(mover, PieceType.Probe, PieceLevel.Two)
    // The probes go into orbit when the claims pay; this gives Tactical Shift a piece to move.
    board.hexes[hexKey(at(10, 3))].piece = ship(mover, PieceType.Station)
    game.state.board = board
    game.state.probeClaims = [
        { playerId: mover, coords: at(2, 0), technologyId: first },
        { playerId: mover, coords: at(8, 0), technologyId: second }
    ]
    game.state.technologyDeck = stackedBag([])
    game.state.technologyDiscard = []
    game.state.tileSupply = stackedBag(spareTiles(supply))

    // stackBags opens the turn through the engine, which is when the claims settle.
    game.stackBags((playerId) =>
        Array.from({ length: playerId === mover ? moverBag : 3 }, () =>
            ship(playerId, PieceType.Station)
        )
    )
    return { game, mover }
}

const only = (actions: GameAction[], type: ActionType) => {
    const matching = actions.filter((action) => action.type === type)
    expect(matching).toHaveLength(1)
    return matching[0]
}

describe('Undo barriers on hidden tile draws', () => {
    describe('a PlaceTile that hands on to a queued Beyond the Frontier', () => {
        // The mover's bag holds one ship, which the turn's draw takes - so laying the first tile
        // draws no bonus ship, and PlaceTile reveals nothing of its own.

        it('is a barrier when the second tile is drawn', () => {
            const { game, mover } = twoClaims(
                card(TechnologyEffectKind.GrowBoard, 0),
                card(TechnologyEffectKind.GrowBoard, 1),
                2,
                1
            )
            expect(game.state.machineState).toBe(MachineState.PlacingTile)
            expect(game.state.pendingTile?.tile.id).toBe('spare-0')
            expect(game.state.queuedTechnologyEffects).toHaveLength(1)

            const { origin, rotation } = legalTilePlacements(game.state.board)[0]
            const processed = game.run(PlaceTile, {
                type: ActionType.PlaceTile,
                playerId: mover,
                coords: origin,
                rotation
            })

            const placeTile = only(processed, ActionType.PlaceTile)
            expect((placeTile as PlaceTile).metadata?.noShipPlaced).toBe(true)
            expect(game.state.machineState).toBe(MachineState.PlacingTile)
            expect(game.state.pendingTile?.tile.id).toBe('spare-1')
            expect(game.state.tileSupply.remaining).toBe(0)
            expect(placeTile.revealsInfo).toBe(true)
        })

        // The first tile draws a bonus ship. The queued second Beyond the Frontier is carried out
        // once that ship is placed, and the placement that draws its tile is the barrier.
        it('carries out the queued effect after the bonus ship, as a barrier', () => {
            const { game, mover } = twoClaims(
                card(TechnologyEffectKind.GrowBoard, 0),
                card(TechnologyEffectKind.GrowBoard, 1),
                2,
                4
            )
            const { origin, rotation } = legalTilePlacements(game.state.board)[0]
            game.run(PlaceTile, {
                type: ActionType.PlaceTile,
                playerId: mover,
                coords: origin,
                rotation
            })
            expect(game.state.machineState).toBe(MachineState.PlacingBonusPiece)

            const tileId = game.state.bonusPlacementTileId!
            const processed = game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: mover,
                coords: openHexesOfTile(game.state.board, tileId)[0],
                pieceSource: PieceSource.Bag,
                pieceId: game.state.bonusPlacementPieceId!
            })

            expect(game.state.machineState).toBe(MachineState.PlacingTile)
            expect(game.state.pendingTile?.tile.id).toBe('spare-1')
            expect(game.state.queuedTechnologyEffects).toHaveLength(0)
            expect(only(processed, ActionType.PlacePiece).revealsInfo).toBe(true)
        })

        it('is not a barrier when the supply has run dry and nothing is drawn', () => {
            const { game, mover } = twoClaims(
                card(TechnologyEffectKind.GrowBoard, 0),
                card(TechnologyEffectKind.GrowBoard, 1),
                1,
                1
            )
            expect(game.state.pendingTile?.tile.id).toBe('spare-0')

            const { origin, rotation } = legalTilePlacements(game.state.board)[0]
            const processed = game.run(PlaceTile, {
                type: ActionType.PlaceTile,
                playerId: mover,
                coords: origin,
                rotation
            })

            expect(game.state.pendingTile).toBeUndefined()
            expect(game.state.machineState).toBe(MachineState.PlacingPiece)
            expect(only(processed, ActionType.PlaceTile).revealsInfo).toBeFalsy()
        })
    })

    describe('a MovePiece that hands on to a queued Beyond the Frontier', () => {
        const scenario = (supply: number) =>
            twoClaims(
                card(TechnologyEffectKind.MoveFriendlyPiece),
                card(TechnologyEffectKind.GrowBoard),
                supply,
                3
            )

        const move = (game: TestGame, mover: string) => {
            expect(game.state.machineState).toBe(MachineState.ResolvingTechnology)
            expect(game.state.queuedTechnologyEffects).toHaveLength(1)
            const step = legalMovesFor(game.state.board, mover)[0]
            return game.run(MovePiece, {
                type: ActionType.MovePiece,
                playerId: mover,
                from: step.from,
                to: step.to
            })
        }

        it('is a barrier when the tile is drawn', () => {
            const { game, mover } = scenario(1)

            const processed = move(game, mover)

            expect(game.state.machineState).toBe(MachineState.PlacingTile)
            expect(game.state.pendingTile?.tile.id).toBe('spare-0')
            expect(only(processed, ActionType.MovePiece).revealsInfo).toBe(true)
        })

        it('is not a barrier when there is no tile to draw', () => {
            const { game, mover } = scenario(0)

            const processed = move(game, mover)

            expect(game.state.pendingTile).toBeUndefined()
            expect(game.state.machineState).toBe(MachineState.PlacingPiece)
            expect(only(processed, ActionType.MovePiece).revealsInfo).toBeFalsy()
        })
    })

    describe('Immediate Download', () => {
        // The mover holds a Download on the planet at (2,0); the planet at (8,0), in clear sight
        // along the row, holds the technology to take.
        function scenario(farEffect: TechnologyEffectKind, supply: number) {
            const game = new TestGame()
            const mover = game.activePlayerId
            const board = openRows()
            planet(board, at(2, 0), DOWNLOAD)
            planet(board, at(8, 0), card(farEffect, 1))
            game.state.board = board
            game.state.technologyDeck = stackedBag([])
            game.state.technologyDiscard = []
            game.state.tileSupply = stackedBag(spareTiles(supply))
            const playerState = game.state.players.find((p) => p.playerId === mover)!
            playerState.technologies = [DOWNLOAD]
            playerState.storedEffects = [TechnologyEffectKind.ImmediateDownload]
            game.stackBags((playerId) => [
                ship(playerId, PieceType.Station),
                ship(playerId, PieceType.Station),
                ship(playerId, PieceType.Station)
            ])
            const processed = game.run(UseImmediateDownload, {
                type: ActionType.UseImmediateDownload,
                playerId: mover,
                from: at(2, 0),
                to: at(8, 0)
            })
            return { game, download: only(processed, ActionType.UseImmediateDownload) }
        }

        it('is a barrier when it downloads Beyond the Frontier and draws a tile', () => {
            const { game, download } = scenario(TechnologyEffectKind.GrowBoard, 1)

            expect(game.state.machineState).toBe(MachineState.PlacingTile)
            expect(game.state.pendingTile?.tile.id).toBe('spare-0')
            expect(download.revealsInfo).toBe(true)
        })

        it('is not a barrier when Beyond the Frontier finds the supply empty', () => {
            const { game, download } = scenario(TechnologyEffectKind.GrowBoard, 0)

            expect(game.state.pendingTile).toBeUndefined()
            expect(download.revealsInfo).toBeFalsy()
        })

        it('is not a barrier when the downloaded technology draws nothing', () => {
            const { game, download } = scenario(TechnologyEffectKind.Railgun, 1)

            expect(game.state.tileSupply.remaining).toBe(1)
            expect(download.revealsInfo).toBeFalsy()
        })
    })
})
