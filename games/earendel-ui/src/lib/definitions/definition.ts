import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { EarendelInfo } from '@tabletop/earendel'
import type { EarendelGameState, HydratedEarendelGameState } from '@tabletop/earendel'
import coverImg from '$lib/images/cover.jpg'

export const UiDefinition: GameUiDefinition<EarendelGameState, HydratedEarendelGameState> = {
    info: {
        ...EarendelInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).EarendelUiRuntime
    }
}
