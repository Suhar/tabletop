import { assertExists } from '@tabletop/common'
import { PLANET_COLORS, PlanetColor } from './planetColor.js'
import { type TechnologyCard, TechnologyEffectKind, TechnologyTier } from './technology.js'

// rules.md, Technology deck: the ten technologies are dealt across the colour combinations in
// this order.
export const DEALING_ORDER = [
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

type UndealtEffect = Exclude<TechnologyEffectKind, (typeof DEALING_ORDER)[number]>
// Fails to compile, naming the missing effect, when one is left out of DEALING_ORDER.
const _EVERY_EFFECT_IS_DEALT: [UndealtEffect] extends [never] ? true : UndealtEffect = true

// No elevated technology exists yet, so none is dealt: one would remove the explorer's choice.
export const ELEVATED_SHARE = 3
export const DEAL_ELEVATED = false

export const FOCUSED_COPIES_PER_COLOR = 12

function colorCombinations(): PlanetColor[][] {
    const combinations: PlanetColor[][] = []

    for (let i = 0; i < PLANET_COLORS.length; i++) {
        combinations.push([PLANET_COLORS[i]])
        for (let j = i + 1; j < PLANET_COLORS.length; j++) {
            combinations.push([PLANET_COLORS[i], PLANET_COLORS[j]])
            for (let k = j + 1; k < PLANET_COLORS.length; k++) {
                combinations.push([PLANET_COLORS[i], PLANET_COLORS[j], PLANET_COLORS[k]])
            }
        }
    }

    return combinations
}

export const FULL_TECHNOLOGY_DECK: readonly TechnologyCard[] = colorCombinations().map(
    (colors, index) => ({
        id: `tech-${index}`,
        colors,
        tier:
            DEAL_ELEVATED && index % ELEVATED_SHARE === 0
                ? TechnologyTier.Elevated
                : TechnologyTier.Standard,
        effect: DEALING_ORDER[index % DEALING_ORDER.length]
    })
)

export function focusedCardId(effect: TechnologyEffectKind, color: PlanetColor, copy: number) {
    return `${effect}-${color}-${copy}`
}

function buildFocusedDeck(effect: TechnologyEffectKind): TechnologyCard[] {
    return PLANET_COLORS.flatMap((color) =>
        Array.from({ length: FOCUSED_COPIES_PER_COLOR }, (_, copy) => ({
            id: focusedCardId(effect, color, copy),
            colors: [color],
            tier: TechnologyTier.Standard,
            effect
        }))
    )
}

const FOCUSED_TECHNOLOGY_DECKS = new Map(
    Object.values(TechnologyEffectKind).map((effect) => [effect, buildFocusedDeck(effect)])
)

export function focusedTechnologyDeck(effect: TechnologyEffectKind): readonly TechnologyCard[] {
    const deck = FOCUSED_TECHNOLOGY_DECKS.get(effect)
    assertExists(deck, `No focused deck for ${effect}`)
    return deck
}

const TECHNOLOGY_CARDS_BY_ID = new Map(
    [...FULL_TECHNOLOGY_DECK, ...[...FOCUSED_TECHNOLOGY_DECKS.values()].flat()].map((card) => [
        card.id,
        card
    ])
)

export function technologyCard(id: string): TechnologyCard {
    const card = TECHNOLOGY_CARDS_BY_ID.get(id)
    assertExists(card, `Unknown technology card ${id}`)
    return card
}
