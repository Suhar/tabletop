import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, sameCoordinates } from '@tabletop/common'
import { getHex } from '../model/board.js'
import { PlanetColor } from '../model/planetColor.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import type { ProbeClaim } from '../model/exploration.js'
import { probeTechnologiesFor } from './technologyGrants.js'

// A pending claim an action broke (its claimant no longer leads) or restored, recorded so the
// history can say so without reading the board.
export type ClaimChange = Type.Static<typeof ClaimChange>
export const ClaimChange = Type.Object({
    playerId: Type.String(),
    coords: AxialCoordinates,
    technologyId: Type.String(),
    color: Type.Optional(Type.Enum(PlanetColor))
})

// The optional metadata fields every action that can change a planet's lead carries.
export const ClaimChangeMetadata = {
    claimsBroken: Type.Optional(Type.Array(ClaimChange)),
    claimsRestored: Type.Optional(Type.Array(ClaimChange))
}

const ClaimChangeMetadataValidator = Compile(Type.Object(ClaimChangeMetadata))

// The claims any action's metadata says it broke or restored.
export function claimChangesOf(metadata: unknown): {
    broken: ClaimChange[]
    restored: ClaimChange[]
} {
    if (!ClaimChangeMetadataValidator.Check(metadata)) return { broken: [], restored: [] }
    return { broken: metadata.claimsBroken ?? [], restored: metadata.claimsRestored ?? [] }
}

export type ClaimSnapshot = { recorded: ProbeClaim[]; payable: ProbeClaim[] }

// Claims that would pay if settled now: the test each claimant's next turn applies.
export function payableClaims(state: HydratedEarendelGameState): ProbeClaim[] {
    const claimants = new Set(state.probeClaims.map((claim) => claim.playerId))
    return [...claimants].flatMap((playerId) => {
        const { researched } = probeTechnologiesFor(state, playerId)
        return state.probeClaims.filter(
            (claim) =>
                claim.playerId === playerId &&
                researched.some((coords) => sameCoordinates(coords, claim.coords))
        )
    })
}

export function snapshotClaims(state: HydratedEarendelGameState): ClaimSnapshot {
    return { recorded: [...state.probeClaims], payable: payableClaims(state) }
}

const sameClaim = (a: ProbeClaim, b: ProbeClaim) =>
    a.playerId === b.playerId && sameCoordinates(a.coords, b.coords)

// Claims recorded both before and after the action whose standing it changed. A claim that was
// settled, or newly made, by the action is neither broken nor restored.
export function claimChanges(
    before: ClaimSnapshot,
    state: HydratedEarendelGameState
): { claimsBroken?: ClaimChange[]; claimsRestored?: ClaimChange[] } {
    const payable = payableClaims(state)
    const stillRecorded = state.probeClaims.filter((claim) =>
        before.recorded.some((earlier) => sameClaim(earlier, claim))
    )
    const describe = (claim: ProbeClaim): ClaimChange => {
        const color = getHex(state.board, claim.coords)?.color
        return {
            playerId: claim.playerId,
            coords: claim.coords,
            technologyId: claim.technologyId,
            ...(color ? { color } : {})
        }
    }

    const broken = stillRecorded.filter(
        (claim) =>
            before.payable.some((earlier) => sameClaim(earlier, claim)) &&
            !payable.some((now) => sameClaim(now, claim))
    )
    const restored = stillRecorded.filter(
        (claim) =>
            !before.payable.some((earlier) => sameClaim(earlier, claim)) &&
            payable.some((now) => sameClaim(now, claim))
    )

    return {
        ...(broken.length > 0 ? { claimsBroken: broken.map(describe) } : {}),
        ...(restored.length > 0 ? { claimsRestored: restored.map(describe) } : {})
    }
}
