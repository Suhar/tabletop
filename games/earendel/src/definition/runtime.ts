import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import type { HydratedEarendelGameState, EarendelGameState } from '../model/gameState.js'
import { EarendelHydrator } from './hydrator.js'
import { EarendelGameInitializer } from './initializer.js'
import { EarendelApiActions } from './apiActions.js'
import { EarendelStateHandlers } from './stateHandlers.js'
import { EarendelColors } from './colors.js'


export const EarendelRuntime: GameRuntime<EarendelGameState, HydratedEarendelGameState> = {
    initializer: new EarendelGameInitializer(),
    hydrator: new EarendelHydrator(),
    stateHandlers: EarendelStateHandlers,
    apiActions: EarendelApiActions,
    playerColors: EarendelColors,
    stateLogger: new DefaultStateLogger() // This never really got used, but it could do some custom logging if desired
}
