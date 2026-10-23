import type { AxialCoordinates } from '@tabletop/common'
import { getHex, HexKind, planetCoordinates } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { planetsInSightOf } from './lineOfSight.js'

export function downloadAnchorsFor(
    state: HydratedEarendelGameState,
    playerId: string
): AxialCoordinates[] {
    const held = new Set(state.getPlayerState(playerId).technologies)

    return planetCoordinates(state.board).filter((coords) => {
        const hex = getHex(state.board, coords)
        return (
            hex?.technology !== undefined &&
            held.has(hex.technology.id) &&
            hex.technology.effect?.kind === TechnologyEffectKind.ImmediateDownload
        )
    })
}

export function downloadTargetsFrom(
    state: HydratedEarendelGameState,
    playerId: string,
    anchor: AxialCoordinates
): AxialCoordinates[] {
    const held = new Set(state.getPlayerState(playerId).technologies)

    return planetsInSightOf(state.board, anchor).filter((coords) => {
        const hex = getHex(state.board, coords)
        if (hex?.kind !== HexKind.Planet) return false
        if (!hex.explored || !hex.technology) return false
        if (hex.technology.effect?.kind === TechnologyEffectKind.ImmediateDownload) return false
        return !held.has(hex.technology.id)
    })
}
