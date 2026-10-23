import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { planetPointsByPlayer } from './scoring.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { TestGame } from './testHarness.js'
import { bagOf } from './drawBags.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

type Spec = { planet?: PlanetColor; explored?: boolean; ship?: [string, PieceType] }

function boardOf(spec: Array<[AxialCoordinates, Spec]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (const [coords, { planet, explored, ship }] of spec) {
        board.hexes[hexKey(coords)] = {
            coords,
            tileId: 't1',
            ...(planet
                ? { kind: HexKind.Planet, color: planet, ...(explored ? { explored } : {}) }
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

describe('planetPointsByPlayer', () => {
    it('pays a point for each planet a player controls', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }],
            [at(2, 0), { planet: PlanetColor.Teal }],
            [at(3, 0), { ship: ['p1', PieceType.Station] }]
        ])

        // (1,0) touches both planets, so p1 holds both.
        expect(planetPointsByPlayer(board)).toEqual({ p1: 2 })
    })

    it('pays every tied player in full', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: ['p1', PieceType.Station] }],
            [at(0, 1), { ship: ['p2', PieceType.Station] }]
        ])

        // One power each. Ties aren't broken, so the planet pays both.
        expect(planetPointsByPlayer(board)).toEqual({ p1: 1, p2: 1 })
    })

    it('pays a planet held only by a probe', () => {
        // A probe counts 1, so it both holds a planet and scores it - the point of raising it
        // from 0 was that a probe which explores a planet can go on to keep it.
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: ['p1', PieceType.Probe] }]
        ])

        expect(planetPointsByPlayer(board)).toEqual({ p1: 1 })
    })

    it('pays nobody for a planet nothing touches', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), {}]
        ])

        expect(planetPointsByPlayer(board)).toEqual({})
    })

    it('pays the same for an unexplored planet as an explored one', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle, explored: true }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }],
            [at(2, 0), { planet: PlanetColor.Teal }]
        ])

        expect(planetPointsByPlayer(board)).toEqual({ p1: 2 })
    })

    it('gives a stronger neighbour the planet outright', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }],
            [at(0, 1), { ship: ['p2', PieceType.Station] }]
        ])

        expect(planetPointsByPlayer(board)).toEqual({ p1: 1 })
    })
})

describe('planet points at the end of the game', () => {
    it('are added when the last piece is played, and decide the winner', () => {
        const game = new TestGame()
        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), {}],
            [at(9, 9), {}]
        ])
        game.state.technologyDeck = bagOf([])

        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId
        // One piece each: drawing it empties the mover's bag, so the game ends the moment
        // that piece is placed, before the other player ever gets a turn.
        game.stackBags((playerId) => [{ id: `${playerId}-a`, playerId, type: PieceType.Fighter }])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        expect(game.state.machineState).toBe(MachineState.EndOfGame)
        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBe(1)
        expect(game.state.players.find((p) => p.playerId === other)!.score).toBe(0)
        expect(game.state.winningPlayerIds).toEqual([mover])
    })
})
