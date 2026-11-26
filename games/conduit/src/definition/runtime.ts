import { DefaultStateLogger, type GameRuntime, Visibility } from '@tabletop/common'
import {
    ConduitGameState,
    ConduitGameStateValidator,
    type ConduitProjectedState,
    type HydratedConduitGameState
} from '../model/gameState.js'
import { ConduitHydrator } from './hydrator.js'
import { ConduitGameInitializer } from './initializer.js'
import { ConduitApiActions } from './apiActions.js'
import { ConduitActionSchemas } from './actionSchemas.js'
import { ConduitStateHandlers } from './stateHandlers.js'
import { ConduitColors } from './colors.js'
import { ConduitScoring } from './scoring.js'
import { ConduitProgression } from './progression.js'
import { ConduitGameExploration } from './exploration.js'

export const ConduitRuntime = {
    randomnessVersion: 1,
    initializer: new ConduitGameInitializer(),
    exploration: new ConduitGameExploration(),
    canonicalStateValidator: ConduitGameStateValidator,
    hydrator: new ConduitHydrator(),
    stateHandlers: ConduitStateHandlers,
    apiActions: ConduitApiActions,
    playerColors: ConduitColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new ConduitScoring(),
    progression: new ConduitProgression(),
    visibility: {
        state: Visibility.createProjector(ConduitGameState),
        actions: Visibility.createActionProjector(ConduitActionSchemas)
    }
} satisfies GameRuntime<ConduitProjectedState, HydratedConduitGameState>
