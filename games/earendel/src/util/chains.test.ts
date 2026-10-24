import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { chainsCompletedBy, planetPairKey, triangular } from './chains.js'
import { ActionType } from '../definition/actions.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { TestGame, stackedBag } from './testHarness.js'

// Hexes are axial with neighbours at (±1,0), (0,±1), (1,-1), (-1,1), so stepping q by one
// walks a straight line - which is all these layouts need.
const at = (q: number, r: number): AxialCoordinates => ({ q, r })

type Spec = { planet?: PlanetColor; ship?: string }

// A board written out hex by hex: `planet` makes it a planet of that colour, `ship` puts that
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

describe('triangular', () => {
    it('pays a longer chain far more than a short one', () => {
        expect([1, 2, 3, 4, 5].map(triangular)).toEqual([1, 3, 6, 10, 15])
    })
})

describe('chainsCompletedBy', () => {
    it('scores a single ship that touches two planets of one colour', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }]
        ])

        const chains = chainsCompletedBy(board, 'p1', at(1, 0), [])

        expect(chains).toHaveLength(1)
        expect(chains[0].length).toBe(1)
        expect(chains[0].points).toBe(1)
        expect(chains[0].color).toBe(PlanetColor.Periwinkle)
    })

    it('counts the ships between the planets and not the planets themselves', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { ship: 'p1' }],
            [at(3, 0), { planet: PlanetColor.Periwinkle }]
        ])

        const chains = chainsCompletedBy(board, 'p1', at(2, 0), [])

        expect(chains[0].length).toBe(2)
        expect(chains[0].points).toBe(3)
    })

    it('ignores planets of different colours', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { planet: PlanetColor.Teal }]
        ])

        expect(chainsCompletedBy(board, 'p1', at(1, 0), [])).toEqual([])
    })

    it('measures the shortest run when the ships bunch up', () => {
        // A direct link at (1,0) plus a longer loop around the top. The pair is worth what
        // the short route says, not what the scenic one does.
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, -1), { ship: 'p1' }],
            [at(2, -1), { ship: 'p1' }]
        ])

        const chains = chainsCompletedBy(board, 'p1', at(1, 0), [])

        expect(chains).toHaveLength(1)
        expect(chains[0].length).toBe(1)
    })

    it('cannot route a chain through a planet', () => {
        // A third planet sits directly between the two Periwinkle ones, so the chain has to go
        // around it - planets are walls, since no ship can ever stand on one.
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { planet: PlanetColor.Mint }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, -1), { ship: 'p1' }],
            [at(2, -1), { ship: 'p1' }]
        ])

        const chains = chainsCompletedBy(board, 'p1', at(2, -1), [])

        expect(chains).toHaveLength(1)
        expect(chains[0].length).toBe(2)
        expect(chains[0].points).toBe(3)
    })

    it('does not run a chain through another player’s ships', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { ship: 'p2' }],
            [at(3, 0), { planet: PlanetColor.Periwinkle }]
        ])

        expect(chainsCompletedBy(board, 'p1', at(1, 0), [])).toEqual([])
        expect(chainsCompletedBy(board, 'p2', at(2, 0), [])).toEqual([])
    })

    it('scores every pair a placement joins at once', () => {
        // One ship touching three Periwinkle planets joins three pairs, not one.
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 1), { planet: PlanetColor.Periwinkle }]
        ])

        const chains = chainsCompletedBy(board, 'p1', at(1, 0), [])

        expect(chains).toHaveLength(3)
        expect(chains.every((chain) => chain.points === 1)).toBe(true)
    })

    it('never pays for a pair of planets that has already been joined', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: 'p1' }],
            [at(2, 0), { planet: PlanetColor.Periwinkle }]
        ])

        const spent = [planetPairKey(at(0, 0), at(2, 0))]
        expect(chainsCompletedBy(board, 'p1', at(1, 0), spent)).toEqual([])
    })

    it('names a pair the same way whichever planet is reached first', () => {
        expect(planetPairKey(at(0, 0), at(2, 0))).toBe(planetPairKey(at(2, 0), at(0, 0)))
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
        // A spare piece each, so no bag runs out and ends the game - planets pay out at the
        // end, and this test is about what the chain paid.
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

        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBe(3)
        expect(game.state.players.find((p) => p.playerId === other)!.score).toBe(0)
        expect((completing as PlacePiece).metadata).toMatchObject({
            chains: [{ length: 2, points: 3, color: PlanetColor.Periwinkle }]
        })
        expect(
            game.state.tradeRoutes.map((route) => [planetPairKey(...route.planets), route.playerId])
        ).toEqual([[planetPairKey(at(0, 0), at(3, 0)), mover]])
    })
})
