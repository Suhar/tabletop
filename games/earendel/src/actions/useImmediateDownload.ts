import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, sameHex } from '../model/board.js'
import { hasImmediateEffect, TechnologyEffectKind } from '../model/technology.js'
import { downloadAnchorsFor, downloadTargetsFrom } from '../util/download.js'
import { activateTechnologyEffect, grantTechnology } from '../util/technologyGrants.js'

export type UseImmediateDownloadMetadata = Type.Static<typeof UseImmediateDownloadMetadata>
export const UseImmediateDownloadMetadata = Type.Object({
    // The technology taken, so history can name it - the coordinates alone say nothing a reader
    // would recognise.
    technologyId: Type.Optional(Type.String()),
    // Whether it went off at once rather than being kept. An Immediate effect downloaded this way
    // fires on the spot, which is the difference worth recording.
    resolvedAtOnce: Type.Optional(Type.Boolean())
})

export type UseImmediateDownload = Type.Static<typeof UseImmediateDownload>
export const UseImmediateDownload = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseImmediateDownload),
            playerId: Type.String(),
            // The planet holding the Download, and the planet being read from.
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(UseImmediateDownloadMetadata)
        })
    ])
)

export const UseImmediateDownloadValidator = Compile(UseImmediateDownload)

export function isUseImmediateDownload(action?: GameAction): action is UseImmediateDownload {
    return action?.type === ActionType.UseImmediateDownload
}

// Takes the technology of a planet this one can see, without the wait.
//
// What it really buys is TIME. Every other route to a technology runs through the claim rule:
// take a planet outright, hold it until your next turn begins, and it is yours - a full round in
// which anyone can break the hold. A Download skips all of that. The planet it reads from can be
// held by an opponent, deep in their territory, with a ripening claim of their own; sight is the
// only requirement, and sight does not care who owns what.
//
// It does not TAKE the technology away from them - a technology gained is a record, not a token,
// and the card stays on its planet. Two players holding the same technology is already possible
// (a planet that changes hands after its claim ripens does exactly that), so this needs no new
// rule to make sense of.
export class HydratedUseImmediateDownload
    extends HydratableAction<typeof UseImmediateDownload>
    implements UseImmediateDownload
{
    declare type: ActionType.UseImmediateDownload
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: UseImmediateDownloadMetadata

    constructor(data: UseImmediateDownload) {
        super(data, UseImmediateDownloadValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseImmediateDownloadReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseImmediateDownload action: ${invalidReason}`)
        }

        const playerState = state.getPlayerState(this.playerId)
        const card = getHex(state.board, this.to)!.technology!

        // Spent before the grant, not after: the downloaded card could itself be a stored effect,
        // and removing "a stored Download" afterwards could take the wrong entry out of the list.
        playerState.spendStoredEffect(TechnologyEffectKind.ImmediateDownload)

        grantTechnology(state, this.playerId, card)

        // "Available immediately" is the whole point of the name, and for an Immediate effect that
        // means firing now rather than being remembered. Anything else - a cooldown power, a
        // granted piece, another stored effect - is already usable the moment grantTechnology puts
        // it in front of the player, so there is nothing more to do for those.
        const resolvedAtOnce = hasImmediateEffect(card)
        if (resolvedAtOnce) {
            activateTechnologyEffect(state, {
                playerId: this.playerId,
                technologyId: card.id,
                kind: card.effect!.kind
            })
        }

        this.metadata = {
            technologyId: card.id,
            ...(resolvedAtOnce ? { resolvedAtOnce } : {})
        }
    }

    isValidUseImmediateDownload(state: HydratedEarendelGameState): boolean {
        return this.invalidUseImmediateDownloadReason(state) === undefined
    }

    invalidUseImmediateDownloadReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        // A downloaded Immediate effect needs the same slot a claimed one uses, and a downloaded
        // probe-or-fighter consequence would need the others: refuse while any is occupied rather
        // than overwrite a decision the player already owes.
        if (state.pendingTechnology || state.pendingTile) {
            return 'Finish the technology you are already resolving first.'
        }
        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasStoredEffect(TechnologyEffectKind.ImmediateDownload)) {
            return 'You have no Immediate Download to spend.'
        }

        if (!downloadAnchorsFor(state, this.playerId).some((anchor) => sameHex(anchor, this.from))) {
            return "That isn't a planet holding an Immediate Download of yours."
        }

        const targets = downloadTargetsFrom(state, this.playerId, this.from)
        if (targets.length === 0) {
            return 'Nothing that planet can see holds a technology you could take.'
        }
        if (!targets.some((target) => sameHex(target, this.to))) {
            return 'That planet is not an explored planet in clear line of sight with a technology new to you.'
        }

        return undefined
    }
}
