import { describe, expect, it } from 'vitest'
import { type EarendelBoard, HexKind, hexKey, PieceType, sightLines } from '@tabletop/earendel'
import { RELAY_HOP, relaySignal } from './relayPulses.js'

const at = (q: number) => ({ q, r: 0 })

// A row: Player 1's station, relay and station, with a rival ship between each.
function row(): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q <= 8; q++) {
        board.hexes[hexKey(at(q))] = { coords: at(q), tileId: 't', kind: HexKind.Open }
    }
    const put = (q: number, playerId: string, type: PieceType) => {
        board.hexes[hexKey(at(q))].piece = { id: `${type}-${q}`, playerId, type }
    }
    put(0, 'p1', PieceType.Station)
    put(2, 'p2', PieceType.Fighter)
    put(4, 'p1', PieceType.Relay)
    put(6, 'p2', PieceType.Probe)
    put(8, 'p1', PieceType.Station)
    return board
}

describe('relaySignal', () => {
    it('bursts from a station, runs to the relay, and bursts on to the other station', () => {
        const board = row()
        const { pulses, bursts } = relaySignal(board, sightLines(board))

        expect(pulses.map(({ from, to, delay }) => ({ from, to, delay }))).toEqual([
            { from: at(0), to: at(4), delay: 0 },
            { from: at(4), to: at(8), delay: RELAY_HOP }
        ])
        expect(bursts.map(({ at, delay }) => ({ at, delay }))).toEqual([
            { at: at(0), delay: 0 },
            { at: at(4), delay: RELAY_HOP }
        ])
    })
})
