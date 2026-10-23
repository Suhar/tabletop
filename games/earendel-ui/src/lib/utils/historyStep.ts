import { ActionSource, type GameAction } from '@tabletop/common'

export function latestHistoryStep(actions: readonly GameAction[]): GameAction[] {
    const start = actions.findLastIndex((action) => action.source === ActionSource.User)
    return actions.slice(Math.max(start, 0))
}
