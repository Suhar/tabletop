import { describe, expect, it } from 'vitest'
import type { OffsetCoordinates } from '@tabletop/common'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { isChooseRoute } from '../actions/chooseRoute.js'
import { isPayRevenue } from '../actions/payRevenue.js'
import { StationLetter } from '../components/tiles.js'
import { Grid, type PlacedStation } from '../model/board.js'
import { startTestGame } from '../testing/table.js'

// Designer ruling, 2026-11-25: p0's D sits between p1's A and p2's A, one step away each. Both
// routes pass two stations, one of them p0's own, so only the toll differs.
const LetterIndex: Record<StationLetter, number> = { A: 0, B: 1, C: 2, D: 3 }

function station(
    letter: StationLetter,
    cell: OffsetCoordinates,
    options: Partial<PlacedStation> = {}
): PlacedStation {
    return {
        cell,
        tileId: LetterIndex[letter] * 16 + 1,
        rotation: 0,
        faceUp: true,
        cubes: 0,
        ...options
    }
}

const cross = [
    station(StationLetter.A, { col: 0, row: -1 }),
    station(StationLetter.B, { col: 1, row: 0 }),
    station(StationLetter.C, { col: 0, row: 1 }),
    station(StationLetter.D, { col: -1, row: 0 })
]

function tie(eastOwner = 'p1', southOwner = 'p2'): PlacedStation[] {
    return [
        ...cross,
        {
            ...station(StationLetter.D, { col: 2, row: -2 }, { ownerId: 'p0', cubes: 1 }),
            tileId: 49
        },
        {
            ...station(StationLetter.A, { col: 3, row: -2 }, { ownerId: eastOwner, cubes: 1 }),
            tileId: 3
        },
        {
            ...station(StationLetter.A, { col: 2, row: -1 }, { ownerId: southOwner, cubes: 1 }),
            tileId: 5
        }
    ]
}

function stateWith(stations: PlacedStation[]) {
    const session = startTestGame(3)
    session.edit((draft) => {
        draft.board.stations = stations
    })
    return session
}

describe('route choices', () => {
    it('finds every equally good route, not one per destination', () => {
        const routes = new Grid({ stations: tie() }).bestRoutes({ col: 2, row: -2 })
        expect(routes.map((route) => route.cells.at(-1))).toEqual([
            { col: 3, row: -2 },
            { col: 2, row: -1 }
        ])
        expect(new Set(routes.map((route) => route.stations))).toEqual(new Set([2]))
    })

    it('lets the owner choose when tied routes would pay tolls to different players', () => {
        const state = stateWith(tie()).hydrated()
        const choices = state.findRouteChoices()
        expect(choices).toHaveLength(1)
        expect(choices[0].playerId).toBe('p0')
        expect(choices[0].options.map((option) => option.tolls)).toEqual([['p1'], ['p2']])
    })

    it('offers no choice when every tied route pays the same players', () => {
        const state = stateWith(tie('p1', 'p1')).hydrated()
        expect(state.findRouteChoices()).toEqual([])
    })

    it('pays the chosen route’s toll, then carries on to revenue', () => {
        const session = stateWith(tie())
        const choices = session.hydrated().findRouteChoices()
        session.edit((draft) => {
            draft.machineState = MachineState.ChoosingRoutes
            draft.routeChoices = choices
            draft.activePlayerIds = ['p0']
        })
        const south = choices[0].options.findIndex((option) => option.tolls[0] === 'p2')
        const processed = session.chooseRoute(south, 'p0')
        const revenue = processed
            .find(isPayRevenue)
            ?.metadata?.revenues.find((paid) => paid.playerId === 'p0')
        expect(revenue?.route.at(-1)).toEqual({ col: 2, row: -1 })
        expect(revenue?.tolls).toEqual([{ playerId: 'p2', amount: 1 }])
        expect(session.state.machineState).not.toBe(MachineState.ChoosingRoutes)
        expect(session.state.routeChoices).toBeUndefined()
    })

    it('accepts only the route being chosen, from its owner', () => {
        const session = stateWith(tie())
        const choices = session.hydrated().findRouteChoices()
        session.edit((draft) => {
            draft.machineState = MachineState.ChoosingRoutes
            draft.routeChoices = choices
            draft.activePlayerIds = ['p0']
        })
        expect(() => session.chooseRoute(0, 'p1')).toThrow()
        // A route the choice does not offer: the station's own cell alone.
        expect(() =>
            session.act('p0', ActionType.ChooseRoute, {
                tileId: choices[0].tileId,
                route: [{ col: 2, row: -2 }]
            })
        ).toThrow()
        // The chosen route is recorded by its cells, not its place among the options.
        session.chooseRoute(1, 'p0')
        const chosen = session.actions.find(isChooseRoute)
        expect(chosen).toMatchObject({ route: choices[0].options[1].cells })
    })
})
