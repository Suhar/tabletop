import type { GameState, HydratedGameState } from '@tabletop/common'
import type { GameSession } from '$lib/model/gameSession.svelte.js'
import type { Scenario } from './harnessScenarios.js'

export interface HarnessTools {
    session: GameSession<GameState, HydratedGameState> | undefined
    openScenario: (scenario: Scenario) => Promise<void>
}
