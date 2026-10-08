import * as Type from 'typebox'
import type { RailroadId } from '../components/railroads.js'
import type { HydratedSarGameState } from './gameState.js'

export type Payout = Type.Static<typeof Payout>
export const Payout = Type.Object({
    playerId: Type.String(),
    amount: Type.Number()
})

export type PerShare = { railroadId: RailroadId; perShare: number }

// Pays each player the per-share amount for every share they hold, from the bank.
export function payShareholders(state: HydratedSarGameState, rates: readonly PerShare[]): Payout[] {
    return state.players.map((player) => {
        const amount = rates.reduce(
            (sum, rate) => sum + rate.perShare * state.sharesHeld(rate.railroadId, player.playerId),
            0
        )
        player.cash += amount
        return { playerId: player.playerId, amount }
    })
}
