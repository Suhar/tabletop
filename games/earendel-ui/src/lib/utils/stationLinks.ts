import type { AxialCoordinates } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    hexKey,
    neighborsOf,
    PieceType
} from '@tabletop/earendel'

// Two of a player's stations side by side, joined by a girder.
export type StationTube = {
    from: AxialCoordinates
    to: AxialCoordinates
    playerId: string
    // Whether each end is a Station Hub, whose larger core the girder starts further out from.
    fromHub: boolean
    toHub: boolean
}

// The neighbours of a hex holding one of this player's stations: the links a station there has,
// or would have if it were placed.
export function linkedStationNeighbors(
    board: EarendelBoard,
    coords: AxialCoordinates,
    playerId: string
): AxialCoordinates[] {
    return neighborsOf(coords).filter((neighbor) => {
        const piece = getHex(board, neighbor)?.piece
        return piece?.type === PieceType.Station && piece.playerId === playerId
    })
}

// Identifies a girder by the pair of hexes it joins, whichever end it was found from.
export function stationTubeKey(tube: StationTube): string {
    return [hexKey(tube.from), hexKey(tube.to)].sort((a, b) => a - b).join(':')
}

// Every girder on a board. One entry per pair: the walk meets each pair from both ends, and
// drawing a girder twice would double it.
export function stationTubesOf(board: EarendelBoard): StationTube[] {
    const tubes: StationTube[] = []
    const seen = new Set<string>()

    for (const hex of Object.values(board.hexes)) {
        const station = hex.piece
        if (station?.type !== PieceType.Station) continue

        for (const neighbor of linkedStationNeighbors(board, hex.coords, station.playerId)) {
            const tube = {
                from: hex.coords,
                to: neighbor,
                playerId: station.playerId,
                fromHub: station.hub === true,
                toHub: getHex(board, neighbor)?.piece?.hub === true
            }
            const key = stationTubeKey(tube)
            if (seen.has(key)) continue
            seen.add(key)
            tubes.push(tube)
        }
    }

    return tubes
}
