import { DefaultStateLogger, defineGame } from '@tabletop/common'
import {
    EarendelGameStateValidator,
    type EarendelGameState,
    type HydratedEarendelGameState
} from '../model/gameState.js'
import { EarendelHydrator } from './hydrator.js'
import { EarendelGameInitializer } from './initializer.js'
import { EarendelGameExploration } from './gameExploration.js'
import { EarendelApiActions } from './apiActions.js'
import { EarendelStateHandlers } from './stateHandlers.js'
import { EarendelColors } from './colors.js'
import { EarendelScoring } from './scoring.js'
import { EarendelInfo } from './info.js'

export const Definition = defineGame<EarendelGameState, HydratedEarendelGameState>({
    info: EarendelInfo,
    runtime: {
        randomnessVersion: 1,
        initializer: new EarendelGameInitializer(),
        exploration: new EarendelGameExploration(),
        canonicalStateValidator: EarendelGameStateValidator,
        hydrator: new EarendelHydrator(),
        stateHandlers: EarendelStateHandlers,
        apiActions: EarendelApiActions,
        playerColors: EarendelColors,
        stateLogger: new DefaultStateLogger(),
        scoring: new EarendelScoring()
    }
})

export const EarendelRuntime = Definition.runtime
