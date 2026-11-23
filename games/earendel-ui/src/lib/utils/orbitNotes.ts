import type { GameAction } from '@tabletop/common'
import { ActionType, isChooseTechnology, isDrawPieces } from '@tabletop/earendel'

// Probes that left the board for a planet's orbit, and the technologies that sent them there:
// a claim paying at the draw, or an elevated technology discovered and taking effect at once.
export type OrbitNote = {
    key: string
    playerId: string
    probes: number
    technologyIds: string[]
    // Discovered and in effect at once, where a paid claim's technology is gained and kept.
    elevated: boolean
}

// What the player does with a drawn piece. Once one of these follows a note the note has been
// read, and it goes.
const PLAYS: readonly string[] = [ActionType.PlacePiece, ActionType.PlaceTile, ActionType.PlayScrap]

export function orbitNotes(actions: readonly GameAction[]): OrbitNote[] {
    const notes: OrbitNote[] = []
    for (const action of actions) {
        if (PLAYS.includes(action.type)) {
            notes.length = 0
            continue
        }
        if (!action.playerId) continue
        if (isDrawPieces(action)) {
            const probes = action.metadata?.orbited?.length ?? 0
            const technologyIds = action.metadata?.technologiesClaimed ?? []
            if (probes === 0 || technologyIds.length === 0) continue
            notes.push({
                key: action.id,
                playerId: action.playerId,
                probes,
                technologyIds,
                elevated: false
            })
        } else if (isChooseTechnology(action)) {
            const probes = action.metadata?.orbited?.length ?? 0
            const technologyId = action.metadata?.technologyId
            if (probes === 0 || !technologyId) continue
            notes.push({
                key: action.id,
                playerId: action.playerId,
                probes,
                technologyIds: [technologyId],
                elevated: true
            })
        }
    }
    return notes
}
