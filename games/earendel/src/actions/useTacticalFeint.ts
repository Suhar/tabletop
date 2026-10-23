import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, hexKey, sameHex } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { resolveArrival } from '../util/arrival.js'
import { canUseCooldownEffect, startCooldown } from '../util/cooldowns.js'
import { feintTargets } from '../util/legality.js'
import { ScoredChain } from '../model/chains.js'

export type UseTacticalFeintMetadata = Type.Static<typeof UseTacticalFeintMetadata>
export const UseTacticalFeintMetadata = Type.Object({
    movedType: Type.Optional(Type.Enum(PieceType)),
    displacedType: Type.Optional(Type.Enum(PieceType)),
    stationGroupPoints: Type.Optional(Type.Number()),
    chains: Type.Optional(Type.Array(ScoredChain)),
    probeDestinations: Type.Optional(Type.Array(AxialCoordinates))
})

export type UseTacticalFeint = Type.Static<typeof UseTacticalFeint>
export const UseTacticalFeint = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseTacticalFeint),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(UseTacticalFeintMetadata)
        })
    ])
)

export const UseTacticalFeintValidator = Compile(UseTacticalFeint)

export function isUseTacticalFeint(action?: GameAction): action is UseTacticalFeint {
    return action?.type === ActionType.UseTacticalFeint
}

export class HydratedUseTacticalFeint
    extends HydratableAction<typeof UseTacticalFeint>
    implements UseTacticalFeint
{
    declare type: ActionType.UseTacticalFeint
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: UseTacticalFeintMetadata

    constructor(data: UseTacticalFeint) {
        super(data, UseTacticalFeintValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseTacticalFeintReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseTacticalFeint action: ${invalidReason}`)
        }

        const fromHex = state.board.hexes[hexKey(this.from)]
        const toHex = state.board.hexes[hexKey(this.to)]
        const mine = fromHex.piece!
        const theirs = toHex.piece!

        toHex.piece = mine
        fromHex.piece = theirs

        startCooldown(state, this.playerId, TechnologyEffectKind.TacticalFeint)

        const { stationPoints, chains, probeDestinations } = resolveArrival(
            state,
            this.playerId,
            this.to
        )

        this.metadata = {
            movedType: mine.type,
            displacedType: theirs.type,
            ...(stationPoints > 0 ? { stationGroupPoints: stationPoints } : {}),
            ...(chains.length > 0
                ? { chains: chains.map(({ pairKey: _pairKey, ...chain }) => chain) }
                : {}),
            ...(probeDestinations.length > 0 ? { probeDestinations } : {})
        }
    }

    isValidUseTacticalFeint(state: HydratedEarendelGameState): boolean {
        return this.invalidUseTacticalFeintReason(state) === undefined
    }

    invalidUseTacticalFeintReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        if (!canUseCooldownEffect(state, this.playerId, TechnologyEffectKind.TacticalFeint)) {
            return 'Your Tactical Feint is not ready.'
        }

        const mine = getHex(state.board, this.from)?.piece
        if (!mine) return 'There is no ship of yours there.'
        if (mine.playerId !== this.playerId) return "That ship isn't yours."

        const theirs = getHex(state.board, this.to)?.piece
        if (!theirs) return 'There is no ship to trade places with.'
        if (theirs.playerId === this.playerId) return 'A feint trades places with an enemy ship.'

        if (
            !feintTargets(state.board, this.from, this.playerId).some((target) =>
                sameHex(target, this.to)
            )
        ) {
            return 'A feint only reaches a ship right beside your own.'
        }

        return undefined
    }
}
