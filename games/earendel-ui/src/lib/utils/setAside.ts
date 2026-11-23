import type { GameAction } from '@tabletop/common'
import { isChoosePlanet, technologyCard, type TechnologyCard } from '@tabletop/earendel'

// The cards a survey turned up that the planet could not take, which go back under the deck:
// everything it flipped that was not offered. Read from the action's metadata, like the rest of the history.
export function setAsideBy(action: GameAction): TechnologyCard[] {
    if (!isChoosePlanet(action)) return []
    const offered = new Set(action.metadata?.candidates ?? [])
    return (action.metadata?.flipped ?? [])
        .filter((technologyId) => !offered.has(technologyId))
        .map(technologyCard)
}
