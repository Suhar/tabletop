export type FinalStanding = {
    playerId: string
    rank: number
    score: number
    planetPoints: number
}

export function rankStandings(
    scores: { playerId: string; score: number }[],
    planetPoints: Record<string, number>
): FinalStanding[] {
    const sorted = scores.toSorted((a, b) => b.score - a.score)
    return sorted.map(({ playerId, score }) => ({
        playerId,
        score,
        planetPoints: planetPoints[playerId] ?? 0,
        rank: 1 + sorted.filter((other) => other.score > score).length
    }))
}
