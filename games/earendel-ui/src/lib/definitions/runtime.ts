import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedEarendelGameState, EarendelGameState } from '@tabletop/earendel'
import { EarendelRuntime } from '@tabletop/earendel'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { EarendelGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { EarendelGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const EarendelUiRuntime: GameUIRuntime<EarendelGameState, HydratedEarendelGameState> = {
    ...EarendelRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: EarendelGameSession,
    colorizer: new EarendelGameColorizer()
}
