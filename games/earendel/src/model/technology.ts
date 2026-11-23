import { assertExists } from '@tabletop/common'
import { PLANET_COLORS, PlanetColor } from './planetColor.js'

export enum TechnologyTier {
    Standard = 'standard',
    Elevated = 'elevated'
}

export enum TechnologyEffectKind {
    MoveFriendlyPiece = 'moveFriendlyPiece',
    GrowBoard = 'growBoard',
    LogisticsUpgrade = 'logisticsUpgrade',
    ImmediateDownload = 'immediateDownload',
    SpoofedOrders = 'spoofedOrders',
    AsteroidField = 'asteroidField',
    SecurityBreach = 'securityBreach',
    WarpDrive = 'warpDrive',
    DimensionalRift = 'dimensionalRift',
    Conscription = 'conscription',
    FactoryOverride = 'factoryOverride',
    ColonyShip = 'colonyShip',
    Railgun = 'railgun',
    UpdatedLogistics = 'updatedLogistics',
    FullTorpedoSpread = 'fullTorpedoSpread',
    GammaTorpedo = 'gammaTorpedo',
    TacticalFeint = 'tacticalFeint',
    TradeRouteWormhole = 'tradeRouteWormhole',
    StationUpgrade = 'stationUpgrade',
    Terraforming = 'terraforming',
    RelayNetwork = 'relayNetwork',
    // Elevated events: fired for every player when their planet is surveyed (rules.md, Elevated
    // technologies).
    OrbitalBombardment = 'orbitalBombardment',
    WormholeStorm = 'wormholeStorm',
    SalvageRights = 'salvageRights',
    SignalIntercept = 'signalIntercept',
    ShipyardWorld = 'shipyardWorld',
    // Special pieces (rules.md, Granted pieces).
    Interdiction = 'interdiction',
    BastionWorks = 'bastionWorks',
    GateNetwork = 'gateNetwork',
    CarrierDoctrine = 'carrierDoctrine',
    DeepScan = 'deepScan',
    Quarantine = 'quarantine',
    JammerArray = 'jammerArray',
    ArtificialWorld = 'artificialWorld',
    NebulaSeeding = 'nebulaSeeding',
    SalvageOperations = 'salvageOperations',
    // Elevated rules: in force for everyone from the survey on.
    NoQuarter = 'noQuarter',
    FreeDrift = 'freeDrift',
    Overdrive = 'overdrive',
    SharedScience = 'sharedScience',
    Reinforcements = 'reinforcements'
}

export enum TechnologyTiming {
    Stored = 'stored',
    Cooldown = 'cooldown',
    Grant = 'grant',
    // An elevated event: resolved once for every player, the discoverer first.
    Event = 'event',
    // An elevated rule: a change to the rules for everyone, for the rest of the game.
    Rule = 'rule'
}

// Each planet color's pair of elevated cards: one fires once, one lasts (rules.md, Elevated
// technologies). The game draws one of the two per color at setup.
export const ELEVATED_PAIRS: Record<
    PlanetColor,
    { event: TechnologyEffectKind; rule: TechnologyEffectKind }
> = {
    [PlanetColor.Violet]: {
        event: TechnologyEffectKind.OrbitalBombardment,
        rule: TechnologyEffectKind.NoQuarter
    },
    [PlanetColor.Aqua]: {
        event: TechnologyEffectKind.WormholeStorm,
        rule: TechnologyEffectKind.FreeDrift
    },
    [PlanetColor.Mint]: {
        event: TechnologyEffectKind.SalvageRights,
        rule: TechnologyEffectKind.Overdrive
    },
    [PlanetColor.Periwinkle]: {
        event: TechnologyEffectKind.SignalIntercept,
        rule: TechnologyEffectKind.SharedScience
    },
    [PlanetColor.Teal]: {
        event: TechnologyEffectKind.ShipyardWorld,
        rule: TechnologyEffectKind.Reinforcements
    }
}

// The event a rule's discoverer gets one pick of, alone: the rule's own color's event.
export function siblingEventOf(rule: TechnologyEffectKind): TechnologyEffectKind | undefined {
    return Object.values(ELEVATED_PAIRS).find((pair) => pair.rule === rule)?.event
}

