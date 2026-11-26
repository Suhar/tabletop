import type {
    GameUIRuntime,
    PlayerColorPalette,
    PlayerColorValueSet
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import { colorScheme } from '$lib/model/colorScheme.svelte.js'
import { boldPlayerFill } from '$lib/utils/planetColors.js'
import type { HydratedEarendelGameState, EarendelGameState } from '@tabletop/earendel'
import { EarendelRuntime } from '@tabletop/earendel'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { EarendelGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { EarendelGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

// The fills behind player name pills. Read afresh each time, so the pills follow the color scheme:
// the bold scheme's own colors, and otherwise the shared defaults.
function boldValues(color: Color): PlayerColorValueSet | undefined {
    const fill = colorScheme.current === 'bold' ? boldPlayerFill(color) : undefined
    return fill ? { fill, text: '#ffffff', contrast: '#ffffff' } : undefined
}

const EarendelPlayerColorPalette: PlayerColorPalette = {
    get [Color.Red]() {
        return boldValues(Color.Red)
    },
    get [Color.Orange]() {
        return boldValues(Color.Orange)
    },
    get [Color.Yellow]() {
        return boldValues(Color.Yellow)
    },
    get [Color.Pink]() {
        return boldValues(Color.Pink)
    },
    get [Color.White]() {
        return boldValues(Color.White)
    }
}

export const EarendelUiRuntime: GameUIRuntime<EarendelGameState, HydratedEarendelGameState> = {
    ...EarendelRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: EarendelGameSession,
    colorizer: new EarendelGameColorizer(),
    playerColorPalette: EarendelPlayerColorPalette
}
