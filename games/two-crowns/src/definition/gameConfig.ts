import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type BooleanConfigOption,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator
} from '@tabletop/common'

// 1874design.md, Variant rules.
const noTradeInsOption: BooleanConfigOption = {
    id: 'noTradeIns',
    type: ConfigOptionType.Boolean,
    name: 'No trade-ins',
    description:
        'Companies may not trade in trains; every train from the bank costs its printed price.',
    default: false
}

const extraSixHOption: BooleanConfigOption = {
    id: 'extraSixH',
    type: ConfigOptionType.Boolean,
    name: 'Extra 6H',
    description: 'One more 6H train in the roster: four instead of three.',
    default: false
}

const Schema = Type.Object(
    {
        noTradeIns: Type.Optional(Type.Boolean({ default: noTradeInsOption.default })),
        extraSixH: Type.Optional(Type.Boolean({ default: extraSixHOption.default }))
    },
    { additionalProperties: false }
)

export const TwoCrownsVariants = Type.Object(
    {
        noTradeIns: Type.Optional(Type.Literal(true)),
        extraSixH: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type TwoCrownsVariants = Type.Static<typeof TwoCrownsVariants>

export const TwoCrownsGameConfig = {
    schema: Schema,
    variants: (config: GameConfig | undefined): TwoCrownsVariants => ({
        ...(config?.noTradeIns === true ? { noTradeIns: true as const } : {}),
        ...(config?.extraSixH === true ? { extraSixH: true as const } : {})
    })
}

export class TwoCrownsConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = [noTradeInsOption, extraSixHOption]
}
