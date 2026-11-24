import type { GameAction } from '@tabletop/common'
import { isPass } from '@tabletop/earendel'

// Why the game is over, in a sentence for the history: a player with nowhere to place the ship
// they drew, or a player whose bag is empty (rules.md, End of the game).
export function gameEndReason(
    players: readonly { playerId: string; bag: { remaining: number } }[],
    actions: readonly GameAction[],
    nameOf: (playerId: string) => string
): string {
    const last = actions.at(-1)
    if (last && isPass(last) && last.playerId) {
        return `${nameOf(last.playerId)} drew a ship with nowhere legal to place it, and had no special unit to place instead.`
    }
    const emptied = players
        .filter((player) => player.bag.remaining === 0)
        .map((player) => nameOf(player.playerId))
    if (emptied.length === 0) return ''
    return `${emptied.join(' and ')} played the last piece from their bag. There is no final round.`
}
