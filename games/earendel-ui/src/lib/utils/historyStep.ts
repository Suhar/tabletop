import { ActionSource, type GameAction } from '@tabletop/common'

// The History Step that produced the latest state: the last User Action and the System Actions
// that followed it.
export function latestHistoryStep(actions: readonly GameAction[]): GameAction[] {
    const start = actions.findLastIndex((action) => action.source === ActionSource.User)
    return actions.slice(Math.max(start, 0))
}
