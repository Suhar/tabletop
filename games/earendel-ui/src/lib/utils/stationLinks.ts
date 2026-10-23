import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, hexKey, neighborsOf, PieceType } from '@tabletop/earendel'

export type StationTube = {
    from: AxialCoordinates
    to: AxialCoordinates
    playerId: string
    fromHub: boolean
    toHub: boolean
}

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

export function stationTubeKey(tube: StationTube): string {
    return [hexKey(tube.from), hexKey(tube.to)].sort((a, b) => a - b).join(':')
}

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
