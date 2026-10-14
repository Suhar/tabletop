import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameSession } from '@tabletop/frontend-components'
import { ActionBox, MachineState, RailroadId } from '@tabletop/south-african-railroads'
import {
    choose,
    disposeSessions,
    firstTurnTable,
    initialOfferingTable,
    openSessionOn
} from '$lib/testing/sessionHarness.js'
import type { SarGameSession } from './session.svelte.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

function spyOnActionUndo() {
    return vi.spyOn(GameSession.prototype, 'undo').mockResolvedValue()
}

function buildTable() {
    return choose(firstTurnTable(), ActionBox.ConstructTrack)
}

async function stageFirstLink(session: SarGameSession, railroadId: RailroadId) {
    const [[first]] = session.gameState.doubleBuilds(railroadId)
    await session.clickLink(first)
    expect(session.firstLink).toBe(first)
}

describe('building with a choice of railroads', () => {
    it('offers every funded railroad and stages nothing until one is picked', () => {
        const session = openSessionOn(buildTable())
        expect(session.gameState.machineState).toBe(MachineState.ConstructingTrack)
        expect(session.railroadChoices.toSorted()).toEqual(
            [RailroadId.CdFM, RailroadId.CMRC, RailroadId.CSAR].toSorted()
        )
        expect(session.selectedRailroad).toBeUndefined()
        expect(session.linkTargets).toEqual([])
        expect(session.hasManualSelection()).toBe(false)
    })

    it('Undo steps back through the first link, then the railroad, before undoing an action', async () => {
        const session = openSessionOn(buildTable())
        const actionUndo = spyOnActionUndo()
        session.selectRailroad(RailroadId.CSAR)
        await stageFirstLink(session, RailroadId.CSAR)

        await session.undo()
        expect(session.firstLink).toBeUndefined()
        expect(session.selectedRailroad).toBe(RailroadId.CSAR)
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(session.selectedRailroad).toBeUndefined()
        expect(session.hasManualSelection()).toBe(false)
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
    })

    it('picking another railroad clears the link staged for the first', async () => {
        const session = openSessionOn(buildTable())
        session.selectRailroad(RailroadId.CSAR)
        await stageFirstLink(session, RailroadId.CSAR)

        session.selectRailroad(RailroadId.CdFM)
        expect(session.selectedRailroad).toBe(RailroadId.CdFM)
        expect(session.firstLink).toBeUndefined()
    })

    it('ignores a railroad that is not on offer', () => {
        const session = openSessionOn(buildTable())
        session.selectRailroad(RailroadId.NRC)
        expect(session.selectedRailroad).toBeUndefined()
        expect(session.hasManualSelection()).toBe(false)
    })
})

describe('the auction view', () => {
    it('lists the seats in bidding order and the railroads still to be offered', () => {
        const session = openSessionOn(initialOfferingTable(1))
        const view = session.auctionView
        expect(view?.railroadId).toBe(RailroadId.CSAR)
        expect(view?.upcomingOfferings).toEqual([RailroadId.NRC, RailroadId.CTRD, RailroadId.CMRC])
        expect(view?.openerId).toBe('p1')
        expect(view?.seats.map((seat) => seat.playerId)).toEqual(['p1', 'p2', 'p3'])
        expect(view?.currentBidderId).toBe('p1')
        expect(view?.smallestBid).toBe(0)
    })

    it('has nothing to show outside an auction', () => {
        const session = openSessionOn(firstTurnTable())
        expect(session.auctionView).toBeUndefined()
    })
})
