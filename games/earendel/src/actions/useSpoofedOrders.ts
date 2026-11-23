import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { hexKey } from '../model/board.js'
import { Piece } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { refreshPlanetControl } from '../util/control.js'
import { destinationsFrom } from '../util/movement.js'
import { spoofablePieces } from '../util/spoofing.js'
import { claimChanges, ClaimChangeMetadata, snapshotClaims } from '../util/claimChanges.js'

export type UseSpoofedOrdersMetadata = Type.Static<typeof UseSpoofedOrdersMetadata>
export const UseSpoofedOrdersMetadata = Type.Object({
    ...ClaimChangeMetadata,
    // The rival piece that was sent a step, as it stood before.
    piece: Type.Optional(Piece)
})

export type UseSpoofedOrders = Type.Static<typeof UseSpoofedOrders>
export const UseSpoofedOrders = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseSpoofedOrders),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(UseSpoofedOrdersMetadata)
        })
    ])
)

export const UseSpoofedOrdersValidator = Compile(UseSpoofedOrders)

export function isUseSpoofedOrders(action?: GameAction): action is UseSpoofedOrders {
    return action?.type === ActionType.UseSpoofedOrders
}

// Spoofed Orders (rules.md, One-shot technologies): once, when its holder chooses, a rival's
// piece beside one of the holder's own steps into an adjacent empty space. It is moved, not
// placed: nothing scores, explores or fires for its owner.
export class HydratedUseSpoofedOrders
    extends HydratableAction<typeof UseSpoofedOrders>
    implements UseSpoofedOrders
{
    declare type: ActionType.UseSpoofedOrders
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: UseSpoofedOrdersMetadata

    constructor(data: UseSpoofedOrders) {
        super(data, UseSpoofedOrdersValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseSpoofedOrdersReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseSpoofedOrders action: ${invalidReason}`)
        }

        const claims = snapshotClaims(state)

        const fromHex = state.board.hexes[hexKey(this.from)]
        const piece = fromHex.piece
        assertExists(piece, 'Spoofed Orders moves a rival piece')
        const moved = structuredClone(piece)

        delete fromHex.piece
        delete piece.surveying
        state.board.hexes[hexKey(this.to)].piece = piece

        state.getPlayerState(this.playerId).spendStoredEffect(TechnologyEffectKind.SpoofedOrders)
        refreshPlanetControl(state)

        this.metadata = { piece: moved, ...claimChanges(claims, state) }
    }

    isValidUseSpoofedOrders(state: HydratedEarendelGameState): boolean {
        return this.invalidUseSpoofedOrdersReason(state) === undefined
    }

    invalidUseSpoofedOrdersReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasStoredEffect(TechnologyEffectKind.SpoofedOrders)) {
            return 'You have no Spoofed Orders to use.'
        }

        if (
            !spoofablePieces(state.board, this.playerId).some((coords) =>
                sameCoordinates(coords, this.from)
            )
        ) {
            return "Spoofed Orders moves a rival's piece that stands beside one of yours and has somewhere to step."
        }

        if (
            !destinationsFrom(state.board, this.from).some((option) =>
                sameCoordinates(option, this.to)
            )
        ) {
            return 'That piece cannot step there: it must be adjacent, empty open space open to it.'
        }

        return undefined
    }
}
