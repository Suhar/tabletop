import { assertExists } from '@tabletop/common'
import { PLANET_COLORS, PlanetColor } from './planetColor.js'
import {
    TECHNOLOGY_CATEGORY_INFO,
    TechnologyCategory,
    type TechnologyCard,
    TechnologyEffectKind,
    TechnologyTier
} from './technology.js'

// rules.md, Technology deck: each category's colour is paired once with each of the other four
// colours, and the category's technologies are dealt onto those four cards in this order. Every
// pair of colours is therefore on two cards, one from each colour's category.
export const CATEGORY_CARDS: Record<TechnologyCategory, readonly TechnologyEffectKind[]> = {
    [TechnologyCategory.Belligerence]: [
        TechnologyEffectKind.UpdatedLogistics,
        TechnologyEffectKind.Railgun,
        TechnologyEffectKind.UpdatedLogistics,
        TechnologyEffectKind.FullTorpedoSpread
    ],
    [TechnologyCategory.Mobility]: [
        TechnologyEffectKind.MoveFriendlyPiece,
        TechnologyEffectKind.TacticalFeint,
        TechnologyEffectKind.MoveFriendlyPiece,
        TechnologyEffectKind.TradeRouteWormhole
    ],
    [TechnologyCategory.Acquisitions]: [
        TechnologyEffectKind.LogisticsUpgrade,
        TechnologyEffectKind.GrowBoard,
        TechnologyEffectKind.LogisticsUpgrade,
        TechnologyEffectKind.GrowBoard
    ],
    [TechnologyCategory.Espionage]: [
        TechnologyEffectKind.ImmediateDownload,
        TechnologyEffectKind.ImmediateDownload,
        TechnologyEffectKind.ImmediateDownload,
        TechnologyEffectKind.ImmediateDownload
    ],
    [TechnologyCategory.Expansion]: [
        TechnologyEffectKind.StationUpgrade,
        TechnologyEffectKind.Terraforming,
        TechnologyEffectKind.RelayNetwork,
        TechnologyEffectKind.StationUpgrade
    ]
}

// No elevated technology exists yet, so none is dealt: one would remove the explorer's choice.
export const ELEVATED_SHARE = 3
export const DEAL_ELEVATED = false

export const FOCUSED_COPIES_PER_COLOR = 12

export const FULL_TECHNOLOGY_DECK: readonly TechnologyCard[] = Object.values(TechnologyCategory)
    .flatMap((category) => {
        const own = TECHNOLOGY_CATEGORY_INFO[category].color
        const neighbours = PLANET_COLORS.filter((color) => color !== own)
        return CATEGORY_CARDS[category].map((effect, index) => ({
            colors: [own, neighbours[index]],
            effect
        }))
    })
    .map((card, index) => ({
        id: `tech-${index}`,
        colors: card.colors,
        tier:
            DEAL_ELEVATED && index % ELEVATED_SHARE === 0
                ? TechnologyTier.Elevated
                : TechnologyTier.Standard,
        effect: card.effect
    }))

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
