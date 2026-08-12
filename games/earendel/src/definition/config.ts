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

// How a turn is shaped. DraftThree is the default: it gives the player a real decision before
// any hex is chosen - which of three to throw away - and two placements that can build on each
// other, at the cost of burning a third of the bag unplaced.
export enum TurnStyle {
    DraftThree = 'draftThree',
    SinglePiece = 'singlePiece'
}

const turnStyleOption: ListConfigOption = {
    id: 'turnStyle',
    type: ConfigOptionType.List,
    name: 'Turn style',
    description:
        'Draw three, discard one from the game, then place the other two in sequence - or the simpler one draw, one placement.',
    default: TurnStyle.DraftThree,
    alwaysShow: true,
    options: [
        { name: 'Draw 3, discard 1, place 2', value: TurnStyle.DraftThree },
        { name: 'Draw 1, place 1', value: TurnStyle.SinglePiece }
    ]
}

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
        { name: 'Only: move a friendly piece', value: TechnologyEffectKind.MoveFriendlyPiece },
        { name: 'Only: grow the board', value: TechnologyEffectKind.GrowBoard },
        { name: 'Only: logistics upgrade', value: TechnologyEffectKind.LogisticsUpgrade },
        { name: 'Only: railgun', value: TechnologyEffectKind.Railgun }
    ]
}

export type EarendelGameConfig = Type.Static<typeof EarendelGameConfig>
export const EarendelGameConfig = Type.Object({
    technologyDeck: Type.Optional(Type.String({ default: FULL_DECK })),
    turnStyle: Type.Optional(Type.String({ default: TurnStyle.DraftThree }))
})

export const EarendelGameConfigOptions: GameConfigOptions = [turnStyleOption, technologyDeckOption]

// How many pieces a turn draws, and how many of those are thrown away.
export const DRAFT_SIZE = 3
export const DRAFT_DISCARDS = 1

export function isDraftThree(config?: EarendelGameConfig): boolean {
    return (config?.turnStyle ?? TurnStyle.DraftThree) === TurnStyle.DraftThree
}

export function drawCountFor(config?: EarendelGameConfig): number {
    return isDraftThree(config) ? DRAFT_SIZE : 1
}