export function elevatedColorOf(kind: TechnologyEffectKind): PlanetColor | undefined {
    return PLANET_COLORS.find((color) => {
        const pair = ELEVATED_PAIRS[color]
        return pair.event === kind || pair.rule === kind
    })
}

export const COOLDOWN_TURNS = 3

// Each category owns a planet color (rules.md, Technology deck).
export enum TechnologyCategory {
    Belligerence = 'belligerence',
    Mobility = 'mobility',
    Acquisitions = 'acquisitions',
    Espionage = 'espionage',
    Expansion = 'expansion'
}

export const TECHNOLOGY_CATEGORY_INFO: Record<
    TechnologyCategory,
    { name: string; description: string; color: PlanetColor }
> = {
    [TechnologyCategory.Belligerence]: {
        name: 'Belligerence',
        description: 'Techs that improve combat ability.',
        color: PlanetColor.Violet
    },
    [TechnologyCategory.Mobility]: {
        name: 'Mobility',
        description: 'Techs that allow movement.',
        color: PlanetColor.Aqua
    },
    [TechnologyCategory.Acquisitions]: {
        name: 'Acquisitions',
        description: 'Techs that expand and control.',
        color: PlanetColor.Mint
    },
    [TechnologyCategory.Espionage]: {
        name: 'Espionage',
        description: 'Techs that mimic and steal.',
        color: PlanetColor.Periwinkle
    },
    [TechnologyCategory.Expansion]: {
        name: 'Expansion',
        description: 'Techs that grow the fleet.',
        color: PlanetColor.Teal
    }
}

// The category whose color a planet has, so its cards mostly come from that category.
export function categoryOfColor(color: PlanetColor): TechnologyCategory {
    const found = Object.values(TechnologyCategory).find(
        (category) => TECHNOLOGY_CATEGORY_INFO[category].color === color
    )
    assertExists(found, `No category owns ${color} planets`)
    return found
}

export const TECHNOLOGY_CATEGORY: Record<TechnologyEffectKind, TechnologyCategory> = {
    [TechnologyEffectKind.Railgun]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.FullTorpedoSpread]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.GammaTorpedo]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.UpdatedLogistics]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.MoveFriendlyPiece]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.TacticalFeint]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.TradeRouteWormhole]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.LogisticsUpgrade]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.GrowBoard]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.ImmediateDownload]: TechnologyCategory.Espionage,
    [TechnologyEffectKind.SpoofedOrders]: TechnologyCategory.Espionage,
    [TechnologyEffectKind.AsteroidField]: TechnologyCategory.Expansion,
    [TechnologyEffectKind.SecurityBreach]: TechnologyCategory.Espionage,
    [TechnologyEffectKind.WarpDrive]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.DimensionalRift]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.Conscription]: TechnologyCategory.Expansion,
    [TechnologyEffectKind.FactoryOverride]: TechnologyCategory.Expansion,
    [TechnologyEffectKind.ColonyShip]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.StationUpgrade]: TechnologyCategory.Expansion,
    [TechnologyEffectKind.Terraforming]: TechnologyCategory.Expansion,
    [TechnologyEffectKind.RelayNetwork]: TechnologyCategory.Espionage,
    [TechnologyEffectKind.Interdiction]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.BastionWorks]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.GateNetwork]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.CarrierDoctrine]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.DeepScan]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.Quarantine]: TechnologyCategory.Espionage,
    [TechnologyEffectKind.JammerArray]: TechnologyCategory.Espionage,
    [TechnologyEffectKind.ArtificialWorld]: TechnologyCategory.Expansion,
    [TechnologyEffectKind.NebulaSeeding]: TechnologyCategory.Expansion,
    [TechnologyEffectKind.SalvageOperations]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.OrbitalBombardment]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.NoQuarter]: TechnologyCategory.Belligerence,
    [TechnologyEffectKind.WormholeStorm]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.FreeDrift]: TechnologyCategory.Mobility,
    [TechnologyEffectKind.SalvageRights]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.Overdrive]: TechnologyCategory.Acquisitions,
    [TechnologyEffectKind.SignalIntercept]: TechnologyCategory.Espionage,
    [TechnologyEffectKind.SharedScience]: TechnologyCategory.Espionage,
    [TechnologyEffectKind.ShipyardWorld]: TechnologyCategory.Expansion,
    [TechnologyEffectKind.Reinforcements]: TechnologyCategory.Expansion
}

