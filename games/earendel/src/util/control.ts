import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, hexKey, planetControl, planetCoordinates } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'

// Sticky: a tie keeps the incumbent (rules.md, Control and scoring).
export function controllerAfter(
    board: EarendelBoard,
    coords: AxialCoordinates,
    incumbent: string | undefined
): string | undefined {
    const { controllingPlayerIds } = planetControl(board, coords)

    if (controllingPlayerIds.length === 0) return undefined
    if (controllingPlayerIds.length === 1) return controllingPlayerIds[0]

    return incumbent && controllingPlayerIds.includes(incumbent) ? incumbent : undefined
}

export function controllerKey(coords: AxialCoordinates): string {
    return String(hexKey(coords))
}

export function refreshPlanetControl(state: HydratedEarendelGameState) {
    const next: Record<string, string> = {}

    for (const coords of planetCoordinates(state.board)) {
        const key = controllerKey(coords)
        const controller = controllerAfter(state.board, coords, state.planetControllers?.[key])
        if (controller) next[key] = controller
    }

    state.planetControllers = next
}

export function controllerOf(
    state: HydratedEarendelGameState,
    coords: AxialCoordinates
): string | undefined {
    return state.planetControllers?.[controllerKey(coords)]
}
