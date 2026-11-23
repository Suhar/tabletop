import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, planetControl } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { PLANET_COLORS, PlanetColor } from '../model/planetColor.js'
import { TestGame } from '../testing/testHarness.js'
import { ActionType } from '../definition/actions.js'
import { DrawPieces } from '../actions/drawPieces.js'
import { salvageDestroyed } from './elevated.js'
import { probeBlockedBy } from './lineOfSight.js'
import { controlsEveryColor, payBounty, routePowersFor } from './routePowers.js'
import { refreshStanding } from './standing.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

type Spec = { planet?: PlanetColor; ship?: string; type?: PieceType }

function boardOf(spec: Array<[AxialCoordinates, Spec]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (const [coords, { planet, ship, type }] of spec) {
        const piece: Piece | undefined = ship
            ? {
                  id: `${ship}-${coords.q},${coords.r}`,
                  playerId: ship,
                  type: type ?? PieceType.Fighter
              }
            : undefined
        board.hexes[hexKey(coords)] = planet
            ? { coords, tileId: 't1', kind: HexKind.Planet, color: planet }
            : { coords, tileId: 't1', kind: HexKind.Open, ...(piece ? { piece } : {}) }
    }
    return board
}

function standing(board: EarendelBoard, playerCount = 2): HydratedEarendelGameState {
    const state = new TestGame(playerCount).hydrated
    state.board = board
    refreshStanding(state)
    return state
}

// Planets far apart along a row, each with one of p1's ships beside it.
const heldPlanets = (colors: PlanetColor[]): Array<[AxialCoordinates, Spec]> =>
    colors.flatMap((planet, index): Array<[AxialCoordinates, Spec]> => [
        [at(index * 4, 0), { planet }],
        [at(index * 4 + 1, 0), { ship: 'p1' }]
    ])

describe('route powers', () => {
    it('come from a standing trade route of that color', () => {
        const state = standing(
            boardOf([
                [at(0, 0), { planet: PlanetColor.Violet }],
                [at(1, 0), { ship: 'p1' }],
                [at(2, 0), { planet: PlanetColor.Violet }]
            ]),
            3
        )

        expect(routePowersFor(state, 'p1')).toEqual([PlanetColor.Violet])
        expect(routePowersFor(state, 'p2')).toEqual([])
    })

    it('go when the route is broken', () => {
        const state = standing(
            boardOf([
                [at(0, 0), { planet: PlanetColor.Violet }],
                [at(1, 0), { ship: 'p1' }],
                [at(2, 0), { planet: PlanetColor.Violet }]
            ]),
            3
        )
        state.board.hexes[hexKey(at(1, 0))].piece = undefined
        refreshStanding(state)

        expect(state.board.routePowers).toEqual({})
    })

    it('come from controlling three planets of a color, or two in a two-player game', () => {
        const two = heldPlanets([PlanetColor.Teal, PlanetColor.Teal])
        const three = heldPlanets([PlanetColor.Teal, PlanetColor.Teal, PlanetColor.Teal])

        expect(routePowersFor(standing(boardOf(two), 2), 'p1')).toEqual([PlanetColor.Teal])
        expect(routePowersFor(standing(boardOf(two), 3), 'p1')).toEqual([])
        expect(routePowersFor(standing(boardOf(three), 3), 'p1')).toEqual([PlanetColor.Teal])
    })

    it('know when a player controls a planet of every color', () => {
        expect(controlsEveryColor(standing(boardOf(heldPlanets(PLANET_COLORS))), 'p1')).toBe(true)
        expect(
            controlsEveryColor(standing(boardOf(heldPlanets(PLANET_COLORS.slice(1)))), 'p1')
        ).toBe(false)
    })
})

describe('the powers', () => {
    const withPower = (board: EarendelBoard, color: PlanetColor): EarendelBoard => ({
        ...board,
        routePowers: { p1: [color] }
    })

    it('Strongholds counts each station 2 toward control', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Aqua }],
            [at(1, 0), { ship: 'p1', type: PieceType.Station }],
            [at(-1, 0), { ship: 'p2', type: PieceType.Station }]
        ])

        expect(planetControl(board, at(0, 0)).controllingPlayerIds).toEqual(['p1', 'p2'])
        expect(
            planetControl(withPower(board, PlanetColor.Mint), at(0, 0)).controllingPlayerIds
        ).toEqual(['p1'])
    })

    it('Blockade Runners lets probes through a station blockade', () => {
        const board = boardOf([
            [at(-1, 0), { ship: 'p2', type: PieceType.Station }],
            [at(0, 0), {}],
            [at(1, 0), { ship: 'p2', type: PieceType.Station }]
        ])

        expect(probeBlockedBy(board, at(0, 0), 'p1')).toBe('p2')
        expect(probeBlockedBy(withPower(board, PlanetColor.Aqua), at(0, 0), 'p1')).toBeUndefined()
    })

    it('Bounty pays a point for each enemy piece destroyed', () => {
        const state = new TestGame().hydrated
        const enemy: Piece = { id: 'e', playerId: 'p2', type: PieceType.Probe }
        const own: Piece = { id: 'o', playerId: 'p1', type: PieceType.Station }

        expect(payBounty(state, 'p1', [enemy])).toBe(0)

        state.board = withPower(state.board, PlanetColor.Violet)
        expect(payBounty(state, 'p1', [enemy, enemy, own])).toBe(2)
        expect(state.getPlayerState('p1').score).toBe(2)
    })

    it('Reclamation returns a destroyed ship to its owner’s bag', () => {
        const state = new TestGame().hydrated
        const station: Piece = { id: 's', playerId: 'p1', type: PieceType.Station }
        const before = state.getPlayerState('p1').bag.remaining

        expect(salvageDestroyed(state, [{ piece: station, at: at(0, 0) }], 'p2')).toEqual([])

        state.board = withPower(state.board, PlanetColor.Teal)
        expect(salvageDestroyed(state, [{ piece: station, at: at(0, 0) }], 'p2')).toEqual([
            { piece: station, playerId: 'p1', reclaimed: true }
        ])
        expect(state.getPlayerState('p1').bag.remaining).toBe(before + 1)
    })
})

describe('controlling a planet of every color', () => {
    it('pays 2 points with the draw at the start of the turn', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        game.state.board = boardOf(
            PLANET_COLORS.flatMap((planet, index): Array<[AxialCoordinates, Spec]> => [
                [at(index * 4, 0), { planet }],
                [at(index * 4 + 1, 0), { ship: mover }],
                [at(index * 4 + 2, 0), {}]
            ])
        )

        const [drew] = game.run(DrawPieces, { type: ActionType.DrawPieces, playerId: mover })

        expect(game.state.players.find((player) => player.playerId === mover)?.score).toBe(2)
        expect(drew).toMatchObject({ metadata: { fiveColorPoints: 2 } })
    })
})
