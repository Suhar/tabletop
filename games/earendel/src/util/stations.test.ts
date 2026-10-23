import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { PieceLevel, type Piece, PieceType } from '../model/pieces.js'
import { hubMultiplier, stationGroupPoints } from './stations.js'
import { ActionType } from '../definition/actions.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { TestGame } from './testHarness.js'
import { bagOf } from './drawBags.js'

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
            [at(1, 0), { planet: PlanetColor.Periwinkle }],
            [at(2, 0), { ship: station('p1') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(2, 0))).toBe(1)
    })

    it('counts a station linked only by a wavy line', () => {
        // Three touching, and a fourth across a clear gap with a line to the end of the run.
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), { ship: station('p1') }],
            [at(2, 0), { ship: station('p1') }],
            [at(3, 0), {}],
            [at(4, 0), {}],
            [at(5, 0), { ship: station('p1') }]
        ])

        // Four in the complex, however it is entered.
        expect(stationGroupPoints(board, 'p1', at(5, 0))).toBe(4)
        expect(stationGroupPoints(board, 'p1', at(0, 0))).toBe(4)
    })

    it('links transitively, through adjacency and lines together', () => {
        // A touches B, B has a line to C, C touches D: one complex of four.
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), { ship: station('p1') }],
            [at(2, 0), {}],
            [at(3, 0), { ship: station('p1') }],
            [at(4, 0), { ship: station('p1') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(0, 0))).toBe(4)
    })

    it('is cut by anything standing in the line', () => {
        // The same layout with one enemy fighter parked in the gap: adjacency was already
        // broken, and now the line is too, so the far station stands alone.
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), { ship: station('p1') }],
            [at(2, 0), { ship: station('p1') }],
            [at(3, 0), { ship: ship('p2', PieceType.Fighter, PieceLevel.Two) }],
            [at(4, 0), {}],
            [at(5, 0), { ship: station('p1') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(5, 0))).toBe(1)
        expect(stationGroupPoints(board, 'p1', at(0, 0))).toBe(3)
    })

    it('does not link along a line to another player’s station', () => {
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), {}],
            [at(2, 0), { ship: station('p2') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(0, 0))).toBe(1)
        expect(stationGroupPoints(board, 'p2', at(2, 0))).toBe(1)
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

describe('Station Hub', () => {
    const hub = (playerId: string): Piece => ({
        id: `${playerId}-hub-${Math.random()}`,
        playerId,
        type: PieceType.Station,
        hub: true
    })

    it('doubles the complex it stands in', () => {
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), { ship: station('p1') }],
            [at(2, 0), { ship: hub('p1') }]
        ])

        // Three stations, doubled by the hub among them - whichever one is asked about.
        expect(stationGroupPoints(board, 'p1', at(2, 0))).toBe(6)
        expect(stationGroupPoints(board, 'p1', at(0, 0))).toBe(6)
    })

    it('is a station for everything else', () => {
        // Links by adjacency and by wavy line, and counts itself in the complex.
        const board = boardOf([
            [at(0, 0), { ship: hub('p1') }],
            [at(1, 0), {}],
            [at(2, 0), { ship: station('p1') }]
        ])

        expect(stationGroupPoints(board, 'p1', at(0, 0))).toBe(4)
    })

    it('leaves a complex it is not part of alone', () => {
        const board = boardOf([
            [at(0, 0), { ship: hub('p1') }],
            [at(1, 0), { ship: ship('p2', PieceType.Probe, PieceLevel.Two) }],
            [at(2, 0), { ship: station('p1') }],
            [at(3, 0), { ship: station('p1') }]
        ])

        // The probe breaks both kinds of link, so the far pair is an ordinary complex of two.
        expect(stationGroupPoints(board, 'p1', at(2, 0))).toBe(2)
        expect(stationGroupPoints(board, 'p1', at(0, 0))).toBe(2)
    })

    it('doubles again for a second hub in the same complex', () => {
        const board = boardOf([
            [at(0, 0), { ship: hub('p1') }],
            [at(1, 0), { ship: station('p1') }],
            [at(2, 0), { ship: hub('p1') }]
        ])

        // ASSUMED: each hub doubles, so two make it fourfold. See rules.md - the alternative is
        // one doubling however many are present.
        expect(hubMultiplier(board, 'p1', at(1, 0))).toBe(4)
        expect(stationGroupPoints(board, 'p1', at(1, 0))).toBe(12)
    })

    it('goes on paying for stations added later', () => {
        const game = new TestGame()
        const mover = game.activePlayerId

        game.state.board = boardOf([
            [at(0, 0), { ship: hub(mover) }],
            [at(1, 0), {}],
            [at(9, 9), {}]
        ])
        game.state.technologyDeck = bagOf([])
        game.stackBags((playerId) => [station(playerId), station(playerId)])

        const before = game.state.players.find((p) => p.playerId === mover)!.score

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        // A complex of two, doubled: the hub keeps paying long after it was placed.
        expect(game.state.players.find((p) => p.playerId === mover)!.score - before).toBe(4)
    })
})

describe('scoring stations in play', () => {
    it('pays the complex AND a chain when one station does both jobs', () => {
        // Two stations already linked by a wavy line, and two planets of one colour waiting to
        // be joined. The new station lands where it does both at once, and is paid under both
        // rules - they are separate rules, and a station is a ship like any other for chains.
        const game = new TestGame()
        const mover = game.activePlayerId

        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), {}],
            [at(2, 0), { ship: station(mover) }],
            [at(3, 0), { planet: PlanetColor.Periwinkle }],
            [at(2, -1), {}],
            [at(2, -2), { ship: station(mover) }],
            [at(9, 9), {}]
        ])
        game.state.technologyDeck = bagOf([])
        game.stackBags((playerId) => [station(playerId), station(playerId)])

        const scoreOf = () => game.state.players.find((p) => p.playerId === mover)!.score
        const before = scoreOf()

        const [placed] = game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        // 3 for a complex of three, and 3 more for a two-ship chain between the planets.
        expect((placed as PlacePiece).metadata?.stationGroupPoints).toBe(3)
        expect((placed as PlacePiece).metadata?.chains?.[0].points).toBe(3)
        expect(scoreOf() - before).toBe(6)
    })

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
        game.state.technologyDeck = bagOf([])
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