export type TechnologyCard = {
    readonly id: string
    readonly colors: readonly PlanetColor[]
    readonly tier: TechnologyTier
    readonly effect: TechnologyEffectKind
}

export const TECHNOLOGY_EFFECT_INFO: Record<
    TechnologyEffectKind,
    { name: string; ability: string; timing: TechnologyTiming }
> = {
    [TechnologyEffectKind.MoveFriendlyPiece]: {
        name: 'Tactical Shift',
        ability:
            'Once, now or later: move any friendly piece into an adjacent empty space. It counts as newly placed there: it scores, explores and attacks.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.GrowBoard]: {
        name: 'Beyond the Frontier',
        ability:
            'Once, now or later: lay a new tile against the board, then place a ship drawn from your bag on it.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.LogisticsUpgrade]: {
        name: 'Logistics Upgrade',
        ability: 'Place the ship you would otherwise discard.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.ImmediateDownload]: {
        name: 'Immediate Download',
        ability:
            'Once: gain the technology of any explored planet within three hexes of this one, whatever lies between; a Jammer does not interrupt it. That technology is yours to use now or later, with no wait.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.SpoofedOrders]: {
        name: 'Spoofed Orders',
        ability:
            "Once, now or later: move a rival's piece that stands beside one of yours into an adjacent empty space. It is moved, not placed: nothing scores, explores or fires for its owner.",
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.WarpDrive]: {
        name: 'Warp Drive',
        ability:
            'Once, now or later: move any friendly piece through any number of empty space hexes. Where it lands, it counts as newly placed: it scores, explores and attacks.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.DimensionalRift]: {
        name: 'Dimensional Rift',
        ability:
            'Once, now or later: move any friendly piece from a hex on the outer border of the map to an empty hex that is also on the border. It counts as newly placed there: it scores, explores and attacks.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.SecurityBreach]: {
        name: 'Security Breach',
        ability:
            'Once, now or later: put a piece of Scrap into the bag of an opponent you choose. Scrap has no function: discarded, it goes back into their bag; played in place of a ship, it does nothing but is gone.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.AsteroidField]: {
        name: 'Asteroid Field',
        ability:
            'Once, now or later: choose level 3 probe, level 3 fighter or station, and put three copies of your choice into your bag, unseen by the others.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.ColonyShip]: {
        name: 'Colony Ship',
        ability:
            'Once, now or later: settle a planet you control. For the rest of the game it counts as one of your stations: it joins the station complexes beside it, scoring with them now and whenever they score.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.FactoryOverride]: {
        name: 'Factory Override',
        ability: 'Once, now or later: draw two extra ships this turn and place them both.',
        timing: TechnologyTiming.Stored
    },
    [TechnologyEffectKind.Conscription]: {
        name: 'Conscription',
        ability: 'Take back the ship you discarded this turn and put it in your bag.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.Railgun]: {
        name: 'Railgun',
        ability: "A fighter's attack destroys its target outright, whatever its health.",
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.FullTorpedoSpread]: {
        name: 'Full Torpedo Spread',
        ability: 'When a fighter attacks, it may hit any or all of its neighbors.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.GammaTorpedo]: {
        name: 'Gamma Torpedo',
        ability:
            "Place a fighter as a torpedo: it destroys itself and an adjacent station, yours or anyone's.",
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.UpdatedLogistics]: {
        name: 'Updated Logistics',
        ability: 'A fighter already on the board may attack one of its neighbors.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.TacticalFeint]: {
        name: 'Tactical Feint',
        ability:
            'Swap one of your ships with an adjacent enemy ship. Your ship counts as newly placed.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.TradeRouteWormhole]: {
        name: 'Trade Route Wormhole',
        ability:
            'Move one of your ships from beside a planet to beside a different planet of the same color. Your ship counts as newly placed.',
        timing: TechnologyTiming.Cooldown
    },
    [TechnologyEffectKind.StationUpgrade]: {
        name: 'Station Upgrade',
        ability:
            'Gain a Station Hub: a station that doubles the score of its cluster, when placed and thereafter.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.Terraforming]: {
        name: 'Terraforming',
        ability:
            'Gain a Terraformer: placed beside a planet no terraformer touches, it may change that planet to another color. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.RelayNetwork]: {
        name: 'Relay Network',
        ability:
            'Gain a Relay: it acts as a station for line of sight, protecting your probes, linking your stations and closing hexes to rival probes, and only planets block its sight. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.Interdiction]: {
        name: 'Interdiction',
        ability:
            'Gain an Interdictor: no enemy ship may be placed or moved onto a hex beside it. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.BastionWorks]: {
        name: 'Bastion Works',
        ability:
            'Gain a Bastion: every friendly piece beside it is escorted, No Quarter or not, and only a torpedo can destroy it. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.GateNetwork]: {
        name: 'Gate Network',
        ability:
            'Gain a pair of Gates. Once both stand, they are one place: what stands beside one stands beside the other for chains, station links, escorts and probe influence. Each counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.CarrierDoctrine]: {
        name: 'Carrier Doctrine',
        ability:
            'Gain a Carrier: it counts as a level 3 probe for influence on every planet beside it, but it cannot survey. Only a level 3 fighter can touch it. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.DeepScan]: {
        name: 'Deep Scan',
        ability:
            'Gain a Deep Scanner: while it stands, you draw one more ship each turn and throw one more out. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.Quarantine]: {
        name: 'Quarantine',
        ability:
            'Gain a Quarantine Beacon: no planet beside it can be surveyed, and pending claims on them wait, while it stands. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.JammerArray]: {
        name: 'Jammer Array',
        ability:
            'Gain a Jammer: every station and relay within two hexes, yours included, has no sight: no links, no blockades, no relay protection. It does not interrupt an Immediate Download. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.ArtificialWorld]: {
        name: 'Artificial World',
        ability:
            'Gain an Artificial Planet: placed on an empty hex, it becomes an unexplored planet of a color you choose.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.NebulaSeeding]: {
        name: 'Nebula Seeding',
        ability:
            'Gain a Nebula Seeder: at the start of each of your turns it may turn one empty hex beside it, or beside nebula joined to it, into nebula, up to four, where nothing is placed, moves or sees. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.SalvageOperations]: {
        name: 'Salvage Operations',
        ability:
            'Gain a Salvage Drone: any probe or fighter destroyed within two hexes of it goes into your bag. It counts 1 toward control.',
        timing: TechnologyTiming.Grant
    },
    [TechnologyEffectKind.OrbitalBombardment]: {
        name: 'Orbital Targeting',
        ability:
            "In the discoverer's chosen order, each player destroys one enemy probe or fighter anywhere on the board.",
        timing: TechnologyTiming.Event
    },
    [TechnologyEffectKind.NoQuarter]: {
        name: 'No Quarter',
        ability:
            'Escorts no longer protect anyone: every ship beside a fighter can be attacked, for the rest of the game.',
        timing: TechnologyTiming.Rule
    },
    [TechnologyEffectKind.WormholeStorm]: {
        name: 'Wormhole Storm',
        ability:
            "In the discoverer's chosen order, each player moves one of their pieces to any empty hex beside any planet.",
        timing: TechnologyTiming.Event
    },
    [TechnologyEffectKind.FreeDrift]: {
        name: 'Free Drift',
        ability:
            'At the start of every turn, the player may step one of their pieces one hex before placing, for the rest of the game.',
        timing: TechnologyTiming.Rule
    },
    [TechnologyEffectKind.SalvageRights]: {
        name: 'Salvage Rights',
        ability:
            "In the discoverer's chosen order, each player gains one technology from the discard pile. Each card goes once.",
        timing: TechnologyTiming.Event
    },
    [TechnologyEffectKind.Overdrive]: {
        name: 'Overdrive',
        ability:
            'Nobody discards any more: every player places all the ships they draw, for the rest of the game.',
        timing: TechnologyTiming.Rule
    },
    [TechnologyEffectKind.SignalIntercept]: {
        name: 'Signal Intercept',
        ability:
            "In the discoverer's chosen order, each player gains the technology of any explored planet. Each planet is intercepted once.",
        timing: TechnologyTiming.Event
    },
    [TechnologyEffectKind.SharedScience]: {
        name: 'Shared Science',
        ability:
            "The moment a player's probe goes into orbit around a planet, every other player with a probe beside it gains the technology too, for the rest of the game.",
        timing: TechnologyTiming.Rule
    },
    [TechnologyEffectKind.ShipyardWorld]: {
        name: 'Shipyard World',
        ability:
            "In the discoverer's chosen order, each player takes one of the special units in play from a stock of one of each.",
        timing: TechnologyTiming.Event
    },
    [TechnologyEffectKind.Reinforcements]: {
        name: 'Global Recycling',
        ability:
            "Discarded ships go back into their owner's bag instead of out of the game, for the rest of the game. Destroyed ships are still lost.",
        timing: TechnologyTiming.Rule
    }
}

