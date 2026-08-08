import * as Type from 'typebox'
import { PlanetColor } from './board.js'

// A technology card. Its colours are the planets it can be housed on - one, two or three of
// the five - which is how a planet's colour decides what it can ever hold.
//
// What a technology DOES is not modelled yet: the deck below is a placeholder that gets the
// colour distribution and the reveal rule right so the exploration flow can be built and
// played with. Effects (including "grants a special piece") come later, and will hang off
// this type rather than replace it.
export type TechnologyCard = Type.Static<typeof TechnologyCard>
export const TechnologyCard = Type.Object({
    id: Type.String(),
    colors: Type.Array(Type.Enum(PlanetColor))
})

export function matchesColor(card: TechnologyCard, color: PlanetColor): boolean {
    return card.colors.includes(color)
}
