import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import { PlanetColor, PLANET_COLORS } from '../model/board.js'
import {
    choosableFrom,
    TECHNOLOGY_CATEGORY,
    TECHNOLOGY_CATEGORY_INFO,
    TechnologyCategory,
    type TechnologyCard,
    TechnologyEffectKind,
    TechnologyTier
} from '../model/technology.js'
import {
    CATEGORY_CARDS,
    focusedCardId,
    FOCUSED_COPIES_PER_COLOR,
    focusedTechnologyDeck,
    FULL_TECHNOLOGY_DECK,
    SECOND_THEME,
    technologyCard
} from '../model/technologyCards.js'
import { HydratedTechnologyDeck, putUnder } from '../model/bags.js'
import {
    buildFocusedTechnologyDeck,
    buildTechnologyDeck,
    revealForExploration,
    type TechnologyPiles
} from './technologyDeck.js'
import { stackedBag } from '../testing/testHarness.js'

const prng = () => new Prng({ seed: 5, invocations: 0 })

const card = (color: PlanetColor, copy = 0) =>
    focusedCardId(TechnologyEffectKind.Railgun, color, copy)

// Single- and multi-color cards from the full deck.
// Tactical Feint (aqua and periwinkle) and Spoofed Orders (periwinkle and violet).
const AQUA_PERIWINKLE = 'tacticalFeint-1'
const PERIWINKLE_VIOLET = 'spoofedOrders-1'

function piles(drawOrder: string[], discard: string[] = []): TechnologyPiles {
    return { deck: new HydratedTechnologyDeck(stackedBag(drawOrder)), discard }
}

