import { Prng, shuffle } from '@tabletop/common'
import { PlanetColor } from '../model/board.js'
import {
    BASIC_PIECE_TECHNOLOGIES,
    isSpecialPieceTechnology,
    matchesColor,
    TECHNOLOGY_CATEGORY,
    type TechnologyCard,
    TechnologyCategory,
    TechnologyEffectKind
} from '../model/technology.js'
import {
    CATEGORY_CARDS,
    focusedTechnologyDeck,
    FULL_TECHNOLOGY_DECK,
    technologyCard
} from '../model/technologyCards.js'
import { type HydratedTechnologyDeck, returnToBag } from '../model/bags.js'
import { PiecesInPlay } from '../definition/config.js'

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
    const offered = new Set<TechnologyEffectKind>()

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
        const card = technologyCard(id)
        if (!matchesColor(card, color)) continue
        if (!offered.has(card.effect)) {
            candidates.push(id)
            offered.add(card.effect)
            continue
        }
        // A repeat of a technology already on offer is turned over on the way, like a card of
        // the wrong color (rules.md, Exploration). When the piles hold no further match of a
        // new technology the hunt would only burn the deck, so the reveal stops short instead.
        if (!freshMatchRemains(piles, color, offered)) break
    }

    return { candidates, flipped, exhausted: false }
}

function freshMatchRemains(
    piles: TechnologyPiles,
    color: PlanetColor,
    offered: ReadonlySet<TechnologyEffectKind>
): boolean {
    return [...piles.deck.items, ...piles.discard].some((id) => {
        const card = technologyCard(id)
        return matchesColor(card, color) && !offered.has(card.effect)
    })
}

function shuffledIds(cards: readonly TechnologyCard[], prng: Prng): string[] {
    const ids = cards.map((card) => card.id)
    shuffle(ids, prng.random)
    return ids
}

export function buildFocusedTechnologyDeck(prng: Prng, effect: TechnologyEffectKind): string[] {
    return shuffledIds(focusedTechnologyDeck(effect), prng)
}

// The special units in play this game (rules.md, Granted pieces): the basic five, one per
// category drawn here, or every one (then nothing is chosen and the deck keeps them all).
export function selectPieceTechnologies(
    prng: Prng,
    mode: PiecesInPlay = PiecesInPlay.Basic
): Partial<Record<TechnologyCategory, TechnologyEffectKind>> | undefined {
    if (mode === PiecesInPlay.All) return undefined
    if (mode === PiecesInPlay.Basic) return { ...BASIC_PIECE_TECHNOLOGIES }
    const chosen: Partial<Record<TechnologyCategory, TechnologyEffectKind>> = {}
    for (const category of Object.values(TechnologyCategory)) {
        const pieces = [...new Set(CATEGORY_CARDS[category].filter(grantsPiece))]
        if (pieces.length === 0) continue
        chosen[category] = pieces[Math.floor(prng.random() * pieces.length)]
    }
    return chosen
}

export function grantsPiece(kind: TechnologyEffectKind): boolean {
    return isSpecialPieceTechnology(kind)
}

// The full deck less the piece technologies not in play: their cards are out of the game.
export function buildTechnologyDeck(
    prng: Prng,
    pieces?: Partial<Record<TechnologyCategory, TechnologyEffectKind>>
): string[] {
    const cards = pieces
        ? FULL_TECHNOLOGY_DECK.filter(
              (card) =>
                  !grantsPiece(card.effect) ||
                  pieces[TECHNOLOGY_CATEGORY[card.effect]] === card.effect
          )
        : FULL_TECHNOLOGY_DECK
    return shuffledIds(cards, prng)
}
