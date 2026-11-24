import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { chainLengthBetween, planetPairKey } from './chains.js'
import { routeChanges, settleTradeRoutes } from './tradeRoutes.js'
import { ActionType } from '../definition/actions.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'
import { EarendelGameStateValidator, HydratedEarendelGameState } from '../model/gameState.js'

// Hexes are axial with neighbors at (±1,0), (0,±1), (1,-1), (-1,1), so stepping q by one
// walks a straight line - which is all these layouts need.
const at = (q: number, r: number): AxialCoordinates => ({ q, r })

type Spec = { planet?: PlanetColor; ship?: string }

// A board written out hex by hex: `planet` makes it a planet of that color, `ship` puts that
// player's ship on open space, and a bare entry is empty open space.
function boardOf(spec: Array<[AxialCoordinates, Spec]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (const [coords, { planet, ship }] of spec) {
        board.hexes[hexKey(coords)] = {
            coords,
            tileId: 't1',
            ...(planet
                ? { kind: HexKind.Planet, color: planet }
                : {
                      kind: HexKind.Open,
                      ...(ship
                          ? {
                                piece: {
                                    id: `${ship}-${coords.q},${coords.r}`,
                                    playerId: ship,
                                    type: PieceType.Fighter
                                }
                            }
                          : {})
                  })
        }
    }
    return board
}

const PERIWINKLE_PAIR = [
    [at(0, 0), { planet: PlanetColor.Periwinkle }],
    [at(3, 0), { planet: PlanetColor.Periwinkle }]
] satisfies Array<[AxialCoordinates, Spec]>

describe('chainLengthBetween', () => {
    it('counts a single ship that touches both planets as a chain of one', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }]
        ])

        expect(chainLengthBetween(board, 'p1', at(0, 0), at(2, 0))).toBe(1)
    })

    it('counts the ships between the planets and not the planets themselves', () => {
        const board = boardOf([
            ...PERIWINKLE_PAIR,
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { ship: 'p1' }]
        ])

        expect(chainLengthBetween(board, 'p1', at(0, 0), at(3, 0))).toBe(2)
    })

    it('measures the shortest run when the ships bunch up', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, -1), { ship: 'p1' }],
            [at(2, -1), { ship: 'p1' }]
        ])

        expect(chainLengthBetween(board, 'p1', at(0, 0), at(2, 0))).toBe(1)
    })

    it('cannot route a chain through a planet', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { planet: PlanetColor.Mint }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, -1), { ship: 'p1' }],
            [at(2, -1), { ship: 'p1' }]
        ])

        expect(chainLengthBetween(board, 'p1', at(0, 0), at(2, 0))).toBe(2)
    })

    it('does not run a chain through another player’s ships', () => {
        const board = boardOf([
            ...PERIWINKLE_PAIR,
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { ship: 'p2' }]
        ])

        expect(chainLengthBetween(board, 'p1', at(0, 0), at(3, 0))).toBeUndefined()
        expect(chainLengthBetween(board, 'p2', at(0, 0), at(3, 0))).toBeUndefined()
    })

    it('names a pair the same way whichever planet is reached first', () => {
        expect(planetPairKey(at(0, 0), at(2, 0))).toBe(planetPairKey(at(2, 0), at(0, 0)))
    })
})

