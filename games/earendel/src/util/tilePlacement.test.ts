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
import { TechnologyEffectKind } from '../model/technology.js'
import { focusedCardId } from '../model/technologyCards.js'
import {
    canPlaceTileAt,
    legalTilePlacements,
    openHexesOfTile,
    placeTileOnBoard,
    tileFootprint,
    TILE_ROTATIONS
} from './tilePlacement.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { PlaceTile } from '../actions/placeTile.js'
import { DiscardPiece } from '../actions/discardPiece.js'
import { isUseBeyondTheFrontier, UseBeyondTheFrontier } from '../actions/useBeyondTheFrontier.js'
import { TurnStyle } from '../definition/config.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })
const FRONTIER = focusedCardId(TechnologyEffectKind.GrowBoard, PlanetColor.Periwinkle, 0)

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

        const placements = legalTilePlacements(board)
        expect(placements.length).toBeGreaterThan(0)
        for (const { origin, rotation } of placements) {
            const touching = tileFootprint(origin, rotation).filter((coords) =>
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
        const placements = legalTilePlacements(board)

        expect(placements.length).toBeGreaterThan(0)
        expect(
            placements.every(({ origin, rotation }) => canPlaceTileAt(board, origin, rotation))
        ).toBe(true)
    })
})

describe('rotation', () => {
    it('turns the tile through six anchored footprints', () => {
        const shapes = new Set(
            Array.from({ length: TILE_ROTATIONS }, (_unused, rotation) =>
                tileFootprint(at(0, 0), rotation)
                    .map((coords) => `${coords.q},${coords.r}`)
                    .sort()
                    .join(' ')
            )
        )

        // All six are distinct as anchored placements, and every one includes the origin.
        expect(shapes.size).toBe(TILE_ROTATIONS)
        for (let rotation = 0; rotation < TILE_ROTATIONS; rotation++) {
            expect(tileFootprint(at(0, 0), rotation)).toContainEqual(at(0, 0))
            expect(tileFootprint(at(0, 0), rotation)).toHaveLength(4)
        }
    })

    it('turns the planet with the tile', () => {
        const board = boardOf(tileFootprint(at(0, 0)))
        const tile = { id: 'spare', planetOffset: 1, color: PlanetColor.Violet }

        const planetFor = (rotation: number) => {
            const fresh = boardOf(tileFootprint(at(0, 0)))
            placeTileOnBoard(fresh, tile, at(4, 0), rotation)
            return Object.values(fresh.hexes).find((hex) => hex.kind === HexKind.Planet)!.coords
        }

        // Same origin, same tile, different rotations - the planet lands somewhere different
        // each time, which is the reason to offer the choice at all.
        const positions = new Set(
            Array.from({ length: TILE_ROTATIONS }, (_unused, rotation) => {
                const coords = planetFor(rotation)
                return `${coords.q},${coords.r}`
            })
        )
        expect(positions.size).toBe(TILE_ROTATIONS)
        expect(board).toBeDefined()
    })

    it('opens up placements a single orientation could not reach', () => {
        // A one-hex board: with the tile fixed one way there are far fewer ways to tuck two
        // of its hexes against it than with all six available.
        const board = boardOf([at(0, 0)])
        const all = legalTilePlacements(board)
        const upright = all.filter((placement) => placement.rotation === 0)

        expect(all.length).toBeGreaterThan(upright.length)
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
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        // A planet with one approach hex, and a spare tile's worth of space beside it.
        const board: EarendelBoard = { hexes: {} }
        for (const coords of tileFootprint(at(0, 0))) {
            board.hexes[hexKey(coords)] = { coords, tileId: 'start', kind: HexKind.Open }
        }
        board.hexes[hexKey(at(0, 0))] = {
            coords: at(0, 0),
            tileId: 'start',
            kind: HexKind.Planet,
            color: PlanetColor.Periwinkle
        }
        // Two loose hexes off to the side give the other player somewhere to spend their turn
        // without touching the planet or the starting tile's last spaces.
        for (const coords of [at(5, 5), at(6, 5)]) {
            board.hexes[hexKey(coords)] = { coords, tileId: 'start', kind: HexKind.Open }
        }
        game.state.board = board

        game.state.technologyDeck = stackedBag([FRONTIER])
        game.state.technologyDiscard = []
        game.state.tileSupply = stackedBag(
            Array.from({ length: supplyCount }, (_unused, index) => ({
                id: `spare-${index}`,
                planetOffset: 0,
                color: PlanetColor.Teal
            }))
        )
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Probe, PieceLevel.Two),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station)
        ])

        return { game, mover, other }
    }

    // The mover holds Beyond the Frontier and spends it: the turn's ship is drawn first (a
    // technology is used once the draw is in hand), then the tile is handed over.
    function useFrontier(game: TestGame, mover: string) {
        game.giveTechnology(mover, TechnologyEffectKind.GrowBoard)
        return game.run(UseBeyondTheFrontier, {
            type: ActionType.UseBeyondTheFrontier,
            playerId: mover
        })
    }

    it('lays a tile and then places a drawn ship on it', () => {
        const { game, mover } = scenario()

        // Spending the technology draws the tile and hands it over to be laid.
        const used = useFrontier(game, mover).find(isUseBeyondTheFrontier)
        expect(used?.revealsInfo).toBe(true)
        expect(game.state.players.find((p) => p.playerId === mover)!.storedEffects).not.toContain(
            TechnologyEffectKind.GrowBoard
        )

        expect(game.state.machineState).toBe(MachineState.PlacingTile)
        expect(game.validActionsFor(mover)).toEqual([ActionType.PlaceTile])
        expect(game.state.pendingTile?.tile.id).toBe('spare-0')

        const { origin, rotation } = legalTilePlacements(game.state.board)[0]
        game.run(PlaceTile, {
            type: ActionType.PlaceTile,
            playerId: mover,
            coords: origin,
            rotation
        })

        // A ship is drawn and owed to the new tile, and nowhere else.
        expect(game.state.machineState).toBe(MachineState.PlacingBonusPiece)
        expect(game.state.bonusPlacementTileId).toBe('spare-0')
        expect(game.state.heldPieces.length).toBeGreaterThan(0)

        // The ship has to be named now: the player is still holding the ship they drew for the
        // turn when the tile's bonus ship arrives, and two in hand is ambiguous.
        const onTile = openHexesOfTile(game.state.board, 'spare-0')
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: onTile[0],
            pieceSource: PieceSource.Bag,
            pieceId: game.state.bonusPlacementPieceId
        })

        expect(game.state.board.hexes[hexKey(onTile[0])].piece?.playerId).toBe(mover)
        expect(game.state.bonusPlacementTileId).toBeUndefined()
        // Still their turn: the ship they drew for the turn itself is still in hand and still
        // owed a hex.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).toBe(mover)
    })

    it('refuses to put the drawn ship anywhere but the new tile', () => {
        const { game, mover } = scenario()

        useFrontier(game, mover)
        const first = legalTilePlacements(game.state.board)[0]
        game.run(PlaceTile, {
            type: ActionType.PlaceTile,
            playerId: mover,
            coords: first.origin,
            rotation: first.rotation
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

    it('refuses a special piece in place of the ship drawn with the tile', () => {
        const { game, mover } = scenario()
        game.state.players.find((p) => p.playerId === mover)!.specialPieces = [
            ship(mover, PieceType.Station)
        ]

        useFrontier(game, mover)
        const first = legalTilePlacements(game.state.board)[0]
        game.run(PlaceTile, {
            type: ActionType.PlaceTile,
            playerId: mover,
            coords: first.origin,
            rotation: first.rotation
        })

        const onTile = openHexesOfTile(game.state.board, 'spare-0')
        const special = game.state.players.find((p) => p.playerId === mover)!.specialPieces[0]

        // The technology says draw a ship and place it - a special piece is not a stand-in.
        expect(() =>
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: mover,
                coords: onTile[0],
                pieceSource: PieceSource.Special,
                pieceId: special.id
            })
        ).toThrow()
    })

    it('offers PlacePiece as a valid action while the tile ship is owed', () => {
        // The board asks the engine what is legal rather than matching machine states by
        // name, so this is the check that keeps the two in step.
        const { game, mover } = scenario()

        useFrontier(game, mover)
        const first = legalTilePlacements(game.state.board)[0]
        game.run(PlaceTile, {
            type: ActionType.PlaceTile,
            playerId: mover,
            coords: first.origin,
            rotation: first.rotation
        })

        expect(game.state.machineState).toBe(MachineState.PlacingBonusPiece)
        expect(game.validActionsFor(mover)).toContain(ActionType.PlacePiece)
    })

    it('waits for the draft discard on a DRAFTED turn, then hands the tile over', () => {
        // Every other test here runs the single-piece style, but DraftThree is the configured
        // default - so this is the shape a real game actually takes.
        const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
        const mover = game.activePlayerId

        const board: EarendelBoard = { hexes: {} }
        for (const coords of tileFootprint(at(0, 0))) {
            board.hexes[hexKey(coords)] = { coords, tileId: 'start', kind: HexKind.Open }
        }
        game.state.board = board
        game.state.technologyDeck = stackedBag([])
        game.state.technologyDiscard = []
        game.state.tileSupply = stackedBag([
            { id: 'spare-0', planetOffset: 0, color: PlanetColor.Teal }
        ])
        game.giveTechnology(mover, TechnologyEffectKind.GrowBoard)
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station)
        ])

        // stackBags opens the turn: three ships in hand and a discard owed, and no technology
        // may be used until it is made.
        expect(game.state.machineState).toBe(MachineState.DraftingPieces)
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseBeyondTheFrontier)
        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: game.state.heldPieces[0].id
        })

        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.validActionsFor(mover)).toContain(ActionType.UseBeyondTheFrontier)
        game.run(UseBeyondTheFrontier, { type: ActionType.UseBeyondTheFrontier, playerId: mover })
        expect(game.state.machineState).toBe(MachineState.PlacingTile)
        expect(game.state.pendingTile?.tile.id).toBe('spare-0')

        const first = legalTilePlacements(game.state.board)[0]
        game.run(PlaceTile, {
            type: ActionType.PlaceTile,
            playerId: mover,
            coords: first.origin,
            rotation: first.rotation
        })

        // The tile owes a ship, placed before the turn's own two.
        expect(game.state.machineState).toBe(MachineState.PlacingBonusPiece)
        const onTile = openHexesOfTile(game.state.board, 'spare-0')
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: onTile[0],
            pieceSource: PieceSource.Bag,
            pieceId: game.state.bonusPlacementPieceId
        })

        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.heldPieces).toHaveLength(2)
    })

    it('cannot be spent while the supply is empty, and is kept for later', () => {
        const { game, mover } = scenario(0)
        game.giveTechnology(mover, TechnologyEffectKind.GrowBoard)

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseBeyondTheFrontier)
        expect(() =>
            game.run(UseBeyondTheFrontier, {
                type: ActionType.UseBeyondTheFrontier,
                playerId: mover
            })
        ).toThrow()
        expect(game.state.players.find((p) => p.playerId === mover)!.storedEffects).toContain(
            TechnologyEffectKind.GrowBoard
        )
    })
})
