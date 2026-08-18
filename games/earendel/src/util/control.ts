import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, hexKey, planetControl, planetCoordinates } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'

// Who controls a planet, once and for all - and, crucially, who KEEPS controlling it.
//
// Control is sticky, because the only way to GAIN a planet is to have the most power beside it.
// A tie therefore changes nothing: the player already holding it goes on holding it, and the
// challenger who merely drew level has achieved nothing yet. Without that, arriving with equal
// power would knock the incumbent out and leave the planet held by nobody - which reads as though
// matching someone were as good as beating them, and quietly cancelled their technology timer as
// well.
//
// The incumbent keeps it only while still tied for the lead. Fall behind, or lose every piece
// beside the planet, and it is gone: a controller who is no longer among the strongest is not an
// incumbent, just a former one.
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

// Recomputes every planet's controller against the board as it now stands. Called at the end of
// anything that moves a piece, removes one, or adds hexes - which is why it walks the whole board
// rather than one planet: a single shot can change who holds several planets, and a new tile
// brings planets that have never had a controller at all.
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
