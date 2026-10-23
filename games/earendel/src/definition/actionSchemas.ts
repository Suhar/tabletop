import type * as Type from 'typebox'
import { EarendelApiActions } from './apiActions.js'
import type { ActionType } from './actions.js'

// Every Action a game can record, User and System alike, for Action projection. All of them are
// already API Actions; none carries anything secret, since every draw and reveal they record is
// one the rules turn face-up.
export const EarendelActionSchemas = EarendelApiActions satisfies Record<ActionType, Type.TSchema>
