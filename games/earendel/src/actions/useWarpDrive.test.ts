import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isUseWarpDrive, UseWarpDrive } from './useWarpDrive.js'
import { warpDestinationsFrom } from '../util/movement.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// A corridor of open space, one hex wide: (0,0) to (9,0). The mover's probe stands at (0,0),
// a planet lies off the far end at (9,1) with open space at (8,1) beside it.
function scenario(block?: (board: EarendelBoard, rival: string) => void) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const rival = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < 10; q++) {
        board.hexes[hexKey(at(q, 0))] = { coords: at(q, 0), tileId: 't1', kind: HexKind.Open }
    }
    board.hexes[hexKey(at(9, 1))] = {
        coords: at(9, 1),
        tileId: 't1',
        kind: HexKind.Planet,
        color: PlanetColor.Teal
    }
    board.hexes[hexKey(at(0, 0))].piece = ship(mover, PieceType.Probe, PieceLevel.Two)
    block?.(board, rival)
    game.state.board = board
    game.state.technologyDeck = stackedBag([])
    game.state.technologyDiscard = []
    game.state.tileSupply = stackedBag([])
    game.giveTechnology(mover, TechnologyEffectKind.WarpDrive)
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])
    return { game, mover, rival }
}

const warp = (playerId: string, from: AxialCoordinates, to: AxialCoordinates) => ({
    type: ActionType.UseWarpDrive as const,
    playerId,
    from,
    to
})

const reaches = (game: TestGame, from: AxialCoordinates, to: AxialCoordinates) =>
    warpDestinationsFrom(game.state.board, from).some((c) => c.q === to.q && c.r === to.r)

describe('Warp Drive', () => {
    it('carries a piece any distance through empty space, and it counts as placed', () => {
        const { game, mover } = scenario()
        expect(warpDestinationsFrom(game.state.board, at(0, 0))).toHaveLength(9)

        const used = game.run(UseWarpDrive, warp(mover, at(0, 0), at(9, 0))).find(isUseWarpDrive)

        expect(game.state.board.hexes[hexKey(at(0, 0))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(9, 0))].piece?.type).toBe(PieceType.Probe)
        // Newly placed beside an unexplored planet it leads on: it may survey.
        expect(used?.metadata?.probeDestinations).toEqual([at(9, 1)])
        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.state.players.find((p) => p.playerId === mover)!.storedEffects).toEqual([])
    })

    it('cannot pass through a piece, a planet or nebula', () => {
        const blocked = scenario((board, rival) => {
            board.hexes[hexKey(at(4, 0))].piece = ship(rival, PieceType.Station)
        })
        expect(reaches(blocked.game, at(0, 0), at(3, 0))).toBe(true)
        expect(reaches(blocked.game, at(0, 0), at(4, 0))).toBe(false)
        expect(reaches(blocked.game, at(0, 0), at(5, 0))).toBe(false)
        expect(() =>
            blocked.game.run(UseWarpDrive, warp(blocked.mover, at(0, 0), at(5, 0)))
        ).toThrow()

        const clouded = scenario((board) => {
            board.hexes[hexKey(at(2, 0))].kind = HexKind.Nebula
        })
        expect(reaches(clouded.game, at(0, 0), at(1, 0))).toBe(true)
        expect(reaches(clouded.game, at(0, 0), at(3, 0))).toBe(false)
    })

    it("moves only the player's own pieces, and only with the technology", () => {
        const { game, mover, rival } = scenario((board, rivalId) => {
            board.hexes[hexKey(at(5, 0))].piece = ship(rivalId, PieceType.Station)
        })
        expect(() => game.run(UseWarpDrive, warp(mover, at(5, 0), at(6, 0)))).toThrow()
        game.run(UseWarpDrive, warp(mover, at(0, 0), at(3, 0)))
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseWarpDrive)
        expect(game.validActionsFor(rival)).not.toContain(ActionType.UseWarpDrive)
    })
})
