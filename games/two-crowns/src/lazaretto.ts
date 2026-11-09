import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedAction,
    type HydratedGameState
} from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    StepActionsHandler,
    closePrivate,
    controllingOwner,
    privateOwner,
    stepAction,
    type CompanyDecisionState,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState,
    type TrainPurchaseState
} from '@tabletop/18xx'
import type { TwoCrownsState } from './state.js'
import { TwoCrownsTrainDepot } from './trains.js'

// 1874design.md, Quarantine (the Rijeka Lazaretto).
export const LazarettoId = 'P5'

export const QuarantineTrain = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('QuarantineTrain'),
        trainId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
)
export type QuarantineTrain = Type.Static<typeof QuarantineTrain>
const Validator = Compile(QuarantineTrain)
export function isQuarantineTrain(action: GameAction): action is QuarantineTrain {
    return (
        action instanceof HydratedQuarantineTrain ||
        (action.type === 'QuarantineTrain' && Validator.Check(action))
    )
}

type QuarantineState = CompanyDecisionState &
    TrainPurchaseState &
    Pick<TwoCrownsState, 'quarantinedTrainId'>

/**
 * The trains the player may put the quarantine marker on now: the trains that can still rust of
 * the company operating, while its president holds the open Lazaretto.
 */
export function quarantineTrainIds(state: QuarantineState, playerId: string): string[] {
    const lazaretto = state.companies.find((company) => company.id === LazarettoId)
    if (!lazaretto || lazaretto.closed) return []
    const owner = privateOwner(state, LazarettoId)
    if (owner?.kind !== 'player' || owner.playerId !== playerId) return []
    if (!state.activePlayerIds.includes(playerId)) return []
    const companyId = EighteenXXTransferTiming.operatingCompany(state)
    if (!companyId || controllingOwner(state, companyId)?.playerId !== playerId) return []
    return state.trainInventory.trains
        .filter(
            (train) =>
                train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.owner.companyId === companyId &&
                !train.rustsAfterOperation &&
                !!TwoCrownsTrainDepot.trainDefinition(train.definitionId).rustsOn
        )
        .map((train) => train.id)
}

export class HydratedQuarantineTrain
    extends HydratableAction<typeof QuarantineTrain>
    implements QuarantineTrain
{
    declare type: 'QuarantineTrain'
    declare playerId: string
    declare trainId: string
    constructor(data: QuarantineTrain) {
        super(data instanceof HydratedQuarantineTrain ? data.dehydrate() : data, Validator)
    }
    isValid(state: QuarantineState): boolean {
        return (
            this.source === ActionSource.User &&
            quarantineTrainIds(state, this.playerId).includes(this.trainId)
        )
    }
    apply(state: HydratedGameState & QuarantineState): void {
        assert(this.isValid(state), 'The Rijeka Lazaretto cannot quarantine this train now')
        state.quarantinedTrainId = this.trainId
        closePrivate(state, LazarettoId)
    }
}

const QuarantineStep = stepAction<HydratedEighteenXXState, HydratedQuarantineTrain>(
    'QuarantineTrain',
    (action: HydratedAction): action is HydratedQuarantineTrain =>
        action instanceof HydratedQuarantineTrain,
    (state, playerId) =>
        quarantineTrainIds(state as unknown as QuarantineState, playerId).length > 0
)

/** Offers the quarantine marker in a step of the operating company's turn. */
export function offersQuarantine(family: EighteenXXStateHandler): EighteenXXStateHandler {
    return new StepActionsHandler(family, [QuarantineStep])
}
