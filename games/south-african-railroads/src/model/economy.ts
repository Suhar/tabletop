import { incomeLevels, link } from '../components/map.js'
import type { RailroadId } from '../components/railroads.js'
import { SHARES_PER_RAILROAD } from '../components/railroads.js'
import { railroadLinkIds, type TrackState } from './track.js'

export type DevelopmentState = { developments: Record<string, number> }

export function developmentLevel(state: DevelopmentState, settlementId: string): number {
    return state.developments[settlementId] ?? 0
}

export function settlementIncome(state: DevelopmentState, settlementId: string): number {
    return incomeLevels(settlementId)[developmentLevel(state, settlementId)]
}

export function linkIncome(state: DevelopmentState, linkId: string): number {
    const [a, b] = link(linkId).ends
    return settlementIncome(state, a) + settlementIncome(state, b)
}

export function railroadIncome(state: TrackState & DevelopmentState, railroadId: RailroadId) {
    return railroadLinkIds(state, railroadId).reduce(
        (sum, linkId) => sum + linkIncome(state, linkId),
        0
    )
}

export function dividendPerShare(income: number): number {
    return Math.ceil(income / SHARES_PER_RAILROAD)
}

export function specialDividendPerShare(income: number): number {
    return Math.floor(income / SHARES_PER_RAILROAD)
}

export function finalPayoffPerShare(value: number, income: number, sharesSold: number): number {
    return sharesSold === 0 ? 0 : Math.ceil((value + income) / sharesSold)
}

export function minimumBid(value: number): number {
    return Math.ceil(value / SHARES_PER_RAILROAD)
}
