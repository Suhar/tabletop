export type FinalStanding = {
    playerId: string
    rank: number
    score: number
}

export function rankStandings(scores: { playerId: string; score: number }[]): FinalStanding[] {
    const sorted = scores.toSorted((a, b) => b.score - a.score)
    return sorted.map(({ playerId, score }) => ({
        playerId,
        score,
        rank: 1 + sorted.filter((other) => other.score > score).length
    }))
}
