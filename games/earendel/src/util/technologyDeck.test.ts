import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import { PlanetColor } from '../model/board.js'
import type { TechnologyCard } from '../model/technology.js'
import {
    buildFocusedTechnologyDeck,
    buildTechnologyDeck,
    revealForExploration,
    type TechnologyPiles
} from './technologyDeck.js'
import { TechnologyEffectKind, TechnologyTier } from '../model/technology.js'

const prng = () => new Prng({ seed: 5, invocations: 0 })

function card(id: string, ...colors: PlanetColor[]): TechnologyCard {
    return { id, colors, tier: TechnologyTier.Standard }
}

describe('revealForExploration', () => {
    it('flips until enough cards show the planet’s colour', () => {
        const piles: TechnologyPiles = {
            deck: [
                card('a', PlanetColor.Azure),
                card('b', PlanetColor.Crimson),
                card('c', PlanetColor.Azure, PlanetColor.Gold),
                card('d', PlanetColor.Azure)
            ],
            discard: []
        }

        const result = revealForExploration(piles, PlanetColor.Azure, 2, prng())

        // Stops the moment the second Azure card appears - 'd' is never turned over.
        expect(result.candidates.map((c) => c.id)).toEqual(['a', 'c'])
        expect(result.flipped.map((c) => c.id)).toEqual(['a', 'b', 'c'])
        expect(piles.deck.map((c) => c.id)).toEqual(['d'])
        expect(result.exhausted).toBe(false)
    })

    it('offers only the matching cards as candidates', () => {
        // Cards without the colour are turned over on the way and are never choosable.
        const piles: TechnologyPiles = {
            deck: [
                card('miss1', PlanetColor.Verdant),
                card('hit1', PlanetColor.Violet),
                card('miss2', PlanetColor.Gold),
                card('hit2', PlanetColor.Violet, PlanetColor.Verdant)
            ],
            discard: []
        }

        const result = revealForExploration(piles, PlanetColor.Violet, 2, prng())

        expect(result.candidates.map((c) => c.id)).toEqual(['hit1', 'hit2'])
        expect(result.flipped).toHaveLength(4)
    })

    it('reshuffles the discard when the deck runs out mid-reveal', () => {
        const piles: TechnologyPiles = {
            deck: [card('a', PlanetColor.Gold)],
            discard: [card('b', PlanetColor.Gold), card('c', PlanetColor.Azure)]
        }

        const result = revealForExploration(piles, PlanetColor.Gold, 2, prng())

        expect(result.candidates).toHaveLength(2)
        expect(result.exhausted).toBe(false)
        expect(piles.discard).toEqual([]) // consumed by the reshuffle
    })

    it('explores with fewer candidates when both piles are spent', () => {
        // A level 3 probe on a colour with only one card left anywhere.
        const piles: TechnologyPiles = {
            deck: [card('only', PlanetColor.Crimson), card('other', PlanetColor.Azure)],
            discard: []
        }

        const result = revealForExploration(piles, PlanetColor.Crimson, 3, prng())

        expect(result.candidates.map((c) => c.id)).toEqual(['only'])
        expect(result.exhausted).toBe(true)
        expect(piles.deck).toEqual([])
    })

    it('explores with no candidates at all rather than hanging', () => {
        const piles: TechnologyPiles = { deck: [], discard: [] }

        const result = revealForExploration(piles, PlanetColor.Azure, 2, prng())

        expect(result.candidates).toEqual([])
        expect(result.flipped).toEqual([])
        expect(result.exhausted).toBe(true)
    })

    it('cannot re-flip a card already turned over in the same reveal', () => {
        // The flipped cards are on the table, not in the discard, so a reshuffle mid-reveal
        // can't hand the same card back - which would otherwise let one card satisfy a
        // level 3 probe by itself.
        const piles: TechnologyPiles = {
            deck: [card('a', PlanetColor.Gold)],
            discard: []
        }

        const result = revealForExploration(piles, PlanetColor.Gold, 3, prng())

        expect(result.candidates.map((c) => c.id)).toEqual(['a'])
        expect(result.flipped.map((c) => c.id)).toEqual(['a'])
    })
})

describe('buildTechnologyDeck', () => {
    it('covers every colour combination of one, two and three colours', () => {
        const deck = buildTechnologyDeck(prng())

        const sizes = new Set(deck.map((c) => c.colors.length))
        expect([...sizes].sort()).toEqual([1, 2, 3])
        // 5 singles + 10 pairs + 10 triples
        expect(deck).toHaveLength(25)
        expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length)
    })

    it('gives every colour a fair share of the deck', () => {
        const deck = buildTechnologyDeck(prng())

        const counts = Object.values(PlanetColor).map(
            (color) => deck.filter((card) => card.colors.includes(color)).length
        )
        // Even coverage matters: the reveal rule stalls on a colour the deck neglects.
        expect(new Set(counts).size).toBe(1)
    })

    it('is deterministic for a given seed', () => {
        expect(buildTechnologyDeck(prng())).toEqual(buildTechnologyDeck(prng()))
    })
})

describe('buildFocusedTechnologyDeck', () => {
    it('fills the deck with one effect in every colour, so it always comes up', () => {
        const deck = buildFocusedTechnologyDeck(
            prng(),
            TechnologyEffectKind.MoveFriendlyPiece
        )

        expect(deck.every((card) => card.effect?.kind === TechnologyEffectKind.MoveFriendlyPiece)).toBe(
            true
        )
        // Every colour is represented, so whatever planet a probe reaches finds a match.
        for (const color of Object.values(PlanetColor)) {
            expect(deck.some((card) => card.colors.includes(color))).toBe(true)
        }
        expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length)
    })
})
