import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    ConduitInfo,
    type ConduitProjectedState,
    type HydratedConduitGameState
} from '@tabletop/conduit'
import coverImg from '$lib/images/cover.webp'

export const UiDefinition: GameUiDefinition<ConduitProjectedState, HydratedConduitGameState> = {
    info: {
        ...ConduitInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => {
        return (await import('./runtime.js')).ConduitUiRuntime
    }
}
