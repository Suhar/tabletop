import type { AxialCoordinates } from '@tabletop/common'
import { getHex, HexKind, planetCoordinates } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { technologyCard } from '../model/technologyCards.js'
import { planetsInSightOf } from './lineOfSight.js'

export function downloadAnchorsFor(
    state: HydratedEarendelGameState,
    playerId: string
): AxialCoordinates[] {
    const held = new Set(state.getPlayerState(playerId).technologies)

    return planetCoordinates(state.board).filter((coords) => {
        const technologyId = getHex(state.board, coords)?.technologyId
        return (
            technologyId !== undefined &&
            held.has(technologyId) &&
            isImmediateDownload(technologyId)
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
        if (!hex.explored || !hex.technologyId) return false
        if (isImmediateDownload(hex.technologyId)) return false
        return !held.has(hex.technologyId)
    })
}

function isImmediateDownload(technologyId: string): boolean {
    return technologyCard(technologyId).effect === TechnologyEffectKind.ImmediateDownload
}
