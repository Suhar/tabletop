import * as Type from 'typebox'
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
    StationUpgrade = 'stationUpgrade'
}

export enum TechnologyTiming {
    Immediate = 'immediate',
    Stored = 'stored',
    Cooldown = 'cooldown',
    Grant = 'grant'
}

export const COOLDOWN_TURNS = 3

export type TechnologyEffect = Type.Static<typeof TechnologyEffect>
export const TechnologyEffect = Type.Object({
    kind: Type.Enum(TechnologyEffectKind)
})

export type TechnologyCard = Type.Static<typeof TechnologyCard>
export const TechnologyCard = Type.Object({
    id: Type.String(),
    colors: Type.Array(Type.Enum(PlanetColor)),
    tier: Type.Enum(TechnologyTier),
    effect: Type.Optional(TechnologyEffect)
})

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
    }
}

export function timingOf(card: TechnologyCard): TechnologyTiming | undefined {
    return card.effect ? TECHNOLOGY_EFFECT_INFO[card.effect.kind].timing : undefined
}

export function storedEffectOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return timingOf(card) === TechnologyTiming.Stored ? card.effect!.kind : undefined
}

export function grantedPieceOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return timingOf(card) === TechnologyTiming.Grant ? card.effect!.kind : undefined
}

export function cooldownEffectOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return timingOf(card) === TechnologyTiming.Cooldown ? card.effect!.kind : undefined
}

export function technologyName(card: TechnologyCard): string {
    return card.effect ? TECHNOLOGY_EFFECT_INFO[card.effect.kind].name : 'Uncharted'
}

export function technologyAbility(card: TechnologyCard): string {
    return card.effect
        ? TECHNOLOGY_EFFECT_INFO[card.effect.kind].ability
        : 'Nothing yet - this technology has no effect.'
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
