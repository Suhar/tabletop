import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assert,
    ConfigOptionType,
    type GameConfigOptions,
    type ListConfigOption
} from '@tabletop/common'
import { TechnologyEffectKind } from '../model/technology.js'

// A single technology fills the deck with it (rules.md, Game options).
export const FULL_DECK = 'all'

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
        'Use the full deck, or fill it with a single technology so that technology comes up on every exploration.',
    default: FULL_DECK,
    alwaysShow: true,
    options: [
        { name: 'Full deck', value: FULL_DECK },
        { name: 'Only: move a friendly piece', value: TechnologyEffectKind.MoveFriendlyPiece },
        { name: 'Only: grow the board', value: TechnologyEffectKind.GrowBoard },
        { name: 'Only: logistics upgrade', value: TechnologyEffectKind.LogisticsUpgrade },
        { name: 'Only: railgun', value: TechnologyEffectKind.Railgun },
        { name: 'Only: station upgrade', value: TechnologyEffectKind.StationUpgrade },
        { name: 'Only: terraforming', value: TechnologyEffectKind.Terraforming },
        { name: 'Only: relay network', value: TechnologyEffectKind.RelayNetwork },
        { name: 'Only: updated logistics', value: TechnologyEffectKind.UpdatedLogistics },
        { name: 'Only: full torpedo spread', value: TechnologyEffectKind.FullTorpedoSpread },
        { name: 'Only: tactical feint', value: TechnologyEffectKind.TacticalFeint },
        { name: 'Only: trade route wormhole', value: TechnologyEffectKind.TradeRouteWormhole },
        { name: 'Only: immediate download', value: TechnologyEffectKind.ImmediateDownload }
    ]
}

export type EarendelGameConfig = Type.Static<typeof EarendelGameConfig>
export const EarendelGameConfig = Type.Object({
    technologyDeck: Type.Optional(
        Type.Union([Type.Literal(FULL_DECK), Type.Enum(TechnologyEffectKind)], {
            default: FULL_DECK
        })
    ),
    turnStyle: Type.Optional(Type.Enum(TurnStyle, { default: TurnStyle.DraftThree }))
})

const EarendelGameConfigValidator = Compile(EarendelGameConfig)

export function earendelConfig(config: unknown): EarendelGameConfig {
    const value = config ?? {}
    assert(EarendelGameConfigValidator.Check(value), 'Invalid Earendel configuration')
    return value
}

export const EarendelGameConfigOptions: GameConfigOptions = [turnStyleOption, technologyDeckOption]

export const DRAFT_SIZE = 3
export const DRAFT_DISCARDS = 1

export function isDraftThree(config?: EarendelGameConfig): boolean {
    return (config?.turnStyle ?? TurnStyle.DraftThree) === TurnStyle.DraftThree
}

export function drawCountFor(config?: EarendelGameConfig): number {
    return isDraftThree(config) ? DRAFT_SIZE : 1
}
