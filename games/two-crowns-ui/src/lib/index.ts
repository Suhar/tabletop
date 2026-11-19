import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedTwoCrownsState, TwoCrownsState } from '@tabletop/two-crowns'
import { TwoCrownsInfo } from '@tabletop/two-crowns'
import coverImg from './images/cover.webp'

export const UiDefinition: GameUiDefinition<TwoCrownsState, HydratedTwoCrownsState> = {
    info: {
        ...TwoCrownsInfo,
        thumbnailUrl: coverImg,
        clientCapabilities: gameClientCapabilities()
    },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}

export const PrototypeUiDefinition: GameUiDefinition<TwoCrownsState, HydratedTwoCrownsState> = {
    ...UiDefinition,
    runtime: async () => {
        const runtime = await UiDefinition.runtime()
        const Table = (await import('./PrototypeTable.svelte')).default
        return {
            ...runtime,
            gameUI: { ...runtime.gameUI, component: Table, load: async () => Table }
        }
    }
}