describe('revealForExploration', () => {
    it('flips until enough cards show the planet’s color', () => {
        const a = card(PlanetColor.Periwinkle, 0)
        const b = card(PlanetColor.Aqua)
        const d = card(PlanetColor.Periwinkle, 1)
        const deck = piles([a, b, AQUA_PERIWINKLE, d])

        const result = revealForExploration(deck, PlanetColor.Periwinkle, 2, prng())

        expect(result.candidates).toEqual([a, AQUA_PERIWINKLE])
        expect(result.flipped).toEqual([a, b, AQUA_PERIWINKLE])
        expect(deck.deck.items).toEqual([d])
        expect(deck.deck.remaining).toBe(1)
        expect(result.exhausted).toBe(false)
    })

    it('offers only the matching cards as candidates', () => {
        const hit = card(PlanetColor.Violet)
        const deck = piles([card(PlanetColor.Mint), hit, card(PlanetColor.Teal), PERIWINKLE_VIOLET])

        const result = revealForExploration(deck, PlanetColor.Violet, 2, prng())

        expect(result.candidates).toEqual([hit, PERIWINKLE_VIOLET])
        expect(result.flipped).toHaveLength(4)
    })

    it('reshuffles the discard when the deck runs out mid-reveal', () => {
        const deck = piles(
            [card(PlanetColor.Teal, 0)],
            [
                focusedCardId(TechnologyEffectKind.GammaTorpedo, PlanetColor.Teal, 0),
                card(PlanetColor.Periwinkle)
            ]
        )

        const result = revealForExploration(deck, PlanetColor.Teal, 2, prng())

        expect(result.candidates).toHaveLength(2)
        expect(result.exhausted).toBe(false)
        expect(deck.discard).toEqual([])
    })

    it('explores with fewer candidates when both piles are spent', () => {
        const only = card(PlanetColor.Aqua)
        const deck = piles([only, card(PlanetColor.Periwinkle)])

        const result = revealForExploration(deck, PlanetColor.Aqua, 3, prng())

        expect(result.candidates).toEqual([only])
        expect(result.exhausted).toBe(true)
        expect(deck.deck.items).toEqual([])
        expect(deck.deck.remaining).toBe(0)
    })

    it('explores with no candidates at all rather than hanging', () => {
        const result = revealForExploration(piles([]), PlanetColor.Periwinkle, 2, prng())

        expect(result.candidates).toEqual([])
        expect(result.flipped).toEqual([])
        expect(result.exhausted).toBe(true)
    })

    it('turns a repeat of a technology already on offer over on the way', () => {
        const first = card(PlanetColor.Teal, 0)
        const repeat = card(PlanetColor.Teal, 1)
        const fresh = focusedCardId(TechnologyEffectKind.GammaTorpedo, PlanetColor.Teal, 0)
        const deck = piles([first, repeat, fresh])

        const result = revealForExploration(deck, PlanetColor.Teal, 2, prng())

        expect(result.candidates).toEqual([first, fresh])
        expect(result.flipped).toEqual([first, repeat, fresh])
        expect(result.exhausted).toBe(false)
    })

    it('stops short rather than hunt for a new technology the piles do not hold', () => {
        // A single-technology deck: every match after the first would be a repeat.
        const deck = piles(
            [card(PlanetColor.Teal, 0), card(PlanetColor.Teal, 1), card(PlanetColor.Teal, 2)],
            [card(PlanetColor.Teal, 3)]
        )

        const result = revealForExploration(deck, PlanetColor.Teal, 3, prng())

        expect(result.candidates).toEqual([card(PlanetColor.Teal, 0)])
        expect(result.flipped).toEqual([card(PlanetColor.Teal, 0), card(PlanetColor.Teal, 1)])
        expect(result.exhausted).toBe(false)
        expect(deck.deck.remaining).toBe(1)
        expect(deck.discard).toHaveLength(1)
    })

    it('keeps hunting past a repeat while the discard still holds a new technology', () => {
        const fresh = focusedCardId(TechnologyEffectKind.GammaTorpedo, PlanetColor.Teal, 0)
        const deck = piles([card(PlanetColor.Teal, 0), card(PlanetColor.Teal, 1)], [fresh])

        const result = revealForExploration(deck, PlanetColor.Teal, 2, prng())

        expect(result.candidates).toEqual([card(PlanetColor.Teal, 0), fresh])
        expect(deck.discard).toEqual([])
    })

    it('cannot re-flip a card already turned over in the same reveal', () => {
        // Flipped cards are on the table, not in the discard, so a reshuffle cannot hand one back.
        const only = card(PlanetColor.Teal)

        const result = revealForExploration(piles([only]), PlanetColor.Teal, 3, prng())

        expect(result.candidates).toEqual([only])
        expect(result.flipped).toEqual([only])
    })
})

describe('the full technology deck', () => {
    it("gives each technology its category's color, and a second only where it has a second theme", () => {
        expect(FULL_TECHNOLOGY_DECK).toHaveLength(62)
        // Two cards of every standard technology.
        const perEffect = new Map<string, number>()
        for (const card of FULL_TECHNOLOGY_DECK) {
            perEffect.set(card.effect, (perEffect.get(card.effect) ?? 0) + 1)
        }
        expect(perEffect.size).toBe(31)
        expect([...perEffect.values()].every((count) => count === 2)).toBe(true)
        for (const card of FULL_TECHNOLOGY_DECK) {
            const second = SECOND_THEME[card.effect]
            expect(card.colors).toEqual([
                TECHNOLOGY_CATEGORY_INFO[TECHNOLOGY_CATEGORY[card.effect]].color,
                ...(second ? [TECHNOLOGY_CATEGORY_INFO[second].color] : [])
            ])
            expect(second).not.toBe(TECHNOLOGY_CATEGORY[card.effect])
        }
        expect(FULL_TECHNOLOGY_DECK.filter((card) => card.colors.length === 2)).toHaveLength(20)

        // Two technologies of each category carry a second color, and each color is lent to
        // two technologies of other categories.
        for (const category of Object.values(TechnologyCategory)) {
            const lent = Object.entries(SECOND_THEME)
            expect(
                lent.filter(([effect]) => CATEGORY_CARDS[category].some((card) => card === effect))
            ).toHaveLength(2)
            expect(lent.filter(([, second]) => second === category)).toHaveLength(2)
        }
    })

    it("deals each category's technologies onto its cards", () => {
        for (const category of Object.values(TechnologyCategory)) {
            expect(
                FULL_TECHNOLOGY_DECK.filter(
                    (card) => TECHNOLOGY_CATEGORY[card.effect] === category
                ).map((card) => card.effect)
            ).toEqual(CATEGORY_CARDS[category])
        }
        expect(FULL_TECHNOLOGY_DECK.every((d) => d.tier === TechnologyTier.Standard)).toBe(true)
    })

    it('gives every color its category, so no color is neglected', () => {
        const counts = PLANET_COLORS.map(
            (color) => FULL_TECHNOLOGY_DECK.filter((d) => d.colors.includes(color)).length
        )
        // The reveal rule stalls on a color the deck neglects.
        expect(Math.min(...counts)).toBe(16)
        expect(Math.max(...counts)).toBe(18)
    })

    it('is dealt as the full deck of card ids, shuffled deterministically by seed', () => {
        const deck = buildTechnologyDeck(prng())

        expect([...deck].sort()).toEqual(FULL_TECHNOLOGY_DECK.map((d) => d.id).sort())
        expect(buildTechnologyDeck(prng())).toEqual(deck)
    })
})

