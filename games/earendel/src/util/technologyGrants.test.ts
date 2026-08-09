import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { technologiesGainedBy } from './technologyGrants.js'
import { ActionType } from '../definition/actions.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { TestGame } from './testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

type Spec = { planet?: PlanetColor; technologyId?: string; ship?: [string, PieceType] }

function boardOf(spec: Array<[AxialCoordinates, Spec]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (const [coords, { planet, technologyId, ship }] of spec) {
        board.hexes[hexKey(coords)] = {
            coords,
            tileId: 't1',
            ...(planet
                ? {
                      kind: HexKind.Planet,
                      color: planet,
                      ...(technologyId ? { technologyId, explored: true } : {})
                  }
                : {
                      kind: HexKind.Open,
                      ...(ship
                          ? {
                                piece: {
                                    id: `${ship[0]}-${coords.q},${coords.r}`,
                                    playerId: ship[0],
                                    type: ship[1]
                                }
                            }
                          : {})
                  })
        }
    }
    return board
}

describe('technologiesGainedBy', () => {
    it('hands over the technology of a planet the placement took control of', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }]
        ])

        expect(technologiesGainedBy(board, 'p1', at(1, 0), [])).toEqual(['tech-a'])
    })

    it('hands over nothing to a player who did not take control', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Station] }],
            [at(0, 1), { ship: ['p2', PieceType.Fighter] }]
        ])

        // p2 has the stronger ship, so p1 is beside the planet but doesn't hold it.
        expect(technologiesGainedBy(board, 'p1', at(1, 0), [])).toEqual([])
        expect(technologiesGainedBy(board, 'p2', at(0, 1), [])).toEqual(['tech-a'])
    })

    it('hands the same technology to both players when control is tied', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Station] }],
            [at(0, 1), { ship: ['p2', PieceType.Station] }]
        ])

        expect(technologiesGainedBy(board, 'p1', at(1, 0), [])).toEqual(['tech-a'])
        expect(technologiesGainedBy(board, 'p2', at(0, 1), [])).toEqual(['tech-a'])
    })

    it('never hands over the same technology twice', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }]
        ])

        expect(technologiesGainedBy(board, 'p1', at(1, 0), ['tech-a'])).toEqual([])
    })

    it('hands over nothing for a planet that has no technology', () => {
        const board = boardOf([
            // Unexplored, so nothing is housed there yet.
            [at(0, 0), { planet: PlanetColor.Azure }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }]
        ])

        expect(technologiesGainedBy(board, 'p1', at(1, 0), [])).toEqual([])
    })

    it('hands over every technology a single placement took control of', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }],
            [at(2, 0), { planet: PlanetColor.Gold, technologyId: 'tech-b' }]
        ])

        // Sorted because the order only reflects which way round the hex the scan walks.
        expect(technologiesGainedBy(board, 'p1', at(1, 0), []).sort()).toEqual([
            'tech-a',
            'tech-b'
        ])
    })
})

describe('holding a technology through the game', () => {
    it('keeps it after control is lost', () => {
        const game = new TestGame()
        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), {}],
            [at(0, 1), {}],
            [at(9, 9), {}]
        ])
        game.state.technologyDeck = []

        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId
        const bagOf = (playerId: string, types: PieceType[]) =>
            types.map((type, index) => ({ id: `${playerId}-${index}`, playerId, type }))

        game.state.players.find((p) => p.playerId === mover)!.bag = bagOf(mover, [
            PieceType.Station,
            PieceType.Station
        ])
        game.state.players.find((p) => p.playerId === other)!.bag = bagOf(other, [
            PieceType.Fighter,
            PieceType.Fighter
        ])

        const [taking] = game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        expect((taking as PlacePiece).metadata?.technologiesGained).toEqual(['tech-a'])
        expect(game.state.players.find((p) => p.playerId === mover)!.technologies).toEqual([
            'tech-a'
        ])

        // The other player's fighter outweighs the station and takes the planet.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: other,
            coords: at(0, 1),
            pieceSource: PieceSource.Bag
        })

        expect(game.state.players.find((p) => p.playerId === other)!.technologies).toEqual([
            'tech-a'
        ])
        // Losing the planet does not take the technology back.
        expect(game.state.players.find((p) => p.playerId === mover)!.technologies).toEqual([
            'tech-a'
        ])
    })
})
