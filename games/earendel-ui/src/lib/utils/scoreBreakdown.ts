import type { GameAction } from '@tabletop/common'
import { scoreSourcesOf } from './actionEffects.js'

// Where a player's points come from: the banked kinds, read back from the history, and the
// planet points they would add if the game ended now.
export type ScoreBreakdown = {
    playerId: string
    rank: number
    complexes: number
    chains: number
    // Banked points the history does not account for, such as those before a truncated history.
    other: number
    banked: number
    planets: number
    total: number
}

export function scoreBreakdown(
    actions: readonly GameAction[],
    scores: { playerId: string; score: number }[],
    planetPoints: Record<string, number>
): ScoreBreakdown[] {
    const complexes = new Map<string, number>()
    const chains = new Map<string, number>()
    for (const action of actions) {
        for (const source of scoreSourcesOf(action)) {
            const bucket = source.caption === 'complex' ? complexes : chains
            bucket.set(source.playerId, (bucket.get(source.playerId) ?? 0) + source.points)
        }
    }

    const rows = scores.map(({ playerId, score }) => {
        const fromComplexes = complexes.get(playerId) ?? 0
        const fromChains = chains.get(playerId) ?? 0
        const planets = planetPoints[playerId] ?? 0
        return {
            playerId,
            rank: 0,
            complexes: fromComplexes,
            chains: fromChains,
            other: Math.max(0, score - fromComplexes - fromChains),
            banked: score,
            planets,
            total: score + planets
        }
    })
    const sorted = rows.toSorted((a, b) => b.total - a.total)
    return sorted.map((row) => ({
        ...row,
        rank: 1 + sorted.filter((other) => other.total > row.total).length
    }))
}
