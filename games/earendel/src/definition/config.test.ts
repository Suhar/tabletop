import { describe, expect, it } from 'vitest'
import { TechnologyEffectKind } from '../model/technology.js'
import { earendelConfig, FULL_DECK, TurnStyle } from './config.js'

describe('earendelConfig', () => {
    it('reads an absent configuration as the defaults', () => {
        expect(earendelConfig(undefined)).toEqual({})
    })

    it('accepts every offered value', () => {
        expect(
            earendelConfig({ turnStyle: TurnStyle.SinglePiece, technologyDeck: FULL_DECK })
        ).toEqual({
            turnStyle: TurnStyle.SinglePiece,
            technologyDeck: FULL_DECK
        })
        for (const kind of Object.values(TechnologyEffectKind)) {
            expect(() => earendelConfig({ technologyDeck: kind })).not.toThrow()
        }
    })

    it('rejects values that are not options instead of falling back to a default', () => {
        expect(() => earendelConfig({ turnStyle: 'drawFive' })).toThrow()
        expect(() => earendelConfig({ technologyDeck: 'nonsense' })).toThrow()
    })
})
