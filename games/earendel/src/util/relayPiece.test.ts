import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType, powerOf } from '../model/pieces.js'
import { attackOutcome, attackOutcomeAt, AttackOutcome } from './attack.js'
import { probeBlockedBy, relayStationsOf } from './lineOfSight.js'
import { stationComplex, stationGroupPoints } from './stations.js'

// rules.md, Relay piece: a relay is a station for every line of sight rule, and only planets
// block its sight.

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// A straight run of open hexes along r = 0, plus an open hex above the start for an attacker.
function row(
    length: number,
    pieces: Array<[number, Piece]>,
    { planetAt, gapAt }: { planetAt?: number; gapAt?: number } = {}
): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q <= length; q++) {
        if (q === gapAt) continue
        const coords = at(q, 0)
        board.hexes[hexKey(coords)] =
            q === planetAt
                ? { coords, tileId: 't1', kind: HexKind.Planet, color: PlanetColor.Teal }
                : { coords, tileId: 't1', kind: HexKind.Open }
    }
    board.hexes[hexKey(at(0, -1))] = { coords: at(0, -1), tileId: 't1', kind: HexKind.Open }
    for (const [q, piece] of pieces) board.hexes[hexKey(at(q, 0))].piece = piece
    return board
}

const probe = (playerId: string) => ship(playerId, PieceType.Probe, PieceLevel.Two)
const station = (playerId: string) => ship(playerId, PieceType.Station)
const relay = (playerId: string) => ship(playerId, PieceType.Relay)
const fighter = (playerId: string) => ship(playerId, PieceType.Fighter, PieceLevel.Three)

describe('relay pieces', () => {
    it('protect a probe even with ships in the way', () => {
        const board = row(8, [
            [0, probe('p1')],
            [3, fighter('p2')],
            [5, station('p2')],
            [8, relay('p1')]
        ])
        board.hexes[hexKey(at(0, -1))].piece = fighter('p2')

        expect(relayStationsOf(board, at(0, 0))).toEqual([at(8, 0)])
        expect(attackOutcomeAt(board, at(0, -1), at(0, 0))).toBeUndefined()
    })

    it('are blocked by a planet, and by a gap in the board', () => {
        for (const blocker of [{ planetAt: 4 }, { gapAt: 4 }]) {
            const board = row(
                8,
                [
                    [0, probe('p1')],
                    [8, relay('p1')]
                ],
                blocker
            )
            board.hexes[hexKey(at(0, -1))].piece = fighter('p2')
            expect(relayStationsOf(board, at(0, 0))).toEqual([])
            expect(attackOutcomeAt(board, at(0, -1), at(0, 0))).toBe(AttackOutcome.Destroyed)
        }
    })

    it('leave a station that only sees past a ship to another station unprotected', () => {
        const board = row(6, [
            [0, probe('p1')],
            [3, fighter('p2')],
            [6, station('p1')]
        ])
        expect(relayStationsOf(board, at(0, 0))).toEqual([])
    })

    it('link stations into one complex through ships, scoring only the stations', () => {
        const board = row(8, [
            [0, station('p1')],
            [2, fighter('p2')],
            [4, relay('p1')],
            [6, probe('p2')],
            [8, station('p1')]
        ])

        expect(stationComplex(board, 'p1', at(0, 0))).toEqual([at(0, 0), at(8, 0)])
        expect(stationGroupPoints(board, 'p1', at(0, 0))).toBe(2)
    })

    it('close the hexes between them and a station to rival probes, through ships', () => {
        const board = row(8, [
            [0, station('p2')],
            [4, fighter('p1')],
            [8, relay('p2')]
        ])

        // (2, 0) lies between p2's station and relay; the fighter beyond does not break the line.
        expect(probeBlockedBy(board, at(2, 0), 'p1')).toBe('p2')
        expect(probeBlockedBy(board, at(2, 0), 'p2')).toBeUndefined()
    })

    it('count 1 toward control and cannot be attacked', () => {
        expect(powerOf(relay('p1'))).toBe(1)
        expect(attackOutcome(fighter('p2'), relay('p1'))).toBeUndefined()
    })
})
