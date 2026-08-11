import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    HexKind,
    hexKey,
    neighborsOf,
    PlanetColor
} from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind, TechnologyTier } from '../model/technology.js'
import {
    canPlaceTileAt,
    legalTileOrigins,
    openHexesOfTile,
    placeTileOnBoard,
    tileFootprint
} from './tilePlacement.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { PlaceTile } from '../actions/placeTile.js'
import { TestGame } from './testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// A board made of the hexes listed, all open space unless said otherwise.
function boardOf(coords: AxialCoordinates[]): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (const at of coords) {
        board.hexes[hexKey(at)] = { coords: at, tileId: 'existing', kind: HexKind.Open }
    }
    return board
}

describe('canPlaceTileAt', () => {
    it('takes a tile that tucks two of its hexes against the board', () => {
        // One existing tile at the origin; the next one over shares a whole edge.
        const board = boardOf(tileFootprint(at(0, 0)))

        expect(canPlaceTileAt(board, at(2, 0))).toBe(true)
    })

    it('refuses a tile that would overlap the board', () => {
        const board = boardOf(tileFootprint(at(0, 0)))

        expect(canPlaceTileAt(board, at(0, 0))).toBe(false)
        expect(canPlaceTileAt(board, at(1, 0))).toBe(false)
    })

    it('refuses a tile touching the board at only one of its hexes', () => {
        const board = boardOf([at(0, 0)])

        // A tile laid at (1,-2) covers (1,-2) (2,-2) (1,-1) (2,-1), and only (1,-1) touches
        // the single hex of board. One point of contact is not enough.
        expect(canPlaceTileAt(board, at(1, -2))).toBe(false)
    })

    it('counts the tile’s own hexes, so two may touch the same board hex', () => {
        // The rule is that two of the TILE's hexes border the board, not that it borders two
        // separate board hexes - so a lone hex is still something to build against.
        const board = boardOf([at(0, 0)])

        const origins = legalTileOrigins(board)
        expect(origins.length).toBeGreaterThan(0)
        for (const origin of origins) {
            const touching = tileFootprint(origin).filter((coords) =>
                neighborsOf(coords).some((neighbor) => getHex(board, neighbor) !== undefined)
            )
            expect(touching.length).toBeGreaterThanOrEqual(2)
        }
    })

    it('refuses a tile floating free of the board', () => {
        const board = boardOf(tileFootprint(at(0, 0)))

        expect(canPlaceTileAt(board, at(10, 10))).toBe(false)
    })

    it('offers only legal origins, and every one of them works', () => {
        const board = boardOf(tileFootprint(at(0, 0)))
        const origins = legalTileOrigins(board)

        expect(origins.length).toBeGreaterThan(0)
        expect(origins.every((origin) => canPlaceTileAt(board, origin))).toBe(true)
    })
})

describe('placeTileOnBoard', () => {
    it('lays four hexes, one of them the planet', () => {
        const board = boardOf(tileFootprint(at(0, 0)))
        placeTileOnBoard(
            board,
            { id: 'spare', planetOffset: 2, color: PlanetColor.Violet },
            at(2, 0)
        )

        const laid = tileFootprint(at(2, 0)).map((coords) => getHex(board, coords)!)
        expect(laid.filter((hex) => hex.kind === HexKind.Planet)).toHaveLength(1)
        expect(laid.find((hex) => hex.kind === HexKind.Planet)!.color).toBe(PlanetColor.Violet)
        expect(openHexesOfTile(board, 'spare')).toHaveLength(3)
    })
})

describe('growing the board in play', () => {
    function scenario(supplyCount = 1) {
        const game = new TestGame()
        const mover = game.activePlayerId

        // A planet with one approach hex, and a spare tile's worth of space beside it.
        const board: EarendelBoard = { hexes: {} }
        for (const coords of tileFootprint(at(0, 0))) {
            board.hexes[hexKey(coords)] = { coords, tileId: 'start', kind: HexKind.Open }
        }
        board.hexes[hexKey(at(0, 0))] = {
            coords: at(0, 0),
            tileId: 'start',
            kind: HexKind.Planet,
            color: PlanetColor.Azure
        }
        game.state.board = board

        game.state.technologyDeck = [
            {
                id: 'grow-tech',
                colors: [PlanetColor.Azure],
                tier: TechnologyTier.Standard,
                effect: { kind: TechnologyEffectKind.GrowBoard }
            }
        ]
        game.state.technologyDiscard = []
        game.state.tileSupply = Array.from({ length: supplyCount }, (_unused, index) => ({
            id: `spare-${index}`,
            planetOffset: 0,
            color: PlanetColor.Gold
        }))
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Probe, PieceLevel.Two),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station)
        ])

        return { game, mover }
    }

    it('lays a tile and then places a drawn ship on it', () => {
        const { game, mover } = scenario()

        // The probe explores, the only matching card is housed, and the technology fires -
        // all without a decision, so the tile is the first thing asked of the player.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        expect(game.state.machineState).toBe(MachineState.PlacingTile)
        expect(game.validActionsFor(mover)).toEqual([ActionType.PlaceTile])
        expect(game.state.pendingTile?.tile.id).toBe('spare-0')

        const origin = legalTileOrigins(game.state.board)[0]
        game.run(PlaceTile, { type: ActionType.PlaceTile, playerId: mover, coords: origin })

        // A ship is drawn and owed to the new tile, and nowhere else.
        expect(game.state.machineState).toBe(MachineState.PlacingBonusPiece)
        expect(game.state.bonusPlacementTileId).toBe('spare-0')
        expect(game.state.drawnPiece).toBeDefined()

        const onTile = openHexesOfTile(game.state.board, 'spare-0')
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: onTile[0],
            pieceSource: PieceSource.Bag
        })

        expect(game.state.board.hexes[hexKey(onTile[0])].piece?.playerId).toBe(mover)
        expect(game.state.bonusPlacementTileId).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('refuses to put the drawn ship anywhere but the new tile', () => {
        const { game, mover } = scenario()

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })
        game.run(PlaceTile, {
            type: ActionType.PlaceTile,
            playerId: mover,
            coords: legalTileOrigins(game.state.board)[0]
        })

        // (1,1) is open space on the starting tile, not the one just laid.
        expect(() =>
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: mover,
                coords: at(1, 1),
                pieceSource: PieceSource.Bag
            })
        ).toThrow()
    })

    it('comes to nothing when the supply is empty', () => {
        const { game, mover } = scenario(0)

        const processed = game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        // No tile was drawn, so the turn simply ended after the exploration.
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.PlacePiece,
            ActionType.ChoosePlanet,
            ActionType.ChooseTechnology
        ])
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.pendingTile).toBeUndefined()
    })
})
