import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'

export enum PieceType {
    Probe = 'probe',
    Station = 'station',
    Fighter = 'fighter',
    // Only ever a special piece, from Terraforming: never in a bag.
    Terraformer = 'terraformer',
    // Only ever a special piece, from Relay Network: never in a bag.
    Relay = 'relay',
    // Special pieces won from technologies (rules.md, Granted pieces): never in a bag.
    Interdictor = 'interdictor',
    NebulaSeeder = 'nebulaSeeder',
    Gate = 'gate',
    // Placed, it turns its hex into a planet and is gone.
    ArtificialPlanet = 'artificialPlanet',
    QuarantineBeacon = 'quarantineBeacon',
    Bastion = 'bastion',
    Jammer = 'jammer',
    Carrier = 'carrier',
    DeepScanner = 'deepScanner',
    SalvageDrone = 'salvageDrone',
    // Slipped into a rival's bag by a Security Breach (rules.md, One-shot technologies): it is
    // drawn like a ship and does nothing: thrown out it goes back into the bag, and played
    // from the hand it is gone. It is never on the board.
    Scrap = 'scrap'
}

export enum PieceLevel {
    One = 1,
    Two = 2,
    Three = 3
}

export const PIECE_POWER: Record<PieceType, number> = {
    [PieceType.Probe]: 1,
    [PieceType.Station]: 1,
    [PieceType.Fighter]: 2,
    [PieceType.Terraformer]: 1,
    [PieceType.Relay]: 1,
    [PieceType.Interdictor]: 1,
    [PieceType.NebulaSeeder]: 1,
    [PieceType.Gate]: 1,
    [PieceType.ArtificialPlanet]: 0,
    [PieceType.QuarantineBeacon]: 1,
    [PieceType.Bastion]: 1,
    [PieceType.Jammer]: 1,
    [PieceType.Carrier]: 1,
    [PieceType.DeepScanner]: 1,
    [PieceType.SalvageDrone]: 1,
    [PieceType.Scrap]: 0
}

export type Piece = Type.Static<typeof Piece>
export const Piece = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    type: Type.Enum(PieceType),
    level: Type.Optional(Type.Enum(PieceLevel)),
    // A flag, not a type: a hub is a station for every other rule.
    hub: Type.Optional(Type.Boolean()),
    // A flag, not a type: the free station each player places before the first turn (rules.md,
    // Setup). It scored nothing when placed and is a station for every other rule.
    founding: Type.Optional(Type.Boolean()),
    // A flag, not a type: a fighter placed as a Gamma Torpedo, on the board only until it strikes.
    torpedo: Type.Optional(Type.Boolean()),
    // The planet a probe chose to survey. While it stands where it surveyed, its influence
    // counts on that planet alone (rules.md, Probe influence). Cleared when the probe moves.
    surveying: Type.Optional(AxialCoordinates),
    // The two gates of a pair share it; they count as adjacent to each other once both stand.
    pairId: Type.Optional(Type.String()),
    // A nebula seeder: how many nebula hexes it has laid, up to NEBULA_PER_SEEDER.
    seeded: Type.Optional(Type.Number())
})

export const NEBULA_PER_SEEDER = 4
// A carrier counts as a probe of this level for influence, and it takes this much power to hit.
export const CARRIER_LEVEL = 3
// How far a jammer's reach, and a salvage drone's, extends.
export const JAMMER_RANGE = 2
export const SALVAGE_RANGE = 2
// How far an Immediate Download reaches from the planet holding it.
export const DOWNLOAD_RANGE = 3

export function isStationHub(piece: Piece): boolean {
    return piece.type === PieceType.Station && piece.hub === true
}

export function powerOf(piece: Piece): number {
    if (piece.type === PieceType.Fighter) {
        return piece.level ?? PIECE_POWER[PieceType.Fighter]
    }
    return PIECE_POWER[piece.type] ?? 0
}

export const STARTING_BAG: Record<PieceType, number> = {
    [PieceType.Probe]: 8,
    [PieceType.Station]: 6,
    [PieceType.Fighter]: 8,
    [PieceType.Terraformer]: 0,
    [PieceType.Relay]: 0,
    [PieceType.Interdictor]: 0,
    [PieceType.NebulaSeeder]: 0,
    [PieceType.Gate]: 0,
    [PieceType.ArtificialPlanet]: 0,
    [PieceType.QuarantineBeacon]: 0,
    [PieceType.Bastion]: 0,
    [PieceType.Jammer]: 0,
    [PieceType.Carrier]: 0,
    [PieceType.DeepScanner]: 0,
    [PieceType.SalvageDrone]: 0,
    [PieceType.Scrap]: 0
}

export const LEVELED_TYPES: PieceType[] = [PieceType.Probe, PieceType.Fighter]
