import { type EarendelBoard, HexKind } from '../model/board.js'
import { TechnologyEffectKind, TechnologyTiming, timingOf } from '../model/technology.js'
import { technologyCard } from '../model/technologyCards.js'

// The elevated rules in force: those housed on a surveyed planet (rules.md, Elevated technologies).
// Read from the board so nothing has to be kept in step with it.
export function rulesInForce(board: EarendelBoard): TechnologyEffectKind[] {
    return Object.values(board.hexes).flatMap((hex) => {
        if (hex.kind !== HexKind.Planet || !hex.technologyId) return []
        const card = technologyCard(hex.technologyId)
        return timingOf(card) === TechnologyTiming.Rule ? [card.effect] : []
    })
}

export function ruleInForce(board: EarendelBoard, kind: TechnologyEffectKind): boolean {
    return rulesInForce(board).includes(kind)
}
