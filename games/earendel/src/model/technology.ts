import { assertExists } from '@tabletop/common'
import { PlanetColor } from './planetColor.js'

export enum TechnologyTier {
    Standard = 'standard',
    Elevated = 'elevated'
}

export enum TechnologyEffectKind {
    MoveFriendlyPiece = 'moveFriendlyPiece',
    GrowBoard = 'growBoard',
    LogisticsUpgrade = 'logisticsUpgrade',
    ImmediateDownload = 'immediateDownload',
    Railgun = 'railgun',
    UpdatedLogistics = 'updatedLogistics',
    FullTorpedoSpread = 'fullTorpedoSpread',
    TacticalFeint = 'tacticalFeint',
    TradeRouteWormhole = 'tradeRouteWormhole',
    StationUpgrade = 'stationUpgrade',
    Terraforming = 'terraforming'
}

export enum TechnologyTiming {
    Immediate = 'immediate',
    Stored = 'stored',
    Cooldown = 'cooldown',
    Grant = 'grant'
}

export const COOLDOWN_TURNS = 3

// Each category owns a planet colour (rules.md, Technology deck).
export enum TechnologyCategory {
    Belligerence = 'belligerence',
    Mobility = 'mobility',
    Acquisitions = 'acquisitions',
    Espionage = 'espionage',
    Expansion = 'expansion'
}

export const TECHNOLOGY_CATEGORY_INFO: Record<
    TechnologyCategory,
    { name: string; description: string; color: PlanetColor }
> = {
    [TechnologyCategory.Belligerence]: {
        name: 'Belligerence',
        description: 'Techs that improve combat ability.',
        color: PlanetColor.Violet
    },
    [TechnologyCategory.Mobility]: {
        name: 'Mobility',
        description: 'Techs that allow movement.',
        color: PlanetColor.Aqua
    },
    [TechnologyCategory.Acquisitions]: {
        name: 'Acquisitions',
        description: 'Techs that expand and control.',
        color: PlanetColor.Mint
    },
    [TechnologyCategory.Espionage]: {
        name: 'Espionage',
        description: 'Techs that mimic and steal.',
        color: PlanetColor.Periwinkle
    },
    [TechnologyCategory.Expansion]: {
        name: 'Expansion',
        description: 'Techs that grow the fleet.',
        color: PlanetColor.Teal
    }
}

// The category whose colour a planet has, so its cards mostly come from that category.
export function categoryOfColor(color: PlanetColor): TechnologyCategory {
    const found = Object.values(TechnologyCategory).find(
        (category) => TECHNOLOGY_CATEGORY_INFO[category].color === color
    )
    assertExists(found, `No category owns ${color} planets`)
    return found
}

export const TECHNOLOGY_CATEGORY: Record<TechnologyEffectKind, TechnologyCategory> = {
    [TechnologyEffectKind.Railgun]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.FullTorpedoSpread]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.UpdatedLogistics]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.MoveFriendlyPiece]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.TacticalFeint]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.TradeRouteWormhole]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.LogisticsUpgrade]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.GrowBoard]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.ImmediateDownload]: TechnologyCategory.Espionage,
    [TechnologyEffectKind.StationUpgrade]: TechnologyCategory.Expansion,
    [TechnologyEffectKind.Terraforming]: TechnologyCategory.Expansion
}

export type TechnologyCard = {
    readonly id: string
    readonly colors: readonly PlanetColor[]
    readonly tier: TechnologyTier
    readonly effect: TechnologyEffectKind
}

export function hasImmediateEffect(card: TechnologyCard): boolean {
    return timingOf(card) === TechnologyTiming.Immediate
}

export const TECHNOLOGY_EFFECT_INFO: Record<
    TechnologyEffectKind,
    { name: string; ability: string; timing: TechnologyTiming }
> = {
    [TechnologyEffectKind.MoveFriendlyPiece]: {
        name: 'Tactical Shift',
        ability: 'Move any friendly piece into an adjacent empty space.',
        timing: TechnologyTiming.Immediate
    },
    [TechnologyEffectKind.GrowBoard]: {
        name: 'Beyond the Frontier',
        ability: 'Lay a new tile against the board, then place a drawn ship on it.',
        timing: TechnologyTiming.Immediate
    },
    [TechnologyEffectKind.LogisticsUpgrade]: {
        name: 'Logistics Upgrade',
        ability: 'Once, on a later turn, place the ship you would otherwise discard.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.ImmediateDownload]: {
        name: 'Immediate Download',
        ability:
            'Once: gain the technology of any explored planet with a clear line of sight to this one. It is available at once.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.Railgun]: {
        name: 'Railgun',
        ability: "A fighter's attack destroys its target outright, whatever its health.",
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.FullTorpedoSpread]: {
        name: 'Full Torpedo Spread',
        ability: 'When a fighter attacks, it may hit any or all of its neighbours.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.UpdatedLogistics]: {
        name: 'Updated Logistics',
        ability: 'A fighter already on the board may attack one of its neighbours.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.TacticalFeint]: {
        name: 'Tactical Feint',
        ability:
            'Swap one of your ships with an adjacent enemy ship. Your ship counts as newly placed.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.TradeRouteWormhole]: {
        name: 'Trade Route Wormhole',
        ability:
            'Move one of your ships from beside a planet to beside a different planet of the same colour. Your ship counts as newly placed.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.StationUpgrade]: {
        name: 'Station Upgrade',
        ability:
            'Gain a Station Hub: a station that doubles the score of its cluster, when placed and thereafter.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.Terraforming]: {
        name: 'Terraforming',
        ability:
            'Gain a Terraformer: placed beside a planet no terraformer touches, it may change that planet to another colour. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    }
}

export function timingOf(card: TechnologyCard): TechnologyTiming {
    return TECHNOLOGY_EFFECT_INFO[card.effect].timing
}

function effectWithTiming(
    card: TechnologyCard,
    timing: TechnologyTiming
): TechnologyEffectKind | undefined {
    return timingOf(card) === timing ? card.effect : undefined
}

export function storedEffectOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return effectWithTiming(card, TechnologyTiming.Stored)
}

export function grantedPieceOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return effectWithTiming(card, TechnologyTiming.Grant)
}

export function cooldownEffectOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return effectWithTiming(card, TechnologyTiming.Cooldown)
}

export function technologyName(card: TechnologyCard): string {
    return TECHNOLOGY_EFFECT_INFO[card.effect].name
}

export function technologyAbility(card: TechnologyCard): string {
    return TECHNOLOGY_EFFECT_INFO[card.effect].ability
}

export function matchesColor(card: TechnologyCard, color: PlanetColor): boolean {
    return card.colors.includes(color)
}

export function isElevated(card: TechnologyCard): boolean {
    return card.tier === TechnologyTier.Elevated
}

export function choosableFrom(candidates: TechnologyCard[]): TechnologyCard[] {
    const elevated = candidates.filter(isElevated)
    return elevated.length > 0 ? elevated : candidates
}
