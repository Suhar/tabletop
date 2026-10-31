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
    technologyCard
} from '../model/technologyCards.js'
import { HydratedTechnologyDeck } from '../model/bags.js'
import {
    buildFocusedTechnologyDeck,
    buildTechnologyDeck,
    revealForExploration,
    type TechnologyPiles
} from './technologyDeck.js'
import { stackedBag } from './testHarness.js'

const prng = () => new Prng({ seed: 5, invocations: 0 })

const card = (color: PlanetColor, copy = 0) =>
    focusedCardId(TechnologyEffectKind.Railgun, color, copy)

// Single- and multi-colour cards from the full deck.
const PERIWINKLE_TEAL = 'tech-14'
const MINT_VIOLET = 'tech-11'

function piles(drawOrder: string[], discard: string[] = []): TechnologyPiles {
    return { deck: new HydratedTechnologyDeck(stackedBag(drawOrder)), discard }
}

describe('revealForExploration', () => {
    it('flips until enough cards show the planet’s colour', () => {
        const a = card(PlanetColor.Periwinkle, 0)
        const b = card(PlanetColor.Aqua)
        const d = card(PlanetColor.Periwinkle, 1)
        const deck = piles([a, b, PERIWINKLE_TEAL, d])

        const result = revealForExploration(deck, PlanetColor.Periwinkle, 2, prng())

        expect(result.candidates).toEqual([a, PERIWINKLE_TEAL])
        expect(result.flipped).toEqual([a, b, PERIWINKLE_TEAL])
        expect(deck.deck.items).toEqual([d])
        expect(deck.deck.remaining).toBe(1)
        expect(result.exhausted).toBe(false)
    })

    it('offers only the matching cards as candidates', () => {
        const hit = card(PlanetColor.Violet)
        const deck = piles([card(PlanetColor.Mint), hit, card(PlanetColor.Teal), MINT_VIOLET])

        const result = revealForExploration(deck, PlanetColor.Violet, 2, prng())

        expect(result.candidates).toEqual([hit, MINT_VIOLET])
        expect(result.flipped).toHaveLength(4)
    })

    it('reshuffles the discard when the deck runs out mid-reveal', () => {
        const deck = piles(
            [card(PlanetColor.Teal, 0)],
            [card(PlanetColor.Teal, 1), card(PlanetColor.Periwinkle)]
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

    it('cannot re-flip a card already turned over in the same reveal', () => {
        // Flipped cards are on the table, not in the discard, so a reshuffle cannot hand one back.
        const only = card(PlanetColor.Teal)

        const result = revealForExploration(piles([only]), PlanetColor.Teal, 3, prng())

        expect(result.candidates).toEqual([only])
        expect(result.flipped).toEqual([only])
    })
})

describe('the full technology deck', () => {
    it('pairs each category colour once with each other colour', () => {
        expect(FULL_TECHNOLOGY_DECK).toHaveLength(20)
        for (const card of FULL_TECHNOLOGY_DECK) {
            expect(card.colors).toHaveLength(2)
            // The first colour is the card's category colour.
            expect(card.colors[0]).toBe(
                TECHNOLOGY_CATEGORY_INFO[TECHNOLOGY_CATEGORY[card.effect]].color
            )
        }
        // Every pair of colours is on two cards, one from each colour's category.
        const pairs = FULL_TECHNOLOGY_DECK.map((card) => [...card.colors].sort().join('+'))
        expect(new Set(pairs).size).toBe(10)
        for (const pair of new Set(pairs)) {
            expect(pairs.filter((other) => other === pair)).toHaveLength(2)
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

    it('gives every colour a fair share of the deck', () => {
        const counts = PLANET_COLORS.map(
            (color) => FULL_TECHNOLOGY_DECK.filter((d) => d.colors.includes(color)).length
        )
        // The reveal rule stalls on a colour the deck neglects.
        expect(new Set(counts).size).toBe(1)
    })

    it('is dealt as the full deck of card ids, shuffled deterministically by seed', () => {
        const deck = buildTechnologyDeck(prng())

        expect([...deck].sort()).toEqual(FULL_TECHNOLOGY_DECK.map((d) => d.id).sort())
        expect(buildTechnologyDeck(prng())).toEqual(deck)
    })
})

describe('the focused technology deck', () => {
    it('holds twelve single-colour cards of the one effect in every colour', () => {
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
        expect(technologyCard('tech-0')).toEqual({
            id: 'tech-0',
            colors: [PlanetColor.Violet, PlanetColor.Periwinkle],
            tier: TechnologyTier.Standard,
            effect: TechnologyEffectKind.UpdatedLogistics
        })
    })

    it('rejects an unknown id', () => {
        expect(() => technologyCard('nonsense')).toThrow()
    })
})

describe('choosableFrom', () => {
    // No elevated card is dealt yet, so the rule is checked on definitions made up here.
    const definition = (id: string, tier: TechnologyTier): TechnologyCard => ({
        id,
        colors: [PlanetColor.Periwinkle],
        tier,
        effect: TechnologyEffectKind.Railgun
    })
    const standard = definition('standard', TechnologyTier.Standard)
    const elevatedA = definition('elevated-a', TechnologyTier.Elevated)
    const elevatedB = definition('elevated-b', TechnologyTier.Elevated)

    it('offers every matching card when none is elevated', () => {
        expect(choosableFrom([standard])).toEqual([standard])
    })

    it('forces an elevated card, putting the standard matches out of reach', () => {
        expect(choosableFrom([standard, elevatedA])).toEqual([elevatedA])
    })

    it('offers the choice between elevated cards when more than one turns up', () => {
        expect(choosableFrom([elevatedA, standard, elevatedB])).toEqual([elevatedA, elevatedB])
    })
})
