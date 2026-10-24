import { Prng, shuffle } from '@tabletop/common'
import { PlanetColor } from '../model/board.js'
import { matchesColor, type TechnologyCard, TechnologyEffectKind } from '../model/technology.js'
import {
    focusedTechnologyDeck,
    FULL_TECHNOLOGY_DECK,
    technologyCard
} from '../model/technologyCards.js'
import { type HydratedTechnologyDeck, returnToBag } from '../model/bags.js'

export type TechnologyPiles = {
    deck: HydratedTechnologyDeck
    discard: string[]
}

export type RevealResult = {
    candidates: string[]
    flipped: string[]
    exhausted: boolean
}

export function revealForExploration(
    piles: TechnologyPiles,
    color: PlanetColor,
    count: number,
    prng: Prng
): RevealResult {
    const candidates: string[] = []
    const flipped: string[] = []

    while (candidates.length < count) {
        if (piles.deck.isEmpty()) {
            if (piles.discard.length === 0) {
                return { candidates, flipped, exhausted: true }
            }
            // Cards flipped in this reveal are not in the discard yet, so they cannot come back around.
            returnToBag(piles.deck, piles.discard, prng.random)
            piles.discard = []
        }

        const id = piles.deck.draw()
        flipped.push(id)
        if (matchesColor(technologyCard(id), color)) candidates.push(id)
    }

    return { candidates, flipped, exhausted: false }
}

function shuffledIds(cards: readonly TechnologyCard[], prng: Prng): string[] {
    const ids = cards.map((card) => card.id)
    shuffle(ids, prng.random)
    return ids
}

export function buildFocusedTechnologyDeck(prng: Prng, effect: TechnologyEffectKind): string[] {
    return shuffledIds(focusedTechnologyDeck(effect), prng)
}

export function buildTechnologyDeck(prng: Prng): string[] {
    return shuffledIds(FULL_TECHNOLOGY_DECK, prng)
}
