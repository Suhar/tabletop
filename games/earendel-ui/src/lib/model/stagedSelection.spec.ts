import { describe, expect, it, vi } from 'vitest'
import { setStagedSelectionValue, undoableStagedSelection } from '@tabletop/frontend-components'
import {
    EarendelStageOrder,
    hasManualEarendelSelection,
    popEarendelSelection,
    Power,
    setEarendelSelection,
    toggleEarendelTarget,
    undoSelectionOrAction,
    type EarendelSelection,
    type EarendelSelectionValues
} from './stagedSelection.js'

const at = (q: number, r: number) => ({ q, r })

function contextualUndo(initial: EarendelSelection) {
    let selection = initial
    const staged = undoableStagedSelection<EarendelSelectionValues>(
        EarendelStageOrder,
        () => selection,
        (next) => {
            selection = next
        }
    )
    const undoAction = vi.fn(async () => {})
    return {
        undoAction,
        press: () => undoSelectionOrAction(staged, undoAction),
        get selection() {
            return selection
        }
    }
}

describe('Earendel staged selection', () => {
    it('clears every later stage when a stage is set', () => {
        let selection: EarendelSelection = {}
        selection = setEarendelSelection(selection, 'piece', { source: 'held', pieceId: 'a' })
        selection = setEarendelSelection(selection, 'power', Power.Feint)
        selection = setEarendelSelection(selection, 'origin', at(1, 0))
        selection = setEarendelSelection(selection, 'preview', at(2, 0))

        selection = setEarendelSelection(selection, 'power', Power.Wormhole)

        expect(selection.piece?.value).toEqual({ source: 'held', pieceId: 'a' })
        expect(selection.power?.value).toBe(Power.Wormhole)
        expect(selection.origin).toBeUndefined()
        expect(selection.preview).toBeUndefined()
    })

    it('choosing a ship to place drops a power chosen before it', () => {
        let selection: EarendelSelection = {}
        selection = setEarendelSelection(selection, 'power', Power.Download)
        selection = setEarendelSelection(selection, 'piece', { source: 'special', pieceId: 's' })

        expect(selection.power).toBeUndefined()
        expect(selection.piece?.value.source).toBe('special')
    })

    it('reselecting an earlier stage replaces it and clears what was built on it', () => {
        let selection: EarendelSelection = {}
        selection = setEarendelSelection(selection, 'power', Power.Spread)
        selection = toggleEarendelTarget(selection, at(1, 0))
        selection = toggleEarendelTarget(selection, at(2, 0))
        expect(selection.targets?.value).toEqual([at(1, 0), at(2, 0)])

        selection = toggleEarendelTarget(selection, at(1, 0))
        expect(selection.targets?.value).toEqual([at(2, 0)])

        selection = setEarendelSelection(selection, 'power', Power.Railgun)
        expect(selection.targets).toBeUndefined()
    })

    it('clearing a stage with undefined clears it and every later stage', () => {
        let selection: EarendelSelection = {}
        selection = setEarendelSelection(selection, 'origin', at(1, 0))
        selection = setEarendelSelection(selection, 'preview', at(2, 0))
        selection = setEarendelSelection(selection, 'origin', undefined)

        expect(selection).toEqual({})
        expect(hasManualEarendelSelection(selection)).toBe(false)
    })

    it('throws on a stage outside the stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, unknown>, string>(
                {},
                EarendelStageOrder,
                'unknown',
                1,
                'manual'
            )
        ).toThrow()
    })

    it('pops the highest manual stage and every stage after it', () => {
        let selection: EarendelSelection = {}
        selection = setEarendelSelection(selection, 'power', Power.Feint)
        selection = setEarendelSelection(selection, 'origin', at(1, 0), 'auto')
        selection = setEarendelSelection(selection, 'preview', at(2, 0))

        selection = popEarendelSelection(selection)
        expect(selection.preview).toBeUndefined()
        expect(selection.origin?.source).toBe('auto')

        selection = popEarendelSelection(selection)
        expect(selection).toEqual({})
    })
})

describe('contextual Undo', () => {
    it('pops a manual selection and undoes no action', async () => {
        const undo = contextualUndo(setEarendelSelection({}, 'origin', at(1, 0)))
        await undo.press()

        expect(undo.selection).toEqual({})
        expect(undo.undoAction).not.toHaveBeenCalled()
    })

    it('walks back one manual stage per press, then undoes the action', async () => {
        let selection: EarendelSelection = {}
        selection = setEarendelSelection(selection, 'power', Power.Wormhole)
        selection = setEarendelSelection(selection, 'origin', at(1, 0))
        const undo = contextualUndo(selection)

        await undo.press()
        expect(undo.selection.power?.value).toBe(Power.Wormhole)
        expect(undo.selection.origin).toBeUndefined()

        await undo.press()
        expect(undo.selection).toEqual({})
        expect(undo.undoAction).not.toHaveBeenCalled()

        await undo.press()
        expect(undo.undoAction).toHaveBeenCalledTimes(1)
    })

    it('goes straight to action undo when only auto selections remain', async () => {
        const undo = contextualUndo(setEarendelSelection({}, 'origin', at(1, 0), 'auto'))
        await undo.press()

        expect(undo.undoAction).toHaveBeenCalledTimes(1)
        expect(undo.selection.origin?.source).toBe('auto')
    })
})
