import * as Type from 'typebox'

export enum PieceType {
    Probe = 'probe',
    Station = 'station',
    Fighter = 'fighter',
    // Only ever a special piece, from Terraforming: never in a bag.
    Terraformer = 'terraformer',
    // Only ever a special piece, from Relay Network: never in a bag.
    Relay = 'relay'
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
    [PieceType.Relay]: 1
}

export type Piece = Type.Static<typeof Piece>
export const Piece = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    type: Type.Enum(PieceType),
    level: Type.Optional(Type.Enum(PieceLevel)),
    // A flag, not a type: a hub is a station for every other rule.
    hub: Type.Optional(Type.Boolean())
})

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
    [PieceType.Relay]: 0
}

export const LEVELLED_TYPES: PieceType[] = [PieceType.Probe, PieceType.Fighter]
