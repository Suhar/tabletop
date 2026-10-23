import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { attackableTargets } from './attack.js'
import { canWakeFighter, feintableShips, feintTargets, wakeableFighters } from './legality.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

function boardWith(pieces: [AxialCoordinates, Piece][]): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < 8; q++) {
        board.hexes[hexKey(at(q, 0))] = { coords: at(q, 0), tileId: 't1', kind: HexKind.Open }
    }
    for (const [coords, piece] of pieces) board.hexes[hexKey(coords)].piece = piece
    return board
}

describe('feint legality', () => {
    it('offers only enemy ships beside one of your own', () => {
        const board = boardWith([
            [at(1, 0), ship('a', PieceType.Station)],
            [at(2, 0), ship('b', PieceType.Probe)],
            [at(0, 0), ship('a', PieceType.Probe)],
            [at(5, 0), ship('a', PieceType.Fighter, PieceLevel.Two)]
        ])

        expect(feintTargets(board, at(1, 0), 'a')).toEqual([at(2, 0)])
        expect(feintTargets(board, at(0, 0), 'a')).toEqual([])
        expect(feintTargets(board, at(2, 0), 'a')).toEqual([])
        expect(feintableShips(board, 'a')).toEqual([at(1, 0)])
    })
})

describe('Updated Logistics legality', () => {
    it('wakes only your own fighters with something in reach', () => {
        const board = boardWith([
            [at(1, 0), ship('a', PieceType.Fighter, PieceLevel.Three)],
            [at(2, 0), ship('b', PieceType.Probe)],
            [at(5, 0), ship('a', PieceType.Fighter, PieceLevel.Three)],
            [at(3, 0), ship('a', PieceType.Station)]
        ])

        expect(attackableTargets(board, at(1, 0), 'a')).not.toEqual([])
        expect(canWakeFighter(board, at(1, 0), 'a')).toBe(true)
        expect(canWakeFighter(board, at(1, 0), 'b')).toBe(false)
        expect(canWakeFighter(board, at(5, 0), 'a')).toBe(false)
        expect(canWakeFighter(board, at(3, 0), 'a')).toBe(false)
        expect(wakeableFighters(board, 'a')).toEqual([at(1, 0)])
    })
})
