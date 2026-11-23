import { assertExists } from '@tabletop/common'
import { PLANET_COLORS, PlanetColor } from './planetColor.js'
import {
    ELEVATED_PAIRS,
    TECHNOLOGY_CATEGORY,
    TECHNOLOGY_CATEGORY_INFO,
    TechnologyCategory,
    type TechnologyCard,
    TechnologyEffectKind,
    TechnologyTier
} from './technology.js'

// rules.md, Technology deck: every technology is on the same number of standard cards.
export const COPIES_PER_TECHNOLOGY = 2

const CATEGORY_TECHNOLOGIES: Record<TechnologyCategory, readonly TechnologyEffectKind[]> = {
    [TechnologyCategory.Belligerence]: [
        TechnologyEffectKind.UpdatedLogistics,
        TechnologyEffectKind.Railgun,
        TechnologyEffectKind.GammaTorpedo,
        TechnologyEffectKind.FullTorpedoSpread,
        TechnologyEffectKind.Interdiction,
        TechnologyEffectKind.BastionWorks
    ],
    [TechnologyCategory.Mobility]: [
        TechnologyEffectKind.MoveFriendlyPiece,
        TechnologyEffectKind.TacticalFeint,
        TechnologyEffectKind.WarpDrive,
        TechnologyEffectKind.DimensionalRift,
        TechnologyEffectKind.TradeRouteWormhole,
        TechnologyEffectKind.GateNetwork
    ],
    [TechnologyCategory.Acquisitions]: [
        TechnologyEffectKind.LogisticsUpgrade,
        TechnologyEffectKind.GrowBoard,
        TechnologyEffectKind.ColonyShip,
        TechnologyEffectKind.CarrierDoctrine,
        TechnologyEffectKind.DeepScan,
        TechnologyEffectKind.SalvageOperations
    ],
    [TechnologyCategory.Espionage]: [
        TechnologyEffectKind.ImmediateDownload,
        TechnologyEffectKind.SpoofedOrders,
        TechnologyEffectKind.SecurityBreach,
        TechnologyEffectKind.RelayNetwork,
        TechnologyEffectKind.Quarantine,
        TechnologyEffectKind.JammerArray
    ],
    [TechnologyCategory.Expansion]: [
        TechnologyEffectKind.StationUpgrade,
        TechnologyEffectKind.Terraforming,
        TechnologyEffectKind.AsteroidField,
        TechnologyEffectKind.Conscription,
        TechnologyEffectKind.FactoryOverride,
        TechnologyEffectKind.ArtificialWorld,
        TechnologyEffectKind.NebulaSeeding
    ]
}

// The standard cards, by the category each technology belongs to.
export const CATEGORY_CARDS: Record<TechnologyCategory, readonly TechnologyEffectKind[]> = {
    [TechnologyCategory.Belligerence]: copies(TechnologyCategory.Belligerence),
    [TechnologyCategory.Mobility]: copies(TechnologyCategory.Mobility),
    [TechnologyCategory.Acquisitions]: copies(TechnologyCategory.Acquisitions),
    [TechnologyCategory.Espionage]: copies(TechnologyCategory.Espionage),
    [TechnologyCategory.Expansion]: copies(TechnologyCategory.Expansion)
}

function copies(category: TechnologyCategory): TechnologyEffectKind[] {
    return Array.from(
        { length: COPIES_PER_TECHNOLOGY },
        () => CATEGORY_TECHNOLOGIES[category]
    ).flat()
}

// rules.md, Elevated technologies: each color's two elevated cards, single-color. The game
// deals one of each color's pair into the deck at setup.
export const ELEVATED_CARDS: readonly TechnologyCard[] = PLANET_COLORS.flatMap((color) => {
    const pair = ELEVATED_PAIRS[color]
    return [pair.event, pair.rule].map((effect) => ({
        id: elevatedCardId(effect),
        colors: [color],
        tier: TechnologyTier.Elevated,
        effect
    }))
})

export function elevatedCardId(effect: TechnologyEffectKind): string {
    return `elevated-${effect}`
}

export function elevatedCard(effect: TechnologyEffectKind): TechnologyCard {
    return technologyCard(elevatedCardId(effect))
}

export const FOCUSED_COPIES_PER_COLOR = 12

// rules.md, Technology deck: a technology belongs to its category's color alone, unless it
// truly belongs to a second theme as well, when every copy of it carries that color too. Two
// technologies of each category do, and each color is lent to two technologies from elsewhere.
export const SECOND_THEME: Partial<Record<TechnologyEffectKind, TechnologyCategory>> = {
    // It closes hexes to movement.
    [TechnologyEffectKind.Interdiction]: TechnologyCategory.Mobility,
    // A fortification, standing as a station does.
    [TechnologyEffectKind.BastionWorks]: TechnologyCategory.Expansion,
    // A swap is a deception.
    [TechnologyEffectKind.TacticalFeint]: TechnologyCategory.Espionage,
    // It runs between the planets a player has a hold on.
    [TechnologyEffectKind.TradeRouteWormhole]: TechnologyCategory.Acquisitions,
    // An extra ship on the board grows the fleet.
    [TechnologyEffectKind.LogisticsUpgrade]: TechnologyCategory.Expansion,
    // It takes what was a rival's for its own.
    [TechnologyEffectKind.SalvageOperations]: TechnologyCategory.Espionage,
    // It turns a rival's piece against its owner's plans.
    [TechnologyEffectKind.SpoofedOrders]: TechnologyCategory.Belligerence,
    // It strips the cover from what it reaches.
    [TechnologyEffectKind.JammerArray]: TechnologyCategory.Belligerence,
    // A new planet is a new one to hold.
    [TechnologyEffectKind.ArtificialWorld]: TechnologyCategory.Acquisitions,
    // Nebula closes space to movement.
    [TechnologyEffectKind.NebulaSeeding]: TechnologyCategory.Mobility
}

export function technologyColors(effect: TechnologyEffectKind): PlanetColor[] {
    const second = SECOND_THEME[effect]
    return [
        TECHNOLOGY_CATEGORY_INFO[TECHNOLOGY_CATEGORY[effect]].color,
        ...(second ? [TECHNOLOGY_CATEGORY_INFO[second].color] : [])
    ]
}

// A standard card is named for its technology and which copy of it this is, so an id means
// the same card whatever else joins or leaves the deck.
export function standardCardId(effect: TechnologyEffectKind, copy: number): string {
    return `${effect}-${copy}`
}

export const FULL_TECHNOLOGY_DECK: readonly TechnologyCard[] = Object.values(
    TechnologyCategory
).flatMap((category) =>
    Array.from({ length: COPIES_PER_TECHNOLOGY }, (_, copy) =>
        CATEGORY_TECHNOLOGIES[category].map((effect) => ({
            id: standardCardId(effect, copy + 1),
            colors: technologyColors(effect),
            tier: TechnologyTier.Standard,
            effect
        }))
    ).flat()
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
    [
        ...FULL_TECHNOLOGY_DECK,
        ...ELEVATED_CARDS,
        ...[...FOCUSED_TECHNOLOGY_DECKS.values()].flat()
    ].map((card) => [card.id, card])
)

export function technologyCard(id: string): TechnologyCard {
    const card = TECHNOLOGY_CARDS_BY_ID.get(id)
    assertExists(card, `Unknown technology card ${id}`)
    return card
}
