import { type EarendelBoard, planetControl, planetCoordinates } from '../model/board.js'

export const PLANET_END_GAME_POINTS = 1

export function planetPointsByPlayer(board: EarendelBoard): Record<string, number> {
    const points: Record<string, number> = {}

    for (const coords of planetCoordinates(board)) {
        for (const playerId of planetControl(board, coords).controllingPlayerIds) {
            points[playerId] = (points[playerId] ?? 0) + PLANET_END_GAME_POINTS
        }
    }

    return points
}
