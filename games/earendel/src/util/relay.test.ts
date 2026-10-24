import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { attackableTargets, AttackOutcome, attackOutcomeAt } from './attack.js'
import { relayedProbesOf, relayStationsOf } from './lineOfSight.js'

// A probe with a clear straight line to one of its own stations, at any distance, cannot be
// attacked (rules.md, Relay).

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})
const probe = (playerId: string) => ship(playerId, PieceType.Probe, PieceLevel.Two)
const station = (playerId: string) => ship(playerId, PieceType.Station)
const fighter = (playerId: string) => ship(playerId, PieceType.Fighter, PieceLevel.Three)

// A straight run of open hexes along r = 0, plus an open hex above the probe for the attacker.
function row(length: number, pieces: Array<[number, Piece]>, planetAt?: number): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q <= length; q++) {
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

function withAttacker(board: EarendelBoard, attacker = fighter('p2')): EarendelBoard {
    board.hexes[hexKey(at(0, -1))].piece = attacker
    return board
}

describe('relay', () => {
    it('protects a probe that sees its own station along a clear line, at any distance', () => {
        const board = withAttacker(
            row(9, [
                [0, probe('p1')],
                [9, station('p1')]
            ])
        )

        expect(relayStationsOf(board, at(0, 0))).toEqual([at(9, 0)])
        expect(relayedProbesOf(board, at(9, 0))).toEqual([at(0, 0)])
        expect(attackOutcomeAt(board, at(0, -1), at(0, 0))).toBeUndefined()
        expect(attackableTargets(board, at(0, -1), 'p2')).toEqual([])
    })

    it('protects a probe right beside its own station', () => {
        const board = withAttacker(
            row(1, [
                [0, probe('p1')],
                [1, station('p1')]
            ])
        )
        expect(attackOutcomeAt(board, at(0, -1), at(0, 0))).toBeUndefined()
    })

    it('is broken by any piece in between, of either side', () => {
        for (const blocker of [probe('p2'), fighter('p1')]) {
            const board = withAttacker(
                row(6, [
                    [0, probe('p1')],
                    [3, blocker],
                    [6, station('p1')]
                ])
            )
            expect(relayStationsOf(board, at(0, 0))).toEqual([])
            expect(attackOutcomeAt(board, at(0, -1), at(0, 0))).toBe(AttackOutcome.Destroyed)
        }
    })

    it('is broken by a planet in between', () => {
        const board = withAttacker(
            row(
                6,
                [
                    [0, probe('p1')],
                    [6, station('p1')]
                ],
                3
            )
        )
        expect(attackOutcomeAt(board, at(0, -1), at(0, 0))).toBe(AttackOutcome.Destroyed)
    })

    it('needs the probe’s own station, not a rival’s', () => {
        const board = withAttacker(
            row(4, [
                [0, probe('p1')],
                [4, station('p2')]
            ])
        )
        expect(attackOutcomeAt(board, at(0, -1), at(0, 0))).toBe(AttackOutcome.Destroyed)
    })

    it('protects only probes', () => {
        const board = withAttacker(
            row(4, [
                [0, ship('p1', PieceType.Fighter, PieceLevel.Two)],
                [4, station('p1')]
            ])
        )
        expect(relayStationsOf(board, at(0, 0))).toEqual([])
        expect(attackOutcomeAt(board, at(0, -1), at(0, 0))).toBe(AttackOutcome.Damaged)
    })
})
