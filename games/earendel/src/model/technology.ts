import * as Type from 'typebox'
import { PlanetColor } from './planetColor.js'

// A technology card. Its colours are the planets it can be housed on - one, two or three of
// the five - which is how a planet's colour decides what it can ever hold.
//
// What a technology DOES is not modelled yet: the deck below is a placeholder that gets the
// colour distribution and the reveal rule right so the exploration flow can be built and
// played with. Effects (including "grants a special piece") come later, and will hang off
// this type rather than replace it.
// Standard or elevated. An elevated technology can't be passed over: if the reveal turns one
// up, the planet has to take an elevated one, and a standard card revealed alongside it is
// simply out of reach. So an elevated card is both a stronger prize and a loss of choice.
export enum TechnologyTier {
    Standard = 'standard',
    Elevated = 'elevated'
}

// What a technology does. One entry so far; each new effect is a new member here plus a
// branch wherever the timing says it fires.
export enum TechnologyEffectKind {
    // Immediate: on being chosen, move one friendly piece into an adjacent empty space.
    MoveFriendlyPiece = 'moveFriendlyPiece',
    // Immediate: lay a tile from the supply, then draw a ship and place it on that tile.
    GrowBoard = 'growBoard',
    // Stored: once, on a later turn, keep the ship a draft would have thrown away.
    LogisticsUpgrade = 'logisticsUpgrade',
    // Cooldown: a fighter's shot destroys its target outright rather than damaging it.
    Railgun = 'railgun',
    // Grant: hands over a Station Hub to keep in front of the player until they place it.
    StationUpgrade = 'stationUpgrade'
}

// When an effect happens. Immediate ones resolve the moment the technology is chosen; stored
// ones are put in front of the player and spent later, once each.
export enum TechnologyTiming {
    Immediate = 'immediate',
    Stored = 'stored',
    // Kept for good and usable again and again, but only so often: using it starts a timer,
    // counted in the owner's own turns, and it cannot be used again until that runs out.
    Cooldown = 'cooldown',
    // Hands over a piece the moment the technology is gained. Nothing to decide and nothing to
    // spend: the reward is the piece, and what it does is the piece's business.
    Grant = 'grant'
}

// How many of the owner's own turns a cooldown power sits idle. Used on a turn, it comes back on
// the third turn after it.
export const COOLDOWN_TURNS: Partial<Record<TechnologyEffectKind, number>> = {}

// Immediate effects resolve the moment the technology is chosen for the planet, inside the
// exploring player's own turn. Other timings - a standing power, a granted special piece -
// will need their own field here rather than being squeezed into this one.
export type TechnologyEffect = Type.Static<typeof TechnologyEffect>
export const TechnologyEffect = Type.Object({
    kind: Type.Enum(TechnologyEffectKind)
})

export type TechnologyCard = Type.Static<typeof TechnologyCard>
export const TechnologyCard = Type.Object({
    id: Type.String(),
    colors: Type.Array(Type.Enum(PlanetColor)),
    tier: Type.Enum(TechnologyTier),
    // Absent on a card that does nothing yet - most of the placeholder deck.
    effect: Type.Optional(TechnologyEffect)
})

// Whether choosing this card owes its player an action before the turn can end. A stored
// effect owes nothing now - it waits in front of them until they spend it.
export function hasImmediateEffect(card: TechnologyCard): boolean {
    return timingOf(card) === TechnologyTiming.Immediate
}

// What each effect is called and what it does, for anything that has to show a technology to
// a player. Kept beside the effects themselves so a new one cannot be added without a name.
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
    [TechnologyEffectKind.Railgun]: {
        name: 'Railgun',
        ability: "A fighter's attack destroys its target outright, whatever its health.",
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.StationUpgrade]: {
        name: 'Station Upgrade',
        ability:
            'Gain a Station Hub: a station that doubles the score of its cluster, when placed and thereafter.',
        timing: TechnologyTiming.Grant
    }
}

COOLDOWN_TURNS[TechnologyEffectKind.Railgun] = 3

export function timingOf(card: TechnologyCard): TechnologyTiming | undefined {
    return card.effect ? TECHNOLOGY_EFFECT_INFO[card.effect.kind].timing : undefined
}

// The effect this card puts in front of its new owner to spend later, if any.
export function storedEffectOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return timingOf(card) === TechnologyTiming.Stored ? card.effect!.kind : undefined
}

// The kind of piece this card hands over on being gained, if any.
export function grantedPieceOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return timingOf(card) === TechnologyTiming.Grant ? card.effect!.kind : undefined
}

// The repeatable-but-rationed power this card confers, if any. Held for good rather than spent,
// so a second copy of the same card adds nothing.
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

// Which of the revealed matching cards the explorer may actually take.
//
// An elevated card forces the hand: reveal one and it must be housed, so the standard cards
// alongside it drop out. Reveal several and the choice is between those. Reveal none and
// every match is on the table as before.
export function choosableFrom(candidates: TechnologyCard[]): TechnologyCard[] {
    const elevated = candidates.filter(isElevated)
    return elevated.length > 0 ? elevated : candidates
}
