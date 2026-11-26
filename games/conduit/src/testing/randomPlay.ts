import { assert, assertExists, type RandomFunction } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { extraCubesPrice, MaxExtraCubes } from '../model/rules.js'
import type { TestSession } from './table.js'

export function playRandomDecision(session: TestSession, random: RandomFunction) {
    const state = session.hydrated()
    const pick = <T>(items: readonly T[]): T => {
        assert(items.length > 0, 'There is something to choose from')
        return items[Math.floor(random() * items.length)]
    }
    switch (state.machineState) {
        case MachineState.Bidding: {
            const mayPass = state.canPassBid(session.activePlayerId())
            if (mayPass && random() < 0.4) {
                session.passBid()
            } else {
                session.bid(pick(state.biddableSpots()))
            }
            return
        }
        case MachineState.Offering: {
            const playerId = session.activePlayerId()
            if (state.canAfford(playerId) && random() < 0.6) {
                session.buy()
            } else {
                session.pass()
            }
            return
        }
        case MachineState.Placing: {
            const placement = state.pendingPlacement()
            assertExists(placement, 'A tile is waiting to be placed')
            const option = pick(state.grid().legalPlacements(placement.tileId, placement.faceUp))
            const player = state.getPlayerState(placement.playerId)
            let most = Math.min(player.supply, MaxExtraCubes)
            while (most > 0 && extraCubesPrice(most) > player.cash) {
                most -= 1
            }
            const extraCubes = placement.faceUp ? Math.floor(random() * (most + 1)) : 0
            session.place(option.cell, pick(option.rotations), extraCubes)
            return
        }
        case MachineState.ChoosingRoutes: {
            const choice = state.pendingRouteChoice()
            assertExists(choice, 'A route is waiting to be chosen')
            session.chooseRoute(Math.floor(random() * choice.options.length))
            return
        }
        default:
            throw Error(`No player decision in ${state.machineState}`)
    }
}
