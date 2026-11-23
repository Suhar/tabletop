import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { focusedCardId } from '../model/technologyCards.js'
import type { Tile } from '../model/tile.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isPlaceTile, PlaceTile } from '../actions/placeTile.js'
import { isUseBeyondTheFrontier, UseBeyondTheFrontier } from '../actions/useBeyondTheFrontier.js'
import { isUseImmediateDownload, UseImmediateDownload } from '../actions/useImmediateDownload.js'
import { isUseTacticalShift, UseTacticalShift } from '../actions/useTacticalShift.js'
import { legalTilePlacements } from './tilePlacement.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

// A tile drawn from the hidden supply, or a ship drawn from a bag, is information nobody had
// before. The action that draws it must be an Undo barrier (revealsInfo), or a player could undo,
// peek again, and redo. An action that draws nothing must not be one.

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type
})

const spareTiles = (count: number): Tile[] =>
    Array.from({ length: count }, (_unused, index) => ({
        id: `spare-${index}`,
        planetOffset: 0,
        color: PlanetColor.Teal
    }))

// Two rows of open space with room around them for new tiles, and a station of the mover's.
function scenario(moverBag: number, ...technologies: TechnologyEffectKind[]) {
    const game = new TestGame()
    const mover = game.activePlayerId

    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < 12; q++) {
        for (const r of [0, 3]) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    board.hexes[hexKey(at(10, 3))].piece = ship(mover, PieceType.Station)
    game.state.board = board
    game.state.technologyDeck = stackedBag([])
    game.state.technologyDiscard = []
    game.state.tileSupply = stackedBag(spareTiles(1))
    game.giveTechnology(mover, ...technologies)

    // stackBags opens the turn through the engine, drawing the turn's ship.
    game.stackBags((playerId) =>
        Array.from({ length: playerId === mover ? moverBag : 3 }, () =>
            ship(playerId, PieceType.Station)
        )
    )
    return { game, mover }
}

function layTile(game: TestGame, mover: string) {
    const { origin, rotation } = legalTilePlacements(game.state.board)[0]
    return game
        .run(PlaceTile, { type: ActionType.PlaceTile, playerId: mover, coords: origin, rotation })
        .find(isPlaceTile)
}

describe('Undo barriers on hidden draws', () => {
    describe('Beyond the Frontier', () => {
        it('is a barrier when it is used, because the tile and its ship are drawn then', () => {
            const { game, mover } = scenario(3, TechnologyEffectKind.GrowBoard)
            const heldBefore = game.state.heldPieces.length

            const used = game
                .run(UseBeyondTheFrontier, {
                    type: ActionType.UseBeyondTheFrontier,
                    playerId: mover
                })
                .find(isUseBeyondTheFrontier)

            expect(used?.revealsInfo).toBe(true)
            expect(game.state.pendingTile?.tile.id).toBe('spare-0')
            expect(game.state.tileSupply.remaining).toBe(0)
            // The ship is in hand, face up, before the tile is laid.
            expect(used?.metadata?.drawn).toBeDefined()
            expect(game.state.heldPieces).toHaveLength(heldBefore + 1)
            expect(game.state.bonusPlacementPieceId).toBe(used?.metadata?.drawn?.id)
        })

        it('leaves laying the tile undoable: nothing more is drawn then', () => {
            const { game, mover } = scenario(3, TechnologyEffectKind.GrowBoard)
            game.run(UseBeyondTheFrontier, {
                type: ActionType.UseBeyondTheFrontier,
                playerId: mover
            })

            const laid = layTile(game, mover)

            expect(laid?.revealsInfo).toBeFalsy()
            expect(game.state.machineState).toBe(MachineState.PlacingBonusPiece)
        })

        it('draws no ship when the bag is empty, and none follows the tile', () => {
            // The mover's bag holds one ship, which the turn's draw took.
            const { game, mover } = scenario(1, TechnologyEffectKind.GrowBoard)
            const used = game
                .run(UseBeyondTheFrontier, {
                    type: ActionType.UseBeyondTheFrontier,
                    playerId: mover
                })
                .find(isUseBeyondTheFrontier)
            expect(used?.metadata?.drawn).toBeUndefined()

            const laid = layTile(game, mover)

            expect(laid?.metadata?.noShipPlaced).toBe(true)
            expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        })
    })

    describe('technologies that draw nothing', () => {
        it('Tactical Shift is not a barrier', () => {
            const { game, mover } = scenario(3, TechnologyEffectKind.MoveFriendlyPiece)

            const used = game
                .run(UseTacticalShift, {
                    type: ActionType.UseTacticalShift,
                    playerId: mover,
                    from: at(10, 3),
                    to: at(9, 3)
                })
                .find(isUseTacticalShift)

            expect(used).toBeDefined()
            expect(used?.revealsInfo).toBeFalsy()
        })

        it('Immediate Download is not a barrier, even when it downloads Beyond the Frontier', () => {
            const { game, mover } = scenario(3)
            const download = focusedCardId(
                TechnologyEffectKind.ImmediateDownload,
                PlanetColor.Periwinkle,
                0
            )
            const frontier = focusedCardId(
                TechnologyEffectKind.GrowBoard,
                PlanetColor.Periwinkle,
                0
            )
            const planet = (coords: AxialCoordinates, technologyId: string) => {
                game.state.board.hexes[hexKey(coords)] = {
                    coords,
                    tileId: 't1',
                    kind: HexKind.Planet,
                    color: PlanetColor.Periwinkle,
                    explored: true,
                    technologyId
                }
            }
            planet(at(2, 0), download)
            planet(at(5, 0), frontier)
            const player = game.state.players.find((p) => p.playerId === mover)!
            player.technologies = [download]
            player.storedEffects = [TechnologyEffectKind.ImmediateDownload]

            const read = game
                .run(UseImmediateDownload, {
                    type: ActionType.UseImmediateDownload,
                    playerId: mover,
                    from: at(2, 0),
                    to: at(5, 0)
                })
                .find(isUseImmediateDownload)

            // The tile stays in the supply until the downloaded technology is itself used.
            expect(read?.revealsInfo).toBeFalsy()
            expect(game.state.pendingTile).toBeUndefined()
            expect(game.state.tileSupply.remaining).toBe(1)
            expect(game.state.players.find((p) => p.playerId === mover)!.technologies).toContain(
                frontier
            )
        })
    })
})
