import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, sameHex } from '../model/board.js'
import { hasImmediateEffect, TechnologyCard, TechnologyEffectKind } from '../model/technology.js'
import { downloadAnchorsFor, downloadTargetsFrom } from '../util/download.js'
import { activateTechnologyEffect, grantTechnology } from '../util/technologyGrants.js'

export type UseImmediateDownloadMetadata = Type.Static<typeof UseImmediateDownloadMetadata>
export const UseImmediateDownloadMetadata = Type.Object({
    technologyId: Type.Optional(Type.String()),
    technology: Type.Optional(TechnologyCard),
    resolvedAtOnce: Type.Optional(Type.Boolean())
})

export type UseImmediateDownload = Type.Static<typeof UseImmediateDownload>
export const UseImmediateDownload = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseImmediateDownload),
            playerId: Type.String(),
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

        // Spent before the grant: the downloaded card could itself be a stored Download.
        playerState.spendStoredEffect(TechnologyEffectKind.ImmediateDownload)

        grantTechnology(state, this.playerId, card)

        const resolvedAtOnce = hasImmediateEffect(card)
        if (resolvedAtOnce) {
            activateTechnologyEffect(state, {
                playerId: this.playerId,
                technologyId: card.id,
                kind: card.effect!.kind
            })
        }

        if (state.pendingTile) this.revealsInfo = true

        this.metadata = {
            technologyId: card.id,
            technology: card,
            ...(resolvedAtOnce ? { resolvedAtOnce } : {})
        }
    }

    isValidUseImmediateDownload(state: HydratedEarendelGameState): boolean {
        return this.invalidUseImmediateDownloadReason(state) === undefined
    }

    invalidUseImmediateDownloadReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingTechnology || state.pendingTile) {
            return 'Finish the technology you are already resolving first.'
        }
        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasStoredEffect(TechnologyEffectKind.ImmediateDownload)) {
            return 'You have no Immediate Download to spend.'
        }

        if (
            !downloadAnchorsFor(state, this.playerId).some((anchor) => sameHex(anchor, this.from))
        ) {
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
