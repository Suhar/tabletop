import { describe, expect, it } from 'vitest'
import { type AxialCoordinates, sameCoordinates } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    HexKind,
    hexKey,
    neighborsOf,
    PlanetColor
} from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { TurnStyle } from '../definition/config.js'
import { isPlaceTile, PlaceTile } from '../actions/placeTile.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { DiscardPiece } from '../actions/discardPiece.js'
import { UseBeyondTheFrontier } from '../actions/useBeyondTheFrontier.js'
import { legalPlacementsOnTile } from '../util/placement.js'
import { legalTilePlacements, tileFootprint } from '../util/tilePlacement.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// The mover has drafted, holds Beyond the Frontier, and has just spent it: the tile is waiting
// to be laid.
function tileWaiting(drawn: PieceType = PieceType.Station) {
    const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
    const mover = game.activePlayerId
    const rival = game.state.players.find((player) => player.playerId !== mover)!.playerId

    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < 12; q++) {
        board.hexes[hexKey(at(q, 0))] = { coords: at(q, 0), tileId: 't1', kind: HexKind.Open }
    }
    game.state.board = board
    game.state.technologyDeck = stackedBag([])
    game.state.technologyDiscard = []
    game.state.tileSupply = stackedBag([
        { id: 'spare-0', planetOffset: 0, color: PlanetColor.Teal }
    ])
    game.giveTechnology(mover, TechnologyEffectKind.GrowBoard)
    game.stackBags((playerId) =>
        Array.from({ length: 4 }, () => ship(playerId, drawn, PieceLevel.Two))
    )
    game.run(DiscardPiece, {
        type: ActionType.DiscardPiece,
        playerId: mover,
        pieceId: game.state.heldPieces[0].id
    })
    game.run(UseBeyondTheFrontier, { type: ActionType.UseBeyondTheFrontier, playerId: mover })
    expect(game.state.machineState).toBe(MachineState.PlacingTile)

    const { origin, rotation } = legalTilePlacements(game.state.board)[0]
    return { game, mover, rival, origin, rotation, footprint: tileFootprint(origin, rotation) }
}

// A rival interdictor on a hex outside the tile, beside the given hex of it.
function interdict(
    board: EarendelBoard,
    rival: string,
    footprint: AxialCoordinates[],
    beside: AxialCoordinates
) {
    const outside = neighborsOf(beside).find((neighbor) => {
        if (footprint.some((coords) => sameCoordinates(coords, neighbor))) return false
        const hex = getHex(board, neighbor)
        return !hex || (hex.kind === HexKind.Open && !hex.piece)
    })!
    board.hexes[hexKey(outside)] = {
        coords: outside,
        tileId: 't1',
        kind: HexKind.Open,
        piece: ship(rival, PieceType.Interdictor)
    }
}

describe('the ship that follows a tile', () => {
    it('goes back in the bag when rival interdictors close every hex of the tile', () => {
        const { game, mover, rival, origin, rotation, footprint } = tileWaiting()
        for (const coords of footprint) interdict(game.state.board, rival, footprint, coords)
        const bagSize = () =>
            game.state.players.find((player) => player.playerId === mover)!.bag.items.length
        const bagBefore = bagSize()

        const processed = game.run(PlaceTile, {
            type: ActionType.PlaceTile,
            playerId: mover,
            coords: origin,
            rotation
        })

        const laid = processed.find(isPlaceTile)
        expect(laid?.metadata?.noShipPlaced).toBe(true)
        expect(laid?.metadata?.tileClosedToShip).toBe(true)
        expect(game.state.machineState).not.toBe(MachineState.PlacingBonusPiece)
        expect(game.state.bonusPlacementTileId).toBeUndefined()
        // Drawn with the tile, so the bag was one short until the ship went back.
        expect(bagSize()).toBe(bagBefore + 1)
        expect(game.state.heldPieces).toHaveLength(2)
        expect(game.state.bonusPlacementPieceId).toBeUndefined()
    })

    it('may only land on a hex of the tile that is open to it', () => {
        const { game, mover, rival, origin, rotation, footprint } = tileWaiting()
        game.run(PlaceTile, {
            type: ActionType.PlaceTile,
            playerId: mover,
            coords: origin,
            rotation
        })
        expect(game.state.machineState).toBe(MachineState.PlacingBonusPiece)

        const tileId = game.state.bonusPlacementTileId!
        const drawn = game.state.heldPieces.find(
            (piece) => piece.id === game.state.bonusPlacementPieceId
        )!
        const open = legalPlacementsOnTile(game.state.board, mover, drawn, tileId)
        expect(open).toHaveLength(3)

        interdict(game.state.board, rival, footprint, open[0])
        const stillOpen = legalPlacementsOnTile(game.state.board, mover, drawn, tileId)
        expect(stillOpen.some((coords) => sameCoordinates(coords, open[0]))).toBe(false)
        expect(stillOpen.length).toBeGreaterThan(0)

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: stillOpen[0],
            pieceSource: PieceSource.Bag,
            pieceId: drawn.id
        })
        expect(game.state.bonusPlacementTileId).toBeUndefined()
    })
})
