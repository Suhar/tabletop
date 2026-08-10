import * as Type from 'typebox'
import { PlanetColor } from './board.js'

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

export type TechnologyCard = Type.Static<typeof TechnologyCard>
export const TechnologyCard = Type.Object({
    id: Type.String(),
    colors: Type.Array(Type.Enum(PlanetColor)),
    tier: Type.Enum(TechnologyTier)
})

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
