import { type Piece, PieceType, TechnologyEffectKind } from '@tabletop/earendel'

export type SpecialPieceInfo = {
    key: string
    name: string
    // The technology that grants it, whose chip shows it while it waits to be placed.
    grantedBy: TechnologyEffectKind
    // What it does on the table, for its card (rules.md, Granted pieces).
    rules?: string
}

const STATION_HUB: SpecialPieceInfo = {
    key: 'hub',
    name: 'Station Hub',
    grantedBy: TechnologyEffectKind.StationUpgrade,
    rules: 'A station in every respect, with one addition: it doubles the score of its complex when it is placed. After that it counts as an ordinary station.'
}

const TERRAFORMER: SpecialPieceInfo = {
    key: 'terraformer',
    name: 'Terraformer',
    grantedBy: TechnologyEffectKind.Terraforming,
    rules: 'Counts 1 toward control of the planets beside it; fighters cannot attack it. Placed beside a planet no other terraformer touches, its owner may change that planet to another color, for good. An explored planet keeps its technology.'
}

const RELAY: SpecialPieceInfo = {
    key: 'relay',
    name: 'Relay',
    grantedBy: TechnologyEffectKind.RelayNetwork,
    rules: "Counts 1 toward control; fighters cannot attack it. For every rule that reads a line of sight it is one of its owner's stations: it protects probes it sees, links stations it sees, and closes lines to rival probes. Its sight is blocked only by planets. It scores nothing."
}

const GRANTED: Partial<Record<PieceType, SpecialPieceInfo>> = {
    [PieceType.Terraformer]: TERRAFORMER,
    [PieceType.Relay]: RELAY,
    [PieceType.Interdictor]: {
        key: 'interdictor',
        name: 'Interdictor',
        grantedBy: TechnologyEffectKind.Interdiction,
        rules: 'No enemy ship may be placed on, or moved, stormed or wormholed onto, a hex beside it. A feint swap still lands there. Counts 1 toward control; any fighter of level 1 or more can destroy it.'
    },
    [PieceType.NebulaSeeder]: {
        key: 'seeder',
        name: 'Nebula Seeder',
        grantedBy: TechnologyEffectKind.NebulaSeeding,
        rules: "At the start of each of its owner's turns, after the draw, it may turn one empty hex into nebula, up to four in all: a hex beside it, or beside any nebula joined to it through nebula. Nothing is placed on nebula, moves through it, or sees past it."
    },
    [PieceType.Gate]: {
        key: 'gate',
        name: 'Gate',
        grantedBy: TechnologyEffectKind.GateNetwork,
        rules: "A pair from one card, placed on separate turns. Once both stand they are one place: what stands beside one stands beside the other for chains, station links by touch, escorts and probe influence. Not for attacks, torpedoes or control. Every player's ships are joined this way, not only yours."
    },
    [PieceType.ArtificialPlanet]: {
        key: 'planet',
        name: 'Artificial Planet',
        grantedBy: TechnologyEffectKind.ArtificialWorld,
        rules: 'Placed on an empty hex, it becomes an unexplored planet of a color its owner chooses at once; the piece is gone. It is a planet for every rule from then on.'
    },
    [PieceType.QuarantineBeacon]: {
        key: 'beacon',
        name: 'Quarantine Beacon',
        grantedBy: TechnologyEffectKind.Quarantine,
        rules: 'No planet beside it can be surveyed by anyone while it stands, and pending claims on those planets wait, neither paying nor lapsing. Counts 1 toward control.'
    },
    [PieceType.Bastion]: {
        key: 'bastion',
        name: 'Bastion',
        grantedBy: TechnologyEffectKind.BastionWorks,
        rules: 'Every friendly piece beside it is escorted, even under No Quarter. Fighters cannot touch the bastion itself; only a torpedo can. Counts 1 toward control.'
    },
    [PieceType.Jammer]: {
        key: 'jammer',
        name: 'Jammer',
        grantedBy: TechnologyEffectKind.JammerArray,
        rules: "Every station and relay within two hexes, its owner's included, has no sight: no links, no blockades, no relay protection. It does not interrupt an Immediate Download."
    },
    [PieceType.Carrier]: {
        key: 'carrier',
        name: 'Carrier',
        grantedBy: TechnologyEffectKind.CarrierDoctrine,
        rules: 'Counts as a level 3 probe for influence on every planet beside it; it never surveys. Only a level 3 fighter can touch it.'
    },
    [PieceType.DeepScanner]: {
        key: 'scanner',
        name: 'Deep Scanner',
        grantedBy: TechnologyEffectKind.DeepScan,
        rules: 'While it stands its owner draws one more ship each turn and throws one more out: draw four, keep two; under Overdrive, draw four, place three. Two scanners are no better than one.'
    },
    [PieceType.SalvageDrone]: {
        key: 'drone',
        name: 'Salvage Drone',
        grantedBy: TechnologyEffectKind.SalvageOperations,
        rules: "Any probe or fighter destroyed within two hexes goes into the drone owner's bag, as drawn, instead of out of the game. The nearest drone claims it; among equally near, the destroyer's own first."
    }
}

// The special piece a technology grants, for the technology's chip and the unit's card.
export function grantedPieceInfo(kind: TechnologyEffectKind): SpecialPieceInfo | undefined {
    return [STATION_HUB, ...Object.values(GRANTED)].find((info) => info.grantedBy === kind)
}

export function grantedPieceName(kind: TechnologyEffectKind): string | undefined {
    return grantedPieceInfo(kind)?.name
}

export function specialPieceInfo(piece: Piece): SpecialPieceInfo | undefined {
    if (piece.hub) return STATION_HUB
    return GRANTED[piece.type]
}
