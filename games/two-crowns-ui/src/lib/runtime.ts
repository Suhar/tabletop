import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { HydratedTwoCrownsState, TwoCrownsState } from '@tabletop/two-crowns'
import { Definition } from '@tabletop/two-crowns'
import { TwoCrownsSession } from './session.svelte.js'
import './styles.css'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<TwoCrownsState, HydratedTwoCrownsState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: TwoCrownsSession,
    colorizer: new DefaultColorizer()
}