// The technologies that grant a special unit (rules.md, Granted pieces), hubs, terraformers
// and relays included: the ones the setup chooses between, one per category.
export const SPECIAL_PIECE_TECHNOLOGIES: readonly TechnologyEffectKind[] = [
    TechnologyEffectKind.StationUpgrade,
    TechnologyEffectKind.Terraforming,
    TechnologyEffectKind.RelayNetwork,
    TechnologyEffectKind.Interdiction,
    TechnologyEffectKind.BastionWorks,
    TechnologyEffectKind.GateNetwork,
    TechnologyEffectKind.CarrierDoctrine,
    TechnologyEffectKind.DeepScan,
    TechnologyEffectKind.SalvageOperations,
    TechnologyEffectKind.Quarantine,
    TechnologyEffectKind.JammerArray,
    TechnologyEffectKind.ArtificialWorld,
    TechnologyEffectKind.NebulaSeeding
]

// The basic special units (rules.md, Granted pieces): the simplest of each category, in play
// unless the game options draw or keep the others.
export const BASIC_PIECE_TECHNOLOGIES: Record<TechnologyCategory, TechnologyEffectKind> = {
    [TechnologyCategory.Belligerence]: TechnologyEffectKind.Interdiction,
    [TechnologyCategory.Mobility]: TechnologyEffectKind.GateNetwork,
    [TechnologyCategory.Acquisitions]: TechnologyEffectKind.CarrierDoctrine,
    [TechnologyCategory.Espionage]: TechnologyEffectKind.RelayNetwork,
    [TechnologyCategory.Expansion]: TechnologyEffectKind.StationUpgrade
}

