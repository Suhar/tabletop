import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { PieceLevel, type Piece, PieceType } from '../model/pieces.js'
import { stationGroupPoints } from './stations.js'
import { ActionType } from '../definition/actions.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { TestGame } from './testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${Math.abs(level ?? 0)}-${Math.random()}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

type Spec = { planet?: PlanetColor; ship?: Piece }

function boardOf(spec: Array<[AxialCoordinates, Spec]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (const [coords, { planet, ship: piece }] of spec) {
        board.hexes[hexKey(coords)] = {
            coords,
            tileId: 't1',
            ...(planet
                ? { kind: HexKind.Planet, color: planet }
                : { kind: HexKind.Open, ...(piece ? { piece } : {}) })
        }
    }
    return board
}

const station = (playerId: string) => ship(playerId, PieceType.Station)

describe('stationGroupPoints', () => {
    it('pays 1 for a station standing on its own', () => {
        const board = boardOf([[at(0, 0), { ship: station('p1') }]])

        expect(stationGroupPoints(board, 'p1', at(0, 0))).toBe(1)
    })

    it('pays 1 for itself and 1 for each station already in the group', () => {
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), { ship: station('p1') }],
            [at(2, 0), { ship: station('p1') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(2, 0))).toBe(3)
    })

    it('counts a group that bends, not just a line', () => {
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), { ship: station('p1') }],
            [at(1, 1), { ship: station('p1') }],
            [at(0, 1), { ship: station('p1') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(0, 1))).toBe(4)
    })

    it('does not link through a probe or a fighter of the same player', () => {
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            // The player's own probe still breaks the run: stations link to stations only.
            [at(1, 0), { ship: ship('p1', PieceType.Probe, PieceLevel.Two) }],
            [at(2, 0), { ship: station('p1') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(2, 0))).toBe(1)
    })

    it('does not link through another player’s station', () => {
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), { ship: station('p2') }],
            [at(2, 0), { ship: station('p1') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(2, 0))).toBe(1)
    })

    it('does not link around a planet, which no ship can stand on', () => {
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), { planet: PlanetColor.Azure }],
            [at(2, 0), { ship: station('p1') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(2, 0))).toBe(1)
    })

    it('joins two separate clusters into one when the gap is filled', () => {
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), { ship: station('p1') }],
            [at(2, 0), { ship: station('p1') }],
            [at(3, 0), { ship: station('p1') }],
            [at(4, 0), { ship: station('p1') }]
        ])

        // The middle station sees the whole run, both sides at once.
        expect(stationGroupPoints(board, 'p1', at(2, 0))).toBe(5)
    })
})

describe('scoring stations in play', () => {
    it('pays 1, then 2, then 3 as a cluster grows', () => {
        const game = new TestGame()
        game.state.board = boardOf([
            [at(0, 0), {}],
            [at(1, 0), {}],
            [at(2, 0), {}],
            [at(7, 7), {}],
            [at(8, 8), {}],
            [at(9, 9), {}]
        ])
        game.state.technologyDeck = []
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station)
        ])

        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId
        const scoreOf = (playerId: string) =>
            game.state.players.find((p) => p.playerId === playerId)!.score

        const placeAt = (playerId: string, coords: AxialCoordinates) =>
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId,
                coords,
                pieceSource: PieceSource.Bag
            })

        const [first] = placeAt(mover, at(0, 0))
        expect((first as PlacePiece).metadata?.stationGroupPoints).toBe(1)
        expect(scoreOf(mover)).toBe(1)

        // The other player's stations are somewhere else entirely and never join the group.
        placeAt(other, at(7, 7))

        placeAt(mover, at(1, 0))
        expect(scoreOf(mover)).toBe(3)

        placeAt(other, at(8, 8))

        const [third] = placeAt(mover, at(2, 0))
        expect((third as PlacePiece).metadata?.stationGroupPoints).toBe(3)
        // 1 + 2 + 3: a cluster built one station at a time pays a triangular total.
        expect(scoreOf(mover)).toBe(6)

        // Theirs were placed apart, so each paid only for itself.
        expect(scoreOf(other)).toBe(2)
    })
})
