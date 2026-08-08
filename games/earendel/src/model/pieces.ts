import * as Type from 'typebox'

// The ships a player draws from their bag. More types are expected to arrive as rewards
// for exploring planets (see the special pieces held face-up in front of a player), so
// nothing here assumes these three are the whole set - power is looked up per type.
export enum PieceType {
    Probe = 'probe',
    Station = 'station',
    Fighter = 'fighter'
}

// How much a piece contributes toward controlling an adjacent planet. A probe contributes
// nothing: it's an explorer, not a claim. Anything added later just needs an entry here.
export const PIECE_POWER: Record<PieceType, number> = {
    [PieceType.Probe]: 0,
    [PieceType.Station]: 1,
    [PieceType.Fighter]: 2
}

export function powerOf(type: PieceType): number {
    return PIECE_POWER[type] ?? 0
}

// How many of each type each player starts with in their bag.
export const STARTING_BAG: Record<PieceType, number> = {
    [PieceType.Probe]: 6,
    [PieceType.Station]: 6,
    [PieceType.Fighter]: 6
}

export type Piece = Type.Static<typeof Piece>
export const Piece = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    type: Type.Enum(PieceType)
})
