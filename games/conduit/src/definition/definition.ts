import { defineGame } from '@tabletop/common'
import type { ConduitProjectedState, HydratedConduitGameState } from '../model/gameState.js'
import { ConduitInfo } from './info.js'
import { ConduitRuntime } from './runtime.js'

export const Definition = defineGame<ConduitProjectedState, HydratedConduitGameState>({
    info: ConduitInfo,
    runtime: ConduitRuntime
})
