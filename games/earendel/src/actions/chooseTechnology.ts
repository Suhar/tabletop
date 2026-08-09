import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { hexKey } from '../model/board.js'

export type ChooseTechnologyMetadata = Type.Static<typeof ChooseTechnologyMetadata>
export const ChooseTechnologyMetadata = Type.Object({
    technologyId: Type.Optional(Type.String()),
    // True when the deck couldn't offer anything: the planet is explored and simply holds no
    // technology. Rare by design, but the game continues rather than stalling.
    noTechnologyAvailable: Type.Optional(Type.Boolean())
})

export type ChooseTechnology = Type.Static<typeof ChooseTechnology>
export const ChooseTechnology = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseTechnology),
            playerId: Type.String(),
            // Absent only when there was nothing to choose between.
            technologyId: Type.Optional(Type.String()),
            metadata: Type.Optional(ChooseTechnologyMetadata)
        })
    ])
)

export const ChooseTechnologyValidator = Compile(ChooseTechnology)

export function isChooseTechnology(action?: GameAction): action is ChooseTechnology {
    return action?.type === ActionType.ChooseTechnology
}

// Houses one of the revealed technologies on the planet just explored, and discards the rest.
// The planet keeps it permanently; whoever controls the planet has access to it.
export class HydratedChooseTechnology
    extends HydratableAction<typeof ChooseTechnology>
    implements ChooseTechnology
{
    declare type: ActionType.ChooseTechnology
    declare playerId: string
    declare technologyId?: string
    declare metadata?: ChooseTechnologyMetadata

    constructor(data: ChooseTechnology) {
        super(data, ChooseTechnologyValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidChooseTechnologyReason(state)
        if (invalidReason) {
            throw Error(`Invalid ChooseTechnology action: ${invalidReason}`)
        }

        const pending = state.pendingExploration!
        const revealed = pending.revealed ?? []
        const chosen = revealed.find((card) => card.id === this.technologyId)

        if (chosen) {
            state.board.hexes[hexKey(pending.exploringPlanet!)].technologyId = chosen.id
            // The explorer gains it outright, without having to control the planet - being
            // first is the whole reward for exploring. Anyone who takes control later gains
            // it too, and nobody ever loses it.
            state.getPlayerState(this.playerId).technologies.push(chosen.id)
        }

        // Everything turned over goes to the discard except the one card the planet keeps -
        // including the matching cards that weren't chosen.
        state.technologyDiscard.push(...revealed.filter((card) => card.id !== chosen?.id))

        // The exploration is done, which is what lets the turn end.
        state.pendingExploration = undefined

        this.metadata = chosen ? { technologyId: chosen.id } : { noTechnologyAvailable: true }
    }

    isValidChooseTechnology(state: HydratedEarendelGameState): boolean {
        return this.invalidChooseTechnologyReason(state) === undefined
    }

    invalidChooseTechnologyReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingExploration
        if (!pending) return 'No exploration is waiting on a technology.'
        if (pending.playerId !== this.playerId) return "That exploration isn't yours."
        if (!pending.exploringPlanet) return 'That probe hasn’t chosen a planet yet.'

        const candidates = pending.candidates ?? []
        if (candidates.length === 0) {
            // Nothing was revealed - the only legal move is to take nothing.
            return this.technologyId ? 'There was no technology to choose.' : undefined
        }

        if (!this.technologyId) return 'No technology was chosen.'
        if (!candidates.some((card) => card.id === this.technologyId)) {
            return "That technology isn't one of the cards revealed for this planet."
        }
        return undefined
    }
}
