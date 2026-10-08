import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { RailroadId } from '../components/railroads.js'
import { ACTION_TRACK_LIMIT } from '../model/actionBoxes.js'
import { AuctionKind } from '../model/auction.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { openShareAuction, type ShareSale } from '../model/shareAuctionRules.js'
import { homeLinks } from '../model/track.js'
import { freeBuildHome } from '../model/freeBuild.js'

// After a turn's action and any ZASM opening: dividends when the track passes 35, else the
// next player's turn.
export function finishTurnAction(state: HydratedSarGameState): MachineState {
    if (state.actionTrack > ACTION_TRACK_LIMIT) {
        return MachineState.PayingDividends
    }
    return endTurn(state)
}

export function endTurn(state: HydratedSarGameState): MachineState {
    state.turnManager.endTurn(state.actionCount)
    return MachineState.ChoosingAction
}

export function openZasm(state: HydratedSarGameState): MachineState {
    openShareAuction(state, {
        kind: AuctionKind.ZasmOpening,
        railroadId: RailroadId.ZASM,
        openerId: state.turnPlayerId(),
        minimum: 0
    })
    return MachineState.Bidding
}

export function openNextInitialOffering(
    state: HydratedSarGameState,
    openerId: string
): MachineState {
    const railroadId = state.nextInitialOffering()
    if (railroadId === undefined) {
        return MachineState.ChoosingAction
    }
    openShareAuction(state, {
        kind: AuctionKind.InitialOffering,
        railroadId,
        openerId,
        minimum: 0
    })
    return MachineState.Bidding
}

// Where play goes once a share has been sold, or found no buyer.
export function afterSale(state: HydratedSarGameState, sale: ShareSale): MachineState {
    if (sale.kind === AuctionKind.OfferStock) {
        return finishTurnAction(state)
    }
    assertExists(sale.buyerId, 'Opening offerings always find an owner')
    if (homeLinks(state, freeBuildHome(sale.railroadId)).length > 0) {
        state.freeBuild = { railroadId: sale.railroadId, playerId: sale.buyerId }
        return MachineState.FreeBuild
    }
    return afterFreeBuild(state, sale.railroadId, sale.buyerId)
}

export function afterFreeBuild(
    state: HydratedSarGameState,
    railroadId: RailroadId,
    builderId: string
): MachineState {
    return railroadId === RailroadId.ZASM
        ? finishTurnAction(state)
        : openNextInitialOffering(state, builderId)
}
