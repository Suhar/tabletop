import type { GameAction } from '@tabletop/common'
import { isDrawPieces } from '@tabletop/earendel'
import { scoreSourcesOf } from './actionEffects.js'

// Where a player's points come from: the banked kinds, read back from the history.
export type ScoreBreakdown = {
    playerId: string
    rank: number
    complexes: number
    routes: number
    // Bounties, and the points for controlling a planet of every color.
    bonus: number
    // Banked points the history does not account for, such as those before a truncated history.
    other: number
    total: number
}

export function scoreBreakdown(
    actions: readonly GameAction[],
    scores: { playerId: string; score: number }[]
): ScoreBreakdown[] {
    const complexes = new Map<string, number>()
    const routes = new Map<string, number>()
    const bonus = new Map<string, number>()
    const buckets = { complex: complexes, route: routes, bounty: bonus }
    for (const action of actions) {
        for (const source of scoreSourcesOf(action)) {
            const bucket = buckets[source.caption]
            bucket.set(source.playerId, (bucket.get(source.playerId) ?? 0) + source.points)
        }
        if (isDrawPieces(action) && action.metadata?.fiveColorPoints) {
            bonus.set(
                action.playerId,
                (bonus.get(action.playerId) ?? 0) + action.metadata.fiveColorPoints
            )
        }
    }

    const rows = scores.map(({ playerId, score }) => {
        const fromComplexes = complexes.get(playerId) ?? 0
        const fromRoutes = routes.get(playerId) ?? 0
        const fromBonus = bonus.get(playerId) ?? 0
        return {
            playerId,
            rank: 0,
            complexes: fromComplexes,
            routes: fromRoutes,
            bonus: fromBonus,
            other: Math.max(0, score - fromComplexes - fromRoutes - fromBonus),
            total: score
        }
    })
    const sorted = rows.toSorted((a, b) => b.total - a.total)
    return sorted.map((row) => ({
        ...row,
        rank: 1 + sorted.filter((other) => other.total > row.total).length
    }))
}
