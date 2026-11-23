import { RouteChangeMetadata, type TradeRoute } from '../model/chains.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import {
    claimChanges,
    ClaimChangeMetadata,
    type ClaimSnapshot,
    snapshotClaims
} from './claimChanges.js'
import { routeChanges } from './tradeRoutes.js'

// The optional metadata fields every action that can change where pieces stand carries.
export const StandingChangeMetadata = { ...ClaimChangeMetadata, ...RouteChangeMetadata }

export type StandingSnapshot = { claims: ClaimSnapshot; routes: TradeRoute[] }

export function snapshotStanding(state: HydratedEarendelGameState): StandingSnapshot {
    return { claims: snapshotClaims(state), routes: [...state.tradeRoutes] }
}

export function standingChanges(before: StandingSnapshot, state: HydratedEarendelGameState) {
    return { ...claimChanges(before.claims, state), ...routeChanges(before.routes, state) }
}