describe('settleTradeRoutes', () => {
    // Two rows of open space between the same two planets, so two players can each chain them.
    const twoLanes = (top: Spec[], bottom: Spec[]): EarendelBoard =>
        boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), top[0]],
            [at(1, -1), bottom[0]],
            [at(2, -1), bottom[1]]
        ])
    const scoreOf = (game: HydratedEarendelGameState, playerId: string) =>
        game.getPlayerState(playerId).score
    const holders = (game: HydratedEarendelGameState) =>
        game.tradeRoutes.map((route) => route.playerId)

    function settled(board: EarendelBoard): HydratedEarendelGameState {
        const game = new TestGame().hydrated
        game.board = board
        settleTradeRoutes(game)
        return game
    }

    it('gives the pair to the only player with a chain and pays its length', () => {
        const game = settled(twoLanes([{}], [{ ship: 'p1' }, { ship: 'p1' }]))

        expect(holders(game)).toEqual(['p1'])
        expect(game.tradeRoutes[0]).toMatchObject({
            color: PlanetColor.Periwinkle,
            length: 2,
            points: 2
        })
        expect(scoreOf(game, 'p1')).toBe(2)
    })

    it('ignores planets of different colors', () => {
        const game = settled(
            boardOf([
                [at(0, 0), { planet: PlanetColor.Periwinkle }],
                [at(1, 0), { ship: 'p1' }],
                [at(2, 0), { planet: PlanetColor.Teal }]
            ])
        )

        expect(game.tradeRoutes).toEqual([])
    })

    it('sets up every pair one ship joins', () => {
        const game = settled(
            boardOf([
                [at(0, 0), { planet: PlanetColor.Periwinkle }],
                [at(1, 0), { ship: 'p1' }],
                [at(2, 0), { planet: PlanetColor.Periwinkle }],
                [at(1, 1), { planet: PlanetColor.Periwinkle }]
            ])
        )

        expect(game.tradeRoutes).toHaveLength(3)
        expect(scoreOf(game, 'p1')).toBe(3)
    })

    it('pays nothing to a rival who chains a pair that has a route', () => {
        const game = settled(twoLanes([{ ship: 'p1' }], [{}, {}]))
        game.board = twoLanes([{ ship: 'p1' }], [{ ship: 'p2' }, { ship: 'p2' }])
        settleTradeRoutes(game)

        expect(holders(game)).toEqual(['p1'])
        expect(scoreOf(game, 'p2')).toBe(0)
    })

    it('hands a broken route to the rival whose chain is the only one standing', () => {
        const game = settled(twoLanes([{ ship: 'p1' }], [{}, {}]))
        game.board = twoLanes([{ ship: 'p1' }], [{ ship: 'p2' }, { ship: 'p2' }])
        settleTradeRoutes(game)
        const before = [...game.tradeRoutes]

        game.board = twoLanes([{}], [{ ship: 'p2' }, { ship: 'p2' }])
        settleTradeRoutes(game)

        expect(holders(game)).toEqual(['p2'])
        expect(scoreOf(game, 'p2')).toBe(2)
        const changes = routeChanges(before, game)
        expect(changes.routesBroken?.map((route) => route.playerId)).toEqual(['p1'])
        expect(changes.routesEstablished?.map((route) => route.playerId)).toEqual(['p2'])
    })

    it('leaves a pair with no route while two players both chain it', () => {
        const game = new TestGame().hydrated
        game.board = twoLanes([{ ship: 'p1' }], [{ ship: 'p2' }, { ship: 'p2' }])
        settleTradeRoutes(game)

        expect(game.tradeRoutes).toEqual([])

        game.board = twoLanes([{ ship: 'p1' }], [{ ship: 'p2' }, {}])
        settleTradeRoutes(game)

        expect(holders(game)).toEqual(['p1'])
        expect(scoreOf(game, 'p1')).toBe(1)
    })

    it('pays the same player again for re-forming their own route', () => {
        const game = settled(twoLanes([{ ship: 'p1' }], [{}, {}]))
        game.board = twoLanes([{}], [{}, {}])
        settleTradeRoutes(game)
        expect(game.tradeRoutes).toEqual([])

        game.board = twoLanes([{ ship: 'p1' }], [{}, {}])
        settleTradeRoutes(game)

        expect(holders(game)).toEqual(['p1'])
        expect(scoreOf(game, 'p1')).toBe(2)
    })

    it('ends a route when one of its planets changes color', () => {
        const game = settled(twoLanes([{ ship: 'p1' }], [{}, {}]))
        game.board.hexes[hexKey(at(2, 0))].color = PlanetColor.Teal
        settleTradeRoutes(game)

        expect(game.tradeRoutes).toEqual([])
    })

    it('sets up an unpaid route for the opening station', () => {
        const game = new TestGame().hydrated
        game.board = twoLanes([{ ship: 'p1' }], [{}, {}])
        settleTradeRoutes(game, { unpaid: true })

        expect(holders(game)).toEqual(['p1'])
        expect(scoreOf(game, 'p1')).toBe(0)
    })
})
describe('scoring a chain in play', () => {
    it('pays the placing player and says so in the history', () => {
        const game = new TestGame()
        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), {}],
            [at(2, 0), {}],
            [at(3, 0), { planet: PlanetColor.Periwinkle }],
            // Spare space well clear of the planets, so filling the board doesn't end the
            // game before the chain is paid.
            [at(9, 9), {}],
            [at(8, 8), {}],
            [at(7, 7), {}]
        ])
        game.state.technologyDeck = stackedBag([])
        // A spare piece each, so no bag runs out and ends the game.
        game.stackBags((playerId) =>
            ['a', 'b', 'c'].map((suffix) => ({
                id: `${playerId}-${suffix}`,
                playerId,
                type: PieceType.Fighter
            }))
        )

        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        // Half a chain is worth nothing.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })
        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBe(0)

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: other,
            coords: at(9, 9),
            pieceSource: PieceSource.Bag
        })

        const [completing] = game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(2, 0),
            pieceSource: PieceSource.Bag
        })

        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBe(2)
        expect(game.state.players.find((p) => p.playerId === other)!.score).toBe(0)
        expect((completing as PlacePiece).metadata).toMatchObject({
            routesEstablished: [{ length: 2, points: 2, color: PlanetColor.Periwinkle }]
        })
        expect(
            game.state.tradeRoutes.map((route) => [planetPairKey(...route.planets), route.playerId])
        ).toEqual([[planetPairKey(at(0, 0), at(3, 0)), mover]])
    })
})

describe('a game stored before routes could break', () => {
    it('still loads, with its routes brought up to date', () => {
        const { routesEstablished: _routesEstablished, ...stored } = new TestGame().state
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }]
        ])
        const state = {
            ...stored,
            board,
            tradeRoutes: [
                {
                    planets: [at(0, 0), at(2, 0)] satisfies [AxialCoordinates, AxialCoordinates],
                    playerId: 'p1'
                }
            ]
        }

        expect(EarendelGameStateValidator.Check(state)).toBe(true)

        const hydrated = new HydratedEarendelGameState(state)
        settleTradeRoutes(hydrated)

        expect(hydrated.routesEstablished).toBe(0)
        expect(hydrated.tradeRoutes).toMatchObject([
            { playerId: 'p1', color: PlanetColor.Periwinkle, points: 0 }
        ])
        expect(hydrated.getPlayerState('p1').score).toBe(0)
    })
})
