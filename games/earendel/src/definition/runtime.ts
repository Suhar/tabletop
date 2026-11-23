import { DefaultStateLogger, defineGame, Visibility } from '@tabletop/common'
import {
    EarendelGameState,
    EarendelGameStateValidator,
    type EarendelProjectedState,
    type HydratedEarendelGameState
} from '../model/gameState.js'
import { EarendelActionSchemas } from './actionSchemas.js'
import { EarendelHydrator } from './hydrator.js'
import { EarendelGameInitializer } from './initializer.js'
import { EarendelGameExploration } from './gameExploration.js'
import { EarendelApiActions } from './apiActions.js'
import { EarendelStateHandlers } from './stateHandlers.js'
import { EarendelColors } from './colors.js'
import { EarendelScoring } from './scoring.js'
import { EarendelInfo } from './info.js'

export const Definition = defineGame<EarendelProjectedState, HydratedEarendelGameState>({
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
        scoring: new EarendelScoring(),
        // Bags, the technology deck and the tile supply are drawn blind: their items are
        // protected for every player, leaving only their counts public.
        visibility: {
            state: Visibility.createProjector(EarendelGameState),
            actions: Visibility.createActionProjector(EarendelActionSchemas)
        }
    }
})

export const EarendelRuntime = Definition.runtime