export function isSpecialPieceTechnology(kind: TechnologyEffectKind): boolean {
    return TECHNOLOGY_EFFECT_INFO[kind].timing === TechnologyTiming.Grant
}

export function isElevatedKind(kind: TechnologyEffectKind): boolean {
    const timing = TECHNOLOGY_EFFECT_INFO[kind].timing
    return timing === TechnologyTiming.Event || timing === TechnologyTiming.Rule
}

export function timingOf(card: TechnologyCard): TechnologyTiming {
    return TECHNOLOGY_EFFECT_INFO[card.effect].timing
}

function effectWithTiming(
    card: TechnologyCard,
    timing: TechnologyTiming
): TechnologyEffectKind | undefined {
    return timingOf(card) === timing ? card.effect : undefined
}

export function storedEffectOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return effectWithTiming(card, TechnologyTiming.Stored)
}

export function grantedPieceOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return effectWithTiming(card, TechnologyTiming.Grant)
}

export function cooldownEffectOf(card: TechnologyCard): TechnologyEffectKind | undefined {
    return effectWithTiming(card, TechnologyTiming.Cooldown)
}

export function technologyName(card: TechnologyCard): string {
    return TECHNOLOGY_EFFECT_INFO[card.effect].name
}

export function technologyAbility(card: TechnologyCard): string {
    return TECHNOLOGY_EFFECT_INFO[card.effect].ability
}

export function matchesColor(card: TechnologyCard, color: PlanetColor): boolean {
    return card.colors.includes(color)
}

export function isElevated(card: TechnologyCard): boolean {
    return card.tier === TechnologyTier.Elevated
}

// Every revealed matching card is a choice, an elevated card among them (rules.md, Elevated
// technologies).
export function choosableFrom(candidates: TechnologyCard[]): TechnologyCard[] {
    return candidates
}
