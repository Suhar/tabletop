import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, neighborsOf } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { isUseDimensionalRift, UseDimensionalRift } from './useDimensionalRift.js'
import { borderHexes, riftDestinationsFrom } from '../util/movement.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })
const has = (list: AxialCoordinates[], coords: AxialCoordinates) =>
    list.some((c) => c.q === coords.q && c.r === coords.r)

let ids = 0
const ship = (playerId: string, type: PieceType): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type
})

// A hexagon of open space three hexes out from the center, with the hex at (1,0) missing: a
// hole wholly enclosed by the board.
function disc(): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = -3; q <= 3; q++) {
        for (let r = -3; r <= 3; r++) {
            if (Math.abs(q + r) > 3 || (q === 1 && r === 0)) continue
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    return board
}

function scenario(place: (board: EarendelBoard, mover: string, rival: string) => void) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const rival = game.state.players.find((p) => p.playerId !== mover)!.playerId
    const board = disc()
    place(board, mover, rival)
    game.state.board = board
    game.state.technologyDeck = stackedBag([])
    game.state.technologyDiscard = []
    game.state.tileSupply = stackedBag([])
    game.giveTechnology(mover, TechnologyEffectKind.DimensionalRift)
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])
    return { game, mover, rival }
}

const rift = (playerId: string, from: AxialCoordinates, to: AxialCoordinates) => ({
    type: ActionType.UseDimensionalRift as const,
    playerId,
    from,
    to
})

describe('the outer border', () => {
    it('is the ring facing off the map, and not the rim of an enclosed gap', () => {
        const border = borderHexes(disc())
        expect(border).toHaveLength(18)
        expect(has(border, at(3, 0))).toBe(true)
        expect(has(border, at(-3, 3))).toBe(true)
        expect(has(border, at(0, 0))).toBe(false)
        for (const beside of neighborsOf(at(1, 0))) expect(has(border, beside)).toBe(false)
    })
})

describe('Dimensional Rift', () => {
    it('carries a border piece to another empty border hex, where it counts as placed', () => {
        const { game, mover } = scenario((board, moverId) => {
            board.hexes[hexKey(at(3, 0))].piece = ship(moverId, PieceType.Station)
            board.hexes[hexKey(at(-2, 0))].piece = ship(moverId, PieceType.Station)
        })
        const before = game.state.players.find((p) => p.playerId === mover)!.score

        const used = game
            .run(UseDimensionalRift, rift(mover, at(3, 0), at(-3, 0)))
            .find(isUseDimensionalRift)

        expect(game.state.board.hexes[hexKey(at(3, 0))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(-3, 0))].piece?.type).toBe(PieceType.Station)
        // It arrived beside a friendly station: the pair scores as a placement would.
        expect(used?.metadata?.stationGroupPoints).toBeGreaterThan(0)
        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBeGreaterThan(before)
        expect(game.state.players.find((p) => p.playerId === mover)!.storedEffects).toEqual([])
    })

    it('needs both ends on the border, the far one empty', () => {
        const { game, mover } = scenario((board, moverId, rivalId) => {
            board.hexes[hexKey(at(3, 0))].piece = ship(moverId, PieceType.Station)
            board.hexes[hexKey(at(0, 0))].piece = ship(moverId, PieceType.Station)
            board.hexes[hexKey(at(-3, 0))].piece = ship(rivalId, PieceType.Station)
        })
        // A piece inside the map has no rift to take.
        expect(riftDestinationsFrom(game.state.board, at(0, 0))).toEqual([])
        const reach = riftDestinationsFrom(game.state.board, at(3, 0))
        expect(reach).toHaveLength(16)
        expect(has(reach, at(-3, 0))).toBe(false)
        expect(has(reach, at(2, 0))).toBe(false)

        expect(() => game.run(UseDimensionalRift, rift(mover, at(0, 0), at(0, 3)))).toThrow()
        expect(() => game.run(UseDimensionalRift, rift(mover, at(3, 0), at(-3, 0)))).toThrow()
        expect(() => game.run(UseDimensionalRift, rift(mover, at(3, 0), at(2, 0)))).toThrow()
        expect(() => game.run(UseDimensionalRift, rift(mover, at(-3, 0), at(0, 3)))).toThrow()
    })

    it('is not offered with no piece on the border', () => {
        const { game, mover } = scenario((board, moverId) => {
            board.hexes[hexKey(at(0, 0))].piece = ship(moverId, PieceType.Station)
        })
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseDimensionalRift)
    })
})
