import type { GameDefinition } from '@tabletop/common'
import type { EarendelGameState, HydratedEarendelGameState } from '../model/gameState.js'
import { EarendelInfo } from './info.js'
import { EarendelRuntime } from './runtime.js'

export const Definition = <GameDefinition<EarendelGameState, HydratedEarendelGameState>>{
    info: EarendelInfo,
    runtime: EarendelRuntime
}
