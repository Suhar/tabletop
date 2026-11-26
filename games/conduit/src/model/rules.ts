// Rules v0.8.4.

export const Rounds = 5
export const AuctionSpots = 6
export const BidTrackSpaces = 10
export const BasePrice = 1
export const MinimumBids = 2
export const CubesPerRound = 3
export const MaxExtraCubes = 3

export function extraCubesPrice(extraCubes: number): number {
    return (extraCubes * (extraCubes + 1)) / 2
}

export function marketTiles(players: number, round: number): number {
    return round === 1 ? players : players + 1
}
