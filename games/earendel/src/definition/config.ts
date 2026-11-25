import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assert,
    type BooleanConfigOption,
    ConfigOptionType,
    type GameConfigOptions,
    type ListConfigOption
} from '@tabletop/common'
import {
    ELEVATED_PAIRS,
    TECHNOLOGY_EFFECT_INFO,
    TechnologyEffectKind,
    categoryOfColor,
    TECHNOLOGY_CATEGORY_INFO
} from '../model/technology.js'
import { PLANET_COLORS, PlanetColor } from '../model/planetColor.js'

// A single technology fills the deck with it (rules.md, Game options).
export const FULL_DECK = 'all'

// Fixed at draw three, discard one, place two: the single-piece style stays in the schema for
// tests and old games but is no longer offered at setup.
export enum TurnStyle {
    DraftThree = 'draftThree',
    SinglePiece = 'singlePiece'
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
        { name: 'Only: gamma torpedo', value: TechnologyEffectKind.GammaTorpedo },
        { name: 'Only: tactical feint', value: TechnologyEffectKind.TacticalFeint },
        { name: 'Only: trade route wormhole', value: TechnologyEffectKind.TradeRouteWormhole },
        { name: 'Only: immediate download', value: TechnologyEffectKind.ImmediateDownload },
        { name: 'Only: spoofed orders', value: TechnologyEffectKind.SpoofedOrders },
        { name: 'Only: asteroid field', value: TechnologyEffectKind.AsteroidField },
        { name: 'Only: security breach', value: TechnologyEffectKind.SecurityBreach },
        { name: 'Only: warp drive', value: TechnologyEffectKind.WarpDrive },
        { name: 'Only: dimensional rift', value: TechnologyEffectKind.DimensionalRift },
        { name: 'Only: conscription', value: TechnologyEffectKind.Conscription },
        { name: 'Only: factory override', value: TechnologyEffectKind.FactoryOverride },
        { name: 'Only: colony ship', value: TechnologyEffectKind.ColonyShip },
        { name: 'Only: interdiction', value: TechnologyEffectKind.Interdiction },
        { name: 'Only: bastion works', value: TechnologyEffectKind.BastionWorks },
        { name: 'Only: gate network', value: TechnologyEffectKind.GateNetwork },
        { name: 'Only: carrier doctrine', value: TechnologyEffectKind.CarrierDoctrine },
        { name: 'Only: deep scan', value: TechnologyEffectKind.DeepScan },
        { name: 'Only: quarantine', value: TechnologyEffectKind.Quarantine },
        { name: 'Only: jammer array', value: TechnologyEffectKind.JammerArray },
        { name: 'Only: artificial world', value: TechnologyEffectKind.ArtificialWorld },
        { name: 'Only: nebula seeding', value: TechnologyEffectKind.NebulaSeeding },
        { name: 'Only: salvage operations', value: TechnologyEffectKind.SalvageOperations }
    ]
}

// Each player, last in turn order first, stows an extra ship and then places a free station
// before the first turn (rules.md, Setup): a station in every respect that scored nothing on
// arrival and came from no bag.
const openingStationsOption: BooleanConfigOption = {
    id: 'openingStations',
    type: ConfigOptionType.Boolean,
    name: 'Opening stations',
    description:
        'Before the first turn, each player secretly stows one extra ship in their bag and then places one free station, the last player in turn order first.',
    default: true
}

// Which special units the deck holds (rules.md, Granted pieces): the basic five, one per
// category drawn at setup, or every one.
export enum PiecesInPlay {
    Basic = 'basic',
    OnePerCategory = 'onePerCategory',
    All = 'all'
}

