import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import {
    TECHNOLOGY_CATEGORY,
    TechnologyCategory,
    TechnologyEffectKind
} from '../model/technology.js'
import { FULL_TECHNOLOGY_DECK, technologyCard } from '../model/technologyCards.js'
import { buildTechnologyDeck, grantsPiece, selectPieceTechnologies } from './technologyDeck.js'
import { BASIC_PIECE_TECHNOLOGIES } from '../model/technology.js'
import { PiecesInPlay, TurnStyle } from '../definition/config.js'
import { TestGame } from '../testing/testHarness.js'

describe('piece technologies in play', () => {
    it('draws one per category and leaves the others out of the deck', () => {
        const prng = new Prng({ seed: 5, invocations: 0 })
        const pieces = selectPieceTechnologies(prng, PiecesInPlay.OnePerCategory)!
        expect(Object.keys(pieces).sort()).toEqual(Object.values(TechnologyCategory).sort())
        expect(pieces[TechnologyCategory.Mobility]).toBe(TechnologyEffectKind.GateNetwork)

        const deck = buildTechnologyDeck(prng, pieces).map(technologyCard)
        for (const card of deck) {
            if (!grantsPiece(card.effect)) continue
            expect(pieces[TECHNOLOGY_CATEGORY[card.effect]]).toBe(card.effect)
        }
        // Every piece in play has at least one card in the deck.
        for (const kind of Object.values(pieces)) {
            expect(deck.some((card) => card.effect === kind)).toBe(true)
        }
        expect(deck.length).toBeLessThan(FULL_TECHNOLOGY_DECK.length)
    })

    it('plays the basic five unless the options say otherwise', () => {
        const basic = new TestGame(2, 1, { turnStyle: TurnStyle.SinglePiece })
        expect(basic.state.pieceTechnologies).toEqual(BASIC_PIECE_TECHNOLOGIES)
        const deck = basic.state.technologyDeck.items.map(technologyCard)
        expect(deck.some((card) => card.effect === TechnologyEffectKind.Interdiction)).toBe(true)
        expect(deck.some((card) => card.effect === TechnologyEffectKind.BastionWorks)).toBe(false)
    })

    it('records the draw on the state, and keeps every piece when the option says so', () => {
        const drawn = new TestGame(2, 1, {
            turnStyle: TurnStyle.SinglePiece,
            piecesInPlay: PiecesInPlay.OnePerCategory
        })
        expect(Object.keys(drawn.state.pieceTechnologies ?? {})).toHaveLength(5)

        const all = new TestGame(2, 1, {
            turnStyle: TurnStyle.SinglePiece,
            piecesInPlay: PiecesInPlay.All
        })
        expect(all.state.pieceTechnologies).toBeUndefined()
        expect(all.state.technologyDeck.remaining).toBeGreaterThan(
            drawn.state.technologyDeck.remaining
        )
    })
})