describe('the focused technology deck', () => {
    it('holds twelve single-color cards of the one effect in every color', () => {
        const effect = TechnologyEffectKind.MoveFriendlyPiece
        const deck = buildFocusedTechnologyDeck(prng(), effect)

        expect(deck).toHaveLength(60)
        expect(new Set(deck).size).toBe(60)
        for (const color of PLANET_COLORS) {
            const ofColor = focusedTechnologyDeck(effect).filter((d) => d.colors.includes(color))
            expect(ofColor).toHaveLength(FOCUSED_COPIES_PER_COLOR)
        }
        expect(deck.every((id) => technologyCard(id).effect === effect)).toBe(true)
        expect(deck.every((id) => technologyCard(id).colors.length === 1)).toBe(true)
    })
})

describe('technologyCard', () => {
    it('looks a card up by its id', () => {
        expect(technologyCard('updatedLogistics-1')).toEqual({
            id: 'updatedLogistics-1',
            colors: [PlanetColor.Violet],
            tier: TechnologyTier.Standard,
            effect: TechnologyEffectKind.UpdatedLogistics
        })
    })

    it('rejects an unknown id', () => {
        expect(() => technologyCard('nonsense')).toThrow()
    })
})

describe('choosableFrom', () => {
    const definition = (id: string, tier: TechnologyTier): TechnologyCard => ({
        id,
        colors: [PlanetColor.Periwinkle],
        tier,
        effect: TechnologyEffectKind.Railgun
    })
    const standard = definition('standard', TechnologyTier.Standard)
    const elevated = definition('elevated-a', TechnologyTier.Elevated)

    // An elevated card is a choice like any other (rules.md, Elevated technologies).
    it('offers every matching card, an elevated one among them', () => {
        expect(choosableFrom([standard, elevated])).toEqual([standard, elevated])
    })
})

describe('cards put back under the deck', () => {
    it('are the last to be drawn, and the count stays true', () => {
        const deck = new HydratedTechnologyDeck(stackedBag(['top', 'next']))

        putUnder(deck, ['a', 'b', 'c'], new Prng({ seed: 3, invocations: 0 }).random)

        expect(deck.remaining).toBe(5)
        expect(deck.items).toHaveLength(5)
        // A draw takes from the end of the list: what was there first still comes off first.
        expect([deck.draw(), deck.draw()].sort()).toEqual(['next', 'top'])
        expect([deck.draw(), deck.draw(), deck.draw()].sort()).toEqual(['a', 'b', 'c'])
        expect(deck.isEmpty()).toBe(true)
    })
})
