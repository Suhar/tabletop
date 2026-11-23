import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { putUnder } from '../model/bags.js'
import { hexKey } from '../model/board.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { OrbitedProbe } from '../model/exploration.js'
import { fireElevatedCard, isElevatedCardId } from '../util/elevated.js'

export type ChooseTechnologyMetadata = Type.Static<typeof ChooseTechnologyMetadata>
export const ChooseTechnologyMetadata = Type.Object({
    technologyId: Type.Optional(Type.String()),
    noTechnologyAvailable: Type.Optional(Type.Boolean()),
    // An elevated card: the planet is spent for everyone and its event begins.
    elevated: Type.Optional(Type.Boolean()),
    event: Type.Optional(Type.Enum(TechnologyEffectKind)),
    // Whether every player picks, or the discoverer alone (a rule's single pick).
    everyone: Type.Optional(Type.Boolean()),
    orbited: Type.Optional(Type.Array(OrbitedProbe))
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

        const pending = state.pendingExploration
        assertExists(pending, 'ChooseTechnology requires a pending exploration')
        const planet = pending.exploringPlanet
        assertExists(planet, 'ChooseTechnology requires a chosen planet')
        const revealed = pending.revealed ?? []
        const chosen = revealed.find((id) => id === this.technologyId)

        let fired: ReturnType<typeof fireElevatedCard> | undefined
        if (chosen && isElevatedCardId(chosen)) {
            fired = fireElevatedCard(state, this.playerId, planet, pending.probeCoords, chosen)
        } else if (chosen) {
            state.board.hexes[hexKey(planet)].technologyId = chosen

            state.probeClaims.push({
                playerId: this.playerId,
                coords: planet,
                technologyId: chosen
            })
        }

        // Only what was offered and passed over is discarded. Cards turned over on the way,
        // which the planet could not take, go back under the deck (rules.md, Exploration).
        const offered = new Set(pending.candidates ?? [])
        state.technologyDiscard.push(...revealed.filter((id) => offered.has(id) && id !== chosen))
        putUnder(
            state.technologyDeck,
            revealed.filter((id) => !offered.has(id)),
            state.getProtectedPrng().random
        )

        state.pendingExploration = undefined

        this.metadata = chosen
            ? {
                  technologyId: chosen,
                  ...(fired
                      ? {
                            elevated: true,
                            event: fired.event,
                            everyone: fired.everyone,
                            ...(fired.orbited.length > 0 ? { orbited: fired.orbited } : {})
                        }
                      : {})
              }
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

        if (!candidates.includes(this.technologyId)) {
            return "That technology isn't one of the cards revealed for this planet."
        }

        return undefined
    }
}
