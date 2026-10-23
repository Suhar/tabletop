import type * as Type from 'typebox'
import { EarendelApiActions } from './apiActions.js'
import type { ActionType } from './actions.js'

// No Action carries a secret: every draw it records is one the rules turn face up.
export const EarendelActionSchemas = EarendelApiActions satisfies Record<ActionType, Type.TSchema>
