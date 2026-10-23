import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { EarendelBoard, HexKind, hexKey, isOpenHex, neighborsOf, planetControl } from './board.js'
import { PieceType } from './pieces.js'

// A planet at the origin, with its six neighbours as open space - the smallest board that
// can exercise control.
function boardWithPlanetAtOrigin(): EarendelBoard {
    const origin: AxialCoordinates = { q: 0, r: 0 }
    const board: EarendelBoard = {
        hexes: {
            [hexKey(origin)]: { coords: origin, tileId: 't1', kind: HexKind.Planet }
        }
    }
    for (const coords of neighborsOf(origin)) {
        board.hexes[hexKey(coords)] = { coords, tileId: 't1', kind: HexKind.Open }
    }
    return board
}

function place(board: EarendelBoard, index: number, playerId: string, type: PieceType) {
    const coords = neighborsOf({ q: 0, r: 0 })[index]
    board.hexes[hexKey(coords)].piece = { id: `${playerId}-${index}`, playerId, type }
}

const ORIGIN: AxialCoordinates = { q: 0, r: 0 }

describe('planetControl', () => {
    it('leaves a planet unclaimed when nothing is next to it', () => {
        const control = planetControl(boardWithPlanetAtOrigin(), ORIGIN)

        expect(control.controllingPlayerIds).toEqual([])
        expect(control.power).toBe(0)
    })

    it('lets an unchallenged probe hold a planet on its own', () => {
        // A probe counts 1 toward control, so a lone probe holds the planet it stands beside for
        // scoring. (Its technology is a separate matter, settled by probe influence alone.)
        const board = boardWithPlanetAtOrigin()
        place(board, 0, 'p1', PieceType.Probe)
        place(board, 1, 'p1', PieceType.Probe)

        const control = planetControl(board, ORIGIN)

        expect(control.controllingPlayerIds).toEqual(['p1'])
        expect(control.powerByPlayerId).toEqual({ p1: 2 })
    })

    it('lets a probe tie a station, so neither player holds the planet', () => {
        // The other edge of counting probes: one point is enough to match a station, so the
        // cheapest piece in the game can deny a rival control without being able to take it.
        const board = boardWithPlanetAtOrigin()
        place(board, 0, 'p1', PieceType.Station)
        place(board, 1, 'p2', PieceType.Probe)

        const control = planetControl(board, ORIGIN)

        expect(control.powerByPlayerId).toEqual({ p1: 1, p2: 1 })
        expect(control.controllingPlayerIds).toEqual(['p1', 'p2'])
    })

    it('gives control to the most adjacent power', () => {
        const board = boardWithPlanetAtOrigin()
        place(board, 0, 'p1', PieceType.Fighter) // 2
        place(board, 1, 'p2', PieceType.Station) // 1
        place(board, 2, 'p2', PieceType.Probe) // 1

        const control = planetControl(board, ORIGIN)

        // p2's station and probe now add to 2 and match the fighter, where the probe used to
        // count nothing and leave the fighter ahead.
        expect(control.powerByPlayerId).toEqual({ p1: 2, p2: 2 })
        expect(control.controllingPlayerIds).toEqual(['p1', 'p2'])
        expect(control.power).toBe(2)
    })

    it('sums a player’s pieces around the planet', () => {
        const board = boardWithPlanetAtOrigin()
        place(board, 0, 'p1', PieceType.Station) // 1
        place(board, 1, 'p1', PieceType.Station) // 1
        place(board, 2, 'p2', PieceType.Fighter) // 2

        // 2 each - see the tie test below for what that means.
        expect(planetControl(board, ORIGIN).powerByPlayerId).toEqual({ p1: 2, p2: 2 })
    })

    it('leaves ties unbroken, with every tied player controlling it', () => {
        // Deliberate: a tie isn't resolved, and each tied player takes the full reward.
        const board = boardWithPlanetAtOrigin()
        place(board, 0, 'p1', PieceType.Fighter) // 2
        place(board, 1, 'p2', PieceType.Station) // 1
        place(board, 2, 'p2', PieceType.Station) // 1
        place(board, 3, 'p3', PieceType.Station) // 1

        const control = planetControl(board, ORIGIN)

        expect(control.power).toBe(2)
        expect(control.controllingPlayerIds.sort()).toEqual(['p1', 'p2'])
        expect(control.controllingPlayerIds).not.toContain('p3')
    })

    it('counts only the six touching hexes, not the whole board', () => {
        const board = boardWithPlanetAtOrigin()
        // Two hexes away - on the board, but not adjacent to the planet.
        const distant: AxialCoordinates = { q: 2, r: 0 }
        board.hexes[hexKey(distant)] = {
            coords: distant,
            tileId: 't2',
            kind: HexKind.Open,
            piece: { id: 'far', playerId: 'p1', type: PieceType.Fighter }
        }

        expect(planetControl(board, ORIGIN).controllingPlayerIds).toEqual([])
    })
})

describe('isOpenHex', () => {
    it('accepts an empty open hex', () => {
        expect(isOpenHex(boardWithPlanetAtOrigin(), neighborsOf(ORIGIN)[0])).toBe(true)
    })

    it('rejects a planet, an occupied hex, and a hex off the board', () => {
        const board = boardWithPlanetAtOrigin()
        place(board, 0, 'p1', PieceType.Probe)

        expect(isOpenHex(board, ORIGIN)).toBe(false) // planet
        expect(isOpenHex(board, neighborsOf(ORIGIN)[0])).toBe(false) // occupied
        expect(isOpenHex(board, { q: 9, r: 9 })).toBe(false) // not on the board
    })
})
