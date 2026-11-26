import type * as Type from 'typebox'
import { ActionType } from './actions.js'
import { ConduitApiActions } from './apiActions.js'
import { FillMarket } from '../actions/fillMarket.js'
import { PayRevenue } from '../actions/payRevenue.js'
import { LoseInfrastructure } from '../actions/loseInfrastructure.js'

export const ConduitActionSchemas = {
    ...ConduitApiActions,
    [ActionType.FillMarket]: FillMarket,
    [ActionType.PayRevenue]: PayRevenue,
    [ActionType.LoseInfrastructure]: LoseInfrastructure
} satisfies Record<ActionType, Type.TSchema>
