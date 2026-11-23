import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    type EarendelBoard,
    HexKind,
    hexKey,
    type Piece,
    PieceType
} from '@tabletop/earendel'
import { pieceMovesBetween, scoreSourcesOf, shotsOf } from './actionEffects.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })
const ship = (id: string, playerId = 'a'): Piece => ({ id, playerId, type: PieceType.Station })

function board(pieces: [AxialCoordinates, Piece][]): EarendelBoard {
    const result: EarendelBoard = { hexes: {} }
    for (let q = 0; q < 5; q++) {
        result.hexes[hexKey(at(q, 0))] = { coords: at(q, 0), tileId: 't', kind: HexKind.Open }
    }
    for (const [coords, piece] of pieces) result.hexes[hexKey(coords)].piece = piece
    return result
}

function action(fields: Record<string, unknown>): GameAction {
    return { id: 'x', gameId: 'g', source: ActionSource.User, playerId: 'a', type: '', ...fields }
}

describe('score sources', () => {
    it('reports a placement per source', () => {
        const placed = action({
            type: ActionType.PlacePiece,
            coords: at(1, 0),
            metadata: { stationGroupPoints: 3, chains: [{ color: 'aqua', length: 2, points: 4 }] }
        })
        expect(scoreSourcesOf(placed)).toEqual([
            { coords: at(1, 0), points: 3, caption: 'complex', playerId: 'a' },
            { coords: at(1, 0), points: 4, caption: 'chain', playerId: 'a' }
        ])
    })

    it('scores a feint at the hex the ship arrived on', () => {
        const feint = action({
            type: ActionType.UseTacticalFeint,
            from: at(1, 0),
            to: at(2, 0),
            metadata: { stationGroupPoints: 2 }
        })
        expect(scoreSourcesOf(feint).map((source) => source.coords)).toEqual([at(2, 0)])
    })
})

describe('shots', () => {
    it('ignores a declined shot and distinguishes a kill from damage', () => {
        expect(
            shotsOf(
                action({ type: ActionType.AttackPiece, metadata: { declined: true } }),
                board([])
            )
        ).toEqual([])
        expect(
            shotsOf(
                action({
                    type: ActionType.AttackPiece,
                    coords: at(1, 0),
                    metadata: { damaged: true }
                }),
                board([])
            )
        ).toEqual([{ coords: at(1, 0), destroyed: false }])
    })

    it('blasts each spread target that was hit', () => {
        const before = board([
            [at(1, 0), ship('p1', 'b')],
            [at(2, 0), ship('p2', 'b')]
        ])
        const spread = action({
            type: ActionType.AttackSpread,
            targets: [at(1, 0), at(2, 0)],
            metadata: { hits: [{ target: ship('p2', 'b'), damaged: true }] }
        })
        expect(shotsOf(spread, before)).toEqual([{ coords: at(2, 0), destroyed: false }])
    })
})

describe('piece moves', () => {
    it('finds pieces that changed hexes, both ends of a swap', () => {
        const before = board([
            [at(1, 0), ship('mine')],
            [at(2, 0), ship('theirs', 'b')],
            [at(4, 0), ship('still')]
        ])
        const after = board([
            [at(2, 0), ship('mine')],
            [at(1, 0), ship('theirs', 'b')],
            [at(4, 0), ship('still')]
        ])
        expect(pieceMovesBetween(before, after)).toEqual(
            expect.arrayContaining([
                { pieceId: 'mine', from: at(1, 0), to: at(2, 0) },
                { pieceId: 'theirs', from: at(2, 0), to: at(1, 0) }
            ])
        )
        expect(pieceMovesBetween(before, after)).toHaveLength(2)
    })

    it('does not count a new or removed piece as a move', () => {
        expect(
            pieceMovesBetween(board([[at(1, 0), ship('gone')]]), board([[at(2, 0), ship('new')]]))
        ).toEqual([])
    })
})
