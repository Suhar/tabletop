import type { AxialCoordinates } from '@tabletop/common'
import { dominantPlayerId, type EarendelBoard, getHex, HexKind, neighborsOf } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'

// Technologies a placement just handed its owner: those on explored planets the placement
// gave them OUTRIGHT hold of, and which they don't already hold.
//
// Outright, not merely tied - matching an opponent's presence is not a way to copy what they
// hold (see dominantPlayerId). Only the placing player can gain anything here, since a
// placement only ever adds to the placer's power: it can make them dominant, or break
// someone else's dominance, but it can never make a third party dominant.
//
// Players who lose a planet keep everything they had already gained; a technology, once
// gained, is never lost, and never gained twice by the same player.
// Written around a hex rather than around a player because a board change cuts both ways: a
// placement hands technology to the placer, but a DESTRUCTION can hand it to whoever is left
// standing next to the planet, who may have had nothing to do with the attack.
export function technologiesGainedAround(
    board: EarendelBoard,
    coords: AxialCoordinates,
    held: Record<string, string[]>
): Record<string, string[]> {
    const gained: Record<string, string[]> = {}

    for (const neighbor of neighborsOf(coords)) {
        const hex = getHex(board, neighbor)
        if (hex?.kind !== HexKind.Planet || !hex.technology) continue

        const playerId = dominantPlayerId(board, neighbor)
        if (!playerId) continue
        if ((held[playerId] ?? []).includes(hex.technology.id)) continue
        if ((gained[playerId] ?? []).includes(hex.technology.id)) continue

        gained[playerId] = [...(gained[playerId] ?? []), hex.technology.id]
    }

    return gained
}

// What one player gains from a change at this hex.
export function technologiesGainedBy(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates,
    alreadyHeld: string[]
): string[] {
    return technologiesGainedAround(board, coords, { [playerId]: alreadyHeld })[playerId] ?? []
}

// Credits every player who now holds a neighbouring planet outright, and reports what each
// gained. The board must already be in its new shape when this is called.
export function applyTechnologyGains(
    state: HydratedEarendelGameState,
    coords: AxialCoordinates
): Record<string, string[]> {
    const held = Object.fromEntries(
        state.players.map((player) => [player.playerId, player.technologies])
    )
    const gained = technologiesGainedAround(state.board, coords, held)

    for (const [playerId, technologies] of Object.entries(gained)) {
        state.getPlayerState(playerId).technologies.push(...technologies)
    }

    return gained
}