const piecesOption: ListConfigOption = {
    id: 'piecesInPlay',
    type: ConfigOptionType.List,
    name: 'Special units',
    description:
        'The basic five units (Interdictor, Gate, Carrier, Relay, Station Hub); one per category drawn at setup, with the rest left out of the deck; or every unit in the deck.',
    default: PiecesInPlay.Basic,
    alwaysShow: false,
    options: [
        { name: 'Basic special units', value: PiecesInPlay.Basic },
        { name: 'One per category, drawn at setup', value: PiecesInPlay.OnePerCategory },
        { name: 'All of them', value: PiecesInPlay.All }
    ]
}

// Which of a color's pair of elevated cards the game deals (rules.md, Elevated technologies).
export enum ElevatedChoice {
    Random = 'random',
    Event = 'event',
    Rule = 'rule',
    None = 'none'
}

export function elevatedOptionId(color: PlanetColor): string {
    return `elevated-${color}`
}

const elevatedOptions: ListConfigOption[] = PLANET_COLORS.map((color) => {
    const pair = ELEVATED_PAIRS[color]
    // Named by its category: the planets' colors are the player's to choose in the UI.
    const name = TECHNOLOGY_CATEGORY_INFO[categoryOfColor(color)].name
    return {
        id: elevatedOptionId(color),
        type: ConfigOptionType.List,
        name: `${name} elevated technology`,
        description: `Which elevated technology a ${name} planet may turn up: the setup draw decides, or choose one, or none.`,
        default: ElevatedChoice.Random,
        alwaysShow: false,
        options: [
            { name: 'Setup draw decides', value: ElevatedChoice.Random },
            {
                name: `${TECHNOLOGY_EFFECT_INFO[pair.event].name} (event)`,
                value: ElevatedChoice.Event
            },
            {
                name: `${TECHNOLOGY_EFFECT_INFO[pair.rule].name} (global)`,
                value: ElevatedChoice.Rule
            },
            { name: 'None', value: ElevatedChoice.None }
        ]
    }
})

export function elevatedChoiceFor(config: EarendelGameConfig, color: PlanetColor): ElevatedChoice {
    const optionId = elevatedOptionId(color)
    const stored: unknown = Object.entries(config).find(([key]) => key === optionId)?.[1]
    return (
        Object.values(ElevatedChoice).find((choice) => choice === stored) ?? ElevatedChoice.Random
    )
}

export type EarendelGameConfig = Type.Static<typeof EarendelGameConfig>
export const EarendelGameConfig = Type.Object({
    ...Object.fromEntries(
        PLANET_COLORS.map((color) => [
            elevatedOptionId(color),
            Type.Optional(Type.Enum(ElevatedChoice, { default: ElevatedChoice.Random }))
        ])
    ),
    technologyDeck: Type.Optional(
        Type.Union([Type.Literal(FULL_DECK), Type.Enum(TechnologyEffectKind)], {
            default: FULL_DECK
        })
    ),
    turnStyle: Type.Optional(Type.Enum(TurnStyle, { default: TurnStyle.DraftThree })),
    piecesInPlay: Type.Optional(Type.Enum(PiecesInPlay, { default: PiecesInPlay.Basic })),
    openingStations: Type.Optional(Type.Boolean({ default: openingStationsOption.default }))
})

const EarendelGameConfigValidator = Compile(EarendelGameConfig)

export function earendelConfig(config: unknown): EarendelGameConfig {
    const value = config ?? {}
    assert(EarendelGameConfigValidator.Check(value), 'Invalid Earendel configuration')
    return value
}

export const EarendelGameConfigOptions: GameConfigOptions = [
    technologyDeckOption,
    openingStationsOption,
    piecesOption,
    ...elevatedOptions
]

export const DRAFT_SIZE = 3
export const DRAFT_DISCARDS = 1

export function isDraftThree(config?: EarendelGameConfig): boolean {
    return (config?.turnStyle ?? TurnStyle.DraftThree) === TurnStyle.DraftThree
}

export function hasOpeningStations(config?: EarendelGameConfig): boolean {
    return config?.openingStations ?? openingStationsOption.default
}

export function drawCountFor(config?: EarendelGameConfig): number {
    return isDraftThree(config) ? DRAFT_SIZE : 1
}
