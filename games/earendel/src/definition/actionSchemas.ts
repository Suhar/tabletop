import type * as Type from 'typebox'
import { EarendelApiActions } from './apiActions.js'
import type { ActionType } from './actions.js'

// Every draw an Action records is one the rules turn face up. The one secret is the ship a
// player stows at the opening, which StowShip protects for everyone but its player.
export const EarendelActionSchemas = EarendelApiActions satisfies Record<ActionType, Type.TSchema>
