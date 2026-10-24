import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { hexesClosedToProbesOf, probeBlockedBy, sightLines } from './lineOfSight.js'
import { ActionType } from '../definition/actions.js'
import { PieceSource, PlacePiece, HydratedPlacePiece } from '../actions/placePiece.js'
import { TestGame, stackedBag } from './testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${level ?? ''}-${coordsCounter++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})
let coordsCounter = 0

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

// A straight run of open hexes from (0,0) to (length,0), with whatever is specified on top.
function line(length: number, pieces: Array<[number, Piece]> = []): EarendelBoard {
    const spec: Array<[AxialCoordinates, Spec]> = []
    for (let q = 0; q <= length; q++) {
        const piece = pieces.find(([index]) => index === q)?.[1]
        spec.push([at(q, 0), piece ? { ship: piece } : {}])
    }
    return boardOf(spec)
}

describe('probeBlockedBy', () => {
    it('closes the space between two of one player’s stations', () => {
        const board = line(3, [
            [0, station('p1')],
            [3, station('p1')]
        ])

        expect(probeBlockedBy(board, at(1, 0), 'p2')).toBe('p1')
        expect(probeBlockedBy(board, at(2, 0), 'p2')).toBe('p1')
    })

    it('leaves the owner’s own probes free to enter', () => {
        const board = line(3, [
            [0, station('p1')],
            [3, station('p1')]
        ])

        expect(probeBlockedBy(board, at(1, 0), 'p1')).toBeUndefined()
    })

    it('needs both ends to belong to the same player', () => {
        const board = line(3, [
            [0, station('p1')],
            [3, station('p2')]
        ])

        expect(probeBlockedBy(board, at(1, 0), 'p3')).toBeUndefined()
    })

    it('needs both ends to be stations', () => {
        const board = line(3, [
            [0, station('p1')],
            [3, ship('p1', PieceType.Fighter, PieceLevel.Three)]
        ])

        expect(probeBlockedBy(board, at(1, 0), 'p2')).toBeUndefined()
    })

    it('is broken by anything standing in the way', () => {
        // Exactly the counter-play: an opponent drops a non-probe into the corridor.
        const board = line(4, [
            [0, station('p1')],
            [2, ship('p2', PieceType.Fighter, PieceLevel.Two)],
            [4, station('p1')]
        ])

        expect(probeBlockedBy(board, at(1, 0), 'p2')).toBeUndefined()
        expect(probeBlockedBy(board, at(3, 0), 'p2')).toBeUndefined()
    })

    it('does not see past a planet', () => {
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(1, 0), {}],
            [at(2, 0), { planet: PlanetColor.Periwinkle }],
            [at(3, 0), {}],
            [at(4, 0), { ship: station('p1') }]
        ])

        expect(probeBlockedBy(board, at(1, 0), 'p2')).toBeUndefined()
        expect(probeBlockedBy(board, at(3, 0), 'p2')).toBeUndefined()
    })

    it('closes nothing between stations that are already touching', () => {
        const board = line(1, [
            [0, station('p1')],
            [1, station('p1')]
        ])

        expect(hexesClosedToProbesOf(board, 'p2')).toEqual([])
    })

    it('works on every axis, not just one', () => {
        // A vertical pair, along the (0,1) axis.
        const board = boardOf([
            [at(0, 0), { ship: station('p1') }],
            [at(0, 1), {}],
            [at(0, 2), { ship: station('p1') }]
        ])

        expect(probeBlockedBy(board, at(0, 1), 'p2')).toBe('p1')
    })
})

describe('sightLines', () => {
    it('reports each pair once, naming both ends', () => {
        const board = line(3, [
            [0, station('p1')],
            [3, station('p1')]
        ])

        const lines = sightLines(board)
        expect(lines).toHaveLength(1)
        expect(lines[0].playerId).toBe('p1')
        expect([lines[0].from, lines[0].to]).toEqual([at(0, 0), at(3, 0)])
    })

    it('reports nothing for touching stations, or for a broken line', () => {
        expect(
            sightLines(
                line(1, [
                    [0, station('p1')],
                    [1, station('p1')]
                ])
            )
        ).toEqual([])

        expect(
            sightLines(
                line(4, [
                    [0, station('p1')],
                    [2, ship('p2', PieceType.Probe, PieceLevel.Two)],
                    [4, station('p1')]
                ])
            )
        ).toEqual([])
    })
})

describe('the blockade in play', () => {
    it('refuses an opponent’s probe but takes any other piece', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        // Somewhere outside the corridor to stand, or the drawn probe has nowhere legal at all
        // and the game ends before the test can ask anything.
        const board = line(3, [
            [0, station(other)],
            [3, station(other)]
        ])
        board.hexes[hexKey(at(0, 4))] = { coords: at(0, 4), tileId: 't1', kind: HexKind.Open }
        game.state.board = board
        game.state.technologyDeck = stackedBag([])
        game.stackBags((playerId) => [ship(playerId, PieceType.Probe, PieceLevel.Two)])

        const probeAttempt = new HydratedPlacePiece({
            id: 'a1',
            gameId: game.game.id,
            source: ActionSource.User,
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })
        expect(probeAttempt.invalidPlacePieceReason(game.hydrated)).toBe(
            'Two enemy stations watch that space — no probe of yours can enter it.'
        )

        // A fighter walks straight in, and the corridor is theirs no longer.
        game.stackBags((playerId) => [ship(playerId, PieceType.Fighter, PieceLevel.Two)])
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        expect(game.state.board.hexes[hexKey(at(1, 0))].piece?.playerId).toBe(mover)
        expect(hexesClosedToProbesOf(game.state.board, mover)).toEqual([])
    })
})
