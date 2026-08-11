import { Prng, shuffle } from '@tabletop/common'
import { PlanetColor } from '../model/board.js'
import {
    matchesColor,
    TechnologyCard,
    TechnologyEffectKind,
    TechnologyTier
} from '../model/technology.js'

export type TechnologyPiles = {
    deck: TechnologyCard[]
    discard: TechnologyCard[]
}

export type RevealResult = {
    // The cards the exploring player chooses between: those showing the planet's colour.
    // Fewer than requested only when the deck and discard together couldn't produce enough.
    candidates: TechnologyCard[]
    // Everything turned over, in the order it came up - candidates included. History shows
    // this, since watching the flips is half the drama of exploring.
    flipped: TechnologyCard[]
    // True when the piles ran dry before enough matches appeared.
    exhausted: boolean
}

// Flip from the deck until `count` cards showing this planet's colour are face up.
//
// Cards without the colour are turned over on the way and are never candidates - they exist
// to make the flip a moment rather than a lookup. If the deck empties mid-reveal the discard
// is shuffled to refill it; if both are spent, the planet is explored with fewer candidates
// than the probe's level, possibly none. The deck is meant to carry enough variety that this
// never happens in practice, but "explore with fewer" beats hanging the turn.
//
// Mutates the piles: flipped cards leave the deck. The CALLER decides what happens to them
// afterwards - the chosen candidate is housed on the planet and everything else discarded -
// because only the caller knows which one was chosen.
export function revealForExploration(
    piles: TechnologyPiles,
    color: PlanetColor,
    count: number,
    prng: Prng
): RevealResult {
    const candidates: TechnologyCard[] = []
    const flipped: TechnologyCard[] = []

    while (candidates.length < count) {
        if (piles.deck.length === 0) {
            if (piles.discard.length === 0) {
                return { candidates, flipped, exhausted: true }
            }
            // Reshuffling the discard is what makes the deck effectively endless. Note the
            // cards flipped during THIS reveal aren't in the discard yet - they're on the
            // table - so they can't come back around within a single exploration.
            piles.deck = piles.discard
            piles.discard = []
            shuffle(piles.deck, prng.random)
        }

        const card = piles.deck.shift()!
        flipped.push(card)
        if (matchesColor(card, color)) candidates.push(card)
    }

    return { candidates, flipped, exhausted: false }
}

// Placeholder deck: every one-colour card, every pair, and every triple. Real technologies
// will replace this wholesale - what matters for now is that colour coverage is even, so the
// reveal rule can be exercised honestly. Deterministic given a seed, like everything in setup.
//
// PROVISIONAL: one card in three is elevated. The real proportion belongs with the real
// technologies, since it depends on how much stronger an elevated one is. It matters more
// than it looks: an elevated card removes the explorer's choice, so a deck thick with them
// turns exploring from a decision into a lottery.
export const ELEVATED_SHARE = 3

// Dealt round-robin across the deck so every effect gets exercised in play, and so an elevated
// card is not strictly worse than a standard one for having no effect. Real technologies
// replace this wholesale.
const PLACEHOLDER_EFFECTS: TechnologyEffectKind[] = [
    TechnologyEffectKind.MoveFriendlyPiece,
    TechnologyEffectKind.GrowBoard,
    TechnologyEffectKind.LogisticsUpgrade
]
// A deck of nothing but the named effect, one card per planet colour so that whatever a probe
// reaches, the effect comes up. A testing aid - see the technologyDeck config option.
export function buildFocusedTechnologyDeck(
    prng: Prng,
    kind: TechnologyEffectKind,
    copiesPerColor = 12
): TechnologyCard[] {
    const deck: TechnologyCard[] = []

    for (const color of Object.values(PlanetColor)) {
        for (let copy = 0; copy < copiesPerColor; copy++) {
            deck.push({
                id: `${kind}-${color}-${copy}`,
                colors: [color],
                tier: TechnologyTier.Standard,
                effect: { kind }
            })
        }
    }

    shuffle(deck, prng.random)
    return deck
}

export function buildTechnologyDeck(prng: Prng): TechnologyCard[] {
    const colors = Object.values(PlanetColor)
    const combinations: PlanetColor[][] = []

    for (let i = 0; i < colors.length; i++) {
        combinations.push([colors[i]])
        for (let j = i + 1; j < colors.length; j++) {
            combinations.push([colors[i], colors[j]])
            for (let k = j + 1; k < colors.length; k++) {
                combinations.push([colors[i], colors[j], colors[k]])
            }
        }
    }

    const deck: TechnologyCard[] = combinations.map((cardColors, index) => ({
        id: `tech-${index}`,
        colors: cardColors,
        // Spread by position over the generated combinations, so elevated cards land on a
        // mix of colours and card widths rather than clumping on one kind.
        tier: index % ELEVATED_SHARE === 0 ? TechnologyTier.Elevated : TechnologyTier.Standard,
        // PROVISIONAL: the effects that exist are dealt alternately across the whole deck so
        // both get exercised in play, and so an elevated card isn't strictly worse than a
        // standard one for having no effect. Real technologies replace this wholesale.
        effect: { kind: PLACEHOLDER_EFFECTS[index % PLACEHOLDER_EFFECTS.length] }
    }))

    shuffle(deck, prng.random)
    return deck
}
