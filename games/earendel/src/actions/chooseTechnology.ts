import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, hexKey } from '../model/board.js'
import { isElevated, matchesColor, TechnologyCard } from '../model/technology.js'

export type ChooseTechnologyMetadata = Type.Static<typeof ChooseTechnologyMetadata>
export const ChooseTechnologyMetadata = Type.Object({
    technologyId: Type.Optional(Type.String()),
    technology: Type.Optional(TechnologyCard),
    noTechnologyAvailable: Type.Optional(Type.Boolean())
})

export type ChooseTechnology = Type.Static<typeof ChooseTechnology>
export const ChooseTechnology = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseTechnology),
            playerId: Type.String(),
            technologyId: Type.Optional(Type.String()),
            metadata: Type.Optional(ChooseTechnologyMetadata)
        })
    ])
)

export const ChooseTechnologyValidator = Compile(ChooseTechnology)

export function isChooseTechnology(action?: GameAction): action is ChooseTechnology {
    return action?.type === ActionType.ChooseTechnology
}

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
            state.board.hexes[hexKey(pending.exploringPlanet!)].technology = chosen

            state.probeClaims.push({
                playerId: this.playerId,
                coords: pending.exploringPlanet!,
                technologyId: chosen.id
            })
        }

        state.technologyDiscard.push(...revealed.filter((card) => card.id !== chosen?.id))

        state.pendingExploration = undefined

        this.metadata = chosen
            ? { technologyId: chosen.id, technology: chosen }
            : { noTechnologyAvailable: true }
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
            return this.technologyId ? 'There was no technology to choose.' : undefined
        }

        if (!this.technologyId) return 'No technology was chosen.'

        if (!candidates.some((card) => card.id === this.technologyId)) {
            const color = getHex(state.board, pending.exploringPlanet)?.color
            const wanted = (pending.revealed ?? []).find((card) => card.id === this.technologyId)

            if (wanted && color && matchesColor(wanted, color) && candidates.some(isElevated)) {
                return 'An elevated technology was revealed, so a standard one cannot be taken.'
            }
            return "That technology isn't one of the cards revealed for this planet."
        }

        return undefined
    }
}
