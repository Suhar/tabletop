import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Piece } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import {
    applyEventChoice,
    type EventChoice,
    hasEventPick,
    invalidEventChoiceReason
} from '../util/events.js'
import {
    snapshotStanding,
    standingChanges,
    StandingChangeMetadata
} from '../util/standingChanges.js'

export type EventPickMetadata = Type.Static<typeof EventPickMetadata>
export const EventPickMetadata = Type.Object({
    ...StandingChangeMetadata,
    destroyed: Type.Optional(Piece),
    salvaged: Type.Optional(
        Type.Array(
            Type.Object({
                piece: Piece,
                playerId: Type.String(),
                reclaimed: Type.Optional(Type.Boolean())
            })
        )
    ),
    moved: Type.Optional(Piece),
    technologyId: Type.Optional(Type.String()),
    planet: Type.Optional(AxialCoordinates),
    // Shipyard World: the technology whose unit was taken.
    piece: Type.Optional(Type.Enum(TechnologyEffectKind)),
    // Nothing to pick: the player was passed over.
    skipped: Type.Optional(Type.Boolean())
})

// One player's pick in an elevated event. Which fields it carries depends on the event: a hex
// to bombard or intercept, a piece and where the storm takes it, a salvaged card, or a shipyard
// piece. With none, the player had nothing to pick.
export type EventPick = Type.Static<typeof EventPick>
export const EventPick = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EventPick),
            playerId: Type.String(),
            coords: Type.Optional(AxialCoordinates),
            from: Type.Optional(AxialCoordinates),
            to: Type.Optional(AxialCoordinates),
            technologyId: Type.Optional(Type.String()),
            piece: Type.Optional(Type.Enum(TechnologyEffectKind)),
            metadata: Type.Optional(EventPickMetadata)
        })
    ])
)

export const EventPickValidator = Compile(EventPick)

export function isEventPick(action?: GameAction): action is EventPick {
    return action?.type === ActionType.EventPick
}

export class HydratedEventPick extends HydratableAction<typeof EventPick> implements EventPick {
    declare type: ActionType.EventPick
    declare playerId: string
    declare coords?: AxialCoordinates
    declare from?: AxialCoordinates
    declare to?: AxialCoordinates
    declare technologyId?: string
    declare piece?: TechnologyEffectKind
    declare metadata?: EventPickMetadata

    constructor(data: EventPick) {
        super(data, EventPickValidator)
    }

    private get choice(): EventChoice {
        return {
            ...(this.coords ? { coords: this.coords } : {}),
            ...(this.from ? { from: this.from } : {}),
            ...(this.to ? { to: this.to } : {}),
            ...(this.technologyId ? { technologyId: this.technologyId } : {}),
            ...(this.piece ? { piece: this.piece } : {})
        }
    }

    private get isSkip(): boolean {
        return Object.keys(this.choice).length === 0
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidEventPickReason(state)
        if (invalidReason) {
            throw Error(`Invalid EventPick action: ${invalidReason}`)
        }

        const pending = state.pendingEvent
        assertExists(pending, 'Validated: an event is being resolved')
        const claims = snapshotStanding(state)

        if (this.isSkip) {
            this.metadata = { skipped: true }
        } else {
            const outcome = applyEventChoice(state, pending, this.playerId, this.choice)
            this.metadata = { ...outcome }
        }
        pending.order?.shift()
        this.metadata = { ...this.metadata, ...standingChanges(claims, state) }
    }

    isValidEventPick(state: HydratedEarendelGameState): boolean {
        return this.invalidEventPickReason(state) === undefined
    }

    invalidEventPickReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingEvent
        if (!pending?.order) return 'No elevated event is waiting for a pick.'
        if (pending.order[0] !== this.playerId) return "It isn't your pick."

        if (this.isSkip) {
            return hasEventPick(state, pending, this.playerId)
                ? 'You have something to pick.'
                : undefined
        }
        return invalidEventChoiceReason(state, pending, this.playerId, this.choice)
    }
}
