import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { GameSession } from '@tabletop/frontend-components'
import { MachineState } from '@tabletop/conduit'
import { disposeSessions, firstPlacementTable, openSessionOn } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

async function openPlacement() {
    const session = await openSessionOn(firstPlacementTable())
    expect(session.gameState.machineState).toBe(MachineState.Placing)
    const option = session.placementOptions.find((candidate) => candidate.rotations.length > 1)
    if (!option) throw Error('Some cell offers more than one turn')
    return { session, option }
}

describe('staging a placement', () => {
    it('Undo steps back through the turn, then the cell, before undoing an action', async () => {
        const { session, option } = await openPlacement()
        const actionUndo = vi
            .spyOn(GameSession.prototype, 'undoCommittedAction')
            .mockResolvedValue()

        await session.chooseCell(option.cell)
        session.turnTile(1)
        flushSync()
        expect(session.chosenCell).toEqual(option.cell)
        expect(session.chosenRotation).toBe(option.rotations[1])

        await session.undo()
        flushSync()
        expect(session.chosenCell).toEqual(option.cell)
        expect(session.chosenRotation).toBe(option.rotations[0])
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        flushSync()
        expect(session.chosenCell).toBeUndefined()
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
    })

    it('turns the preview the way it was pressed, and the short way back on Undo', async () => {
        const { session, option } = await openPlacement()
        await session.chooseCell(option.cell)
        flushSync()
        const start = session.previewTurns
        expect(((start % 4) + 4) % 4).toBe(option.rotations[0])

        session.turnTile(-1)
        flushSync()
        const back = session.previewTurns
        expect(back).toBeLessThan(start)
        expect(((back % 4) + 4) % 4).toBe(session.chosenRotation)

        await session.undo()
        flushSync()
        expect(Math.abs(session.previewTurns - back)).toBeLessThanOrEqual(2)
        expect(((session.previewTurns % 4) + 4) % 4).toBe(option.rotations[0])
    })
})
