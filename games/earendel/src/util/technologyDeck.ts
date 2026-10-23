import { Prng, shuffle } from '@tabletop/common'
import { type Bag, drawFrom, returnTo } from './drawBags.js'
import { PlanetColor } from '../model/board.js'
import {
    matchesColor,
    TechnologyCard,
    TechnologyEffectKind,
    TechnologyTier
} from '../model/technology.js'

export type TechnologyPiles = {
    deck: Bag<TechnologyCard>
    discard: TechnologyCard[]
}

export type RevealResult = {
    candidates: TechnologyCard[]
    flipped: TechnologyCard[]
    exhausted: boolean
}

export function revealForExploration(
    piles: TechnologyPiles,
    color: PlanetColor,
    count: number,
    prng: Prng
): RevealResult {
    const candidates: TechnologyCard[] = []
    const flipped: TechnologyCard[] = []

    while (candidates.length < count) {
        if (piles.deck.remaining === 0) {
            if (piles.discard.length === 0) {
                return { candidates, flipped, exhausted: true }
            }
            // Cards flipped in this reveal are not in the discard yet, so they cannot come back around.
            returnTo(piles.deck, piles.discard, prng.random)
            piles.discard = []
        }

        const card = drawFrom(piles.deck)!
        flipped.push(card)
        if (matchesColor(card, color)) candidates.push(card)
    }

    return { candidates, flipped, exhausted: false }
}

// No elevated technology exists yet, so none is dealt: one would remove the explorer's choice.
export const ELEVATED_SHARE = 3
export const DEAL_ELEVATED = false

const PLACEHOLDER_EFFECTS = [
    TechnologyEffectKind.MoveFriendlyPiece,
    TechnologyEffectKind.GrowBoard,
    TechnologyEffectKind.LogisticsUpgrade,
    TechnologyEffectKind.Railgun,
    TechnologyEffectKind.StationUpgrade,
    TechnologyEffectKind.UpdatedLogistics,
    TechnologyEffectKind.FullTorpedoSpread,
    TechnologyEffectKind.TacticalFeint,
    TechnologyEffectKind.TradeRouteWormhole,
    TechnologyEffectKind.ImmediateDownload
] as const satisfies readonly TechnologyEffectKind[]

type UndealtEffect = Exclude<TechnologyEffectKind, (typeof PLACEHOLDER_EFFECTS)[number]>
// Fails to compile, naming the missing effect, when one is left out of PLACEHOLDER_EFFECTS.
const _EVERY_EFFECT_IS_DEALT: [UndealtEffect] extends [never] ? true : UndealtEffect = true
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
        tier:
            DEAL_ELEVATED && index % ELEVATED_SHARE === 0
                ? TechnologyTier.Elevated
                : TechnologyTier.Standard,
        effect: { kind: PLACEHOLDER_EFFECTS[index % PLACEHOLDER_EFFECTS.length] }
    }))

    shuffle(deck, prng.random)
    return deck
}
