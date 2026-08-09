import { type EarendelBoard, planetControl, planetCoordinates } from '../model/board.js'

// What a controlled planet is worth when the game ends. Explored or not makes no difference
// yet - see rules.md, which flags that as a knob worth turning.
export const PLANET_END_GAME_POINTS = 1

// What planet control would pay each player if the game ended right now.
//
// Ties are not broken, so every player tied for the most power around a planet takes the
// full point - the same planet can pay two people. A planet ringed only by probes has no
// controller and pays nobody.
//
// Only awarded at the end, but computed from the board alone, so the UI can show a running
// projection without waiting for the game to be over.
export function planetPointsByPlayer(board: EarendelBoard): Record<string, number> {
    const points: Record<string, number> = {}

    for (const coords of planetCoordinates(board)) {
        for (const playerId of planetControl(board, coords).controllingPlayerIds) {
            points[playerId] = (points[playerId] ?? 0) + PLANET_END_GAME_POINTS
        }
    }

    return points
}
