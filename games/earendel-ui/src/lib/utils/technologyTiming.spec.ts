import { describe, expect, it } from 'vitest'
import { TechnologyEffectKind } from '@tabletop/earendel'
import { timingNote } from './technologyTiming.js'

describe('timingNote', () => {
    it('marks a stored technology as a one-shot', () => {
        expect(timingNote(TechnologyEffectKind.WarpDrive)?.label).toBe('One-shot')
    })

    it('marks a cooldown technology as on a timer', () => {
        expect(timingNote(TechnologyEffectKind.GammaTorpedo)?.label).toBe('Timer')
    })

    it('says nothing of a technology that grants a piece', () => {
        expect(timingNote(TechnologyEffectKind.Interdiction)).toBeUndefined()
    })
})
