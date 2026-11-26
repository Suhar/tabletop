import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    ConduitRuntime,
    type ConduitProjectedState,
    type HydratedConduitGameState
} from '@tabletop/conduit'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { ConduitGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { ConduitGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const ConduitUiRuntime: GameUIRuntime<ConduitProjectedState, HydratedConduitGameState> = {
    ...ConduitRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: ConduitGameSession,
    colorizer: new ConduitGameColorizer()
}
