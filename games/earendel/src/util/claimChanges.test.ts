import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { ActionType } from '../definition/actions.js'
import { isPlacePiece, PieceSource, PlacePiece } from '../actions/placePiece.js'
import { TestGame, stackedBag } from './testHarness.js'

// A placement that changes who leads a claimed planet records it, so the history can say so.

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const probe = (playerId: string): Piece => ({
    id: `${playerId}-probe-${ids++}`,
    playerId,
    type: PieceType.Probe,
    level: PieceLevel.Two
})

// An explored Teal planet at (0, 0) holding tech-3, with open space all round it.
function scenario(pieces: Array<[AxialCoordinates, (mover: string, other: string) => Piece]>) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board: EarendelBoard = { hexes: {} }
    for (let q = -2; q <= 2; q++) {
        for (let r = -2; r <= 2; r++) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    board.hexes[hexKey(at(0, 0))] = {
        coords: at(0, 0),
        tileId: 't1',
        kind: HexKind.Planet,
        color: PlanetColor.Teal,
        explored: true,
        technologyId: 'tech-3'
    }
    for (const [coords, make] of pieces) board.hexes[hexKey(coords)].piece = make(mover, other)
    game.state.board = board
    game.state.technologyDeck = stackedBag([])
    game.state.tileSupply = stackedBag([])
    game.stackBags((playerId) => [probe(playerId), probe(playerId), probe(playerId)])

    const placeProbe = (coords: AxialCoordinates) =>
        game
            .run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: mover,
                coords,
                pieceSource: PieceSource.Bag
            })
            .find(isPlacePiece)

    return { game, mover, other, placeProbe }
}

describe('claim changes in the history', () => {
    it('records a claim a placement breaks', () => {
        const { game, other, placeProbe } = scenario([[at(1, 0), (_mover, other) => probe(other)]])
        game.state.probeClaims = [{ playerId: other, coords: at(0, 0), technologyId: 'tech-3' }]

        // Drawing level with the claimant's probe means they no longer lead.
        const placed = placeProbe(at(0, 1))

        expect(placed?.metadata?.claimsBroken).toEqual([
            { playerId: other, coords: at(0, 0), technologyId: 'tech-3', color: PlanetColor.Teal }
        ])
        expect(placed?.metadata?.claimsRestored).toBeUndefined()
    })

    it('records a claim a placement restores', () => {
        const { game, mover, placeProbe } = scenario([
            [at(1, 0), (mover) => probe(mover)],
            [at(0, -1), (_mover, other) => probe(other)]
        ])
        game.state.probeClaims = [{ playerId: mover, coords: at(0, 0), technologyId: 'tech-3' }]

        // Tied, the claim would lapse; a second probe takes the lead back.
        const placed = placeProbe(at(0, 1))

        expect(placed?.metadata?.claimsRestored).toEqual([
            { playerId: mover, coords: at(0, 0), technologyId: 'tech-3', color: PlanetColor.Teal }
        ])
        expect(placed?.metadata?.claimsBroken).toBeUndefined()
    })

    it('records nothing when no claim changes hands', () => {
        const { game, other, placeProbe } = scenario([[at(1, 0), (_mover, other) => probe(other)]])
        game.state.probeClaims = [{ playerId: other, coords: at(0, 0), technologyId: 'tech-3' }]

        const placed = placeProbe(at(2, 2))

        expect(placed?.metadata?.claimsBroken).toBeUndefined()
        expect(placed?.metadata?.claimsRestored).toBeUndefined()
    })
})
