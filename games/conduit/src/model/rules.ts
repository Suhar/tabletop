// The fixed numbers of the rules (v0.8.4).

export const Rounds = 5
// Cubes on a bid track, and so the most a tile can cost: $1 plus a dollar a cube.
export const BidTrackSpaces = 10
export const BasePrice = 1
// No player may pass in bidding before placing this many cubes.
export const MinimumBids = 2
// Cubes each player moves from reserve to supply at the end of a round, except the fifth.
export const CubesPerRound = 3
// Extra cubes a buyer may add to a new station beside the winning cube.
export const MaxExtraCubes = 3

// The first extra cube costs $1, the second $2 and the third $3, paid to the bank.
export function extraCubesPrice(extraCubes: number): number {
    return (extraCubes * (extraCubes + 1)) / 2
}

// Tiles in a round's market: one per player in the first round, one more than that after.
export function marketTiles(players: number, round: number): number {
    return round === 1 ? players : players + 1
}
