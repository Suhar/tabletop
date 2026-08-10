import * as Type from 'typebox'
import {
    ConfigOptionType,
    type GameConfigOptions,
    type ListConfigOption
} from '@tabletop/common'
import { TechnologyEffectKind } from '../model/technology.js'

// A testing aid, not a game rule. Picking a single technology fills the whole deck with it,
// so a new effect can be exercised without waiting for the shuffle to offer it. Every planet
// then houses the same technology, which is nobody's idea of a game - but it is the fastest
// way to see a new effect from every angle.
export const FULL_DECK = 'all'

const technologyDeckOption: ListConfigOption = {
    id: 'technologyDeck',
    type: ConfigOptionType.List,
    name: 'Technology deck',
    description:
        'Testing aid: fill the deck with a single technology so its effect comes up every time. Use the full deck for a real game.',
    default: FULL_DECK,
    alwaysShow: true,
    options: [
        { name: 'Full deck', value: FULL_DECK },
        { name: 'Only: move a friendly piece', value: TechnologyEffectKind.MoveFriendlyPiece }
    ]
}

export type EarendelGameConfig = Type.Static<typeof EarendelGameConfig>
export const EarendelGameConfig = Type.Object({
    technologyDeck: Type.Optional(Type.String({ default: FULL_DECK }))
})

export const EarendelGameConfigOptions: GameConfigOptions = [technologyDeckOption]
