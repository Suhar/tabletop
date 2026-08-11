import * as Type from 'typebox'

// The ships a player draws from their bag. More types are expected to arrive as rewards
// for exploring planets (see the special pieces held face-up in front of a player), so
// nothing here assumes these three are the whole set - power is looked up per piece.
export enum PieceType {
    Probe = 'probe',
    Station = 'station',
    Fighter = 'fighter'
}

// Probes and fighters come in two levels, and a player knows which they drew before deciding
// where to place it. The number means something different for each: a probe's level is how
// many technology cards it reveals, a fighter's level IS its power, and so also decides what
// it can destroy on arrival.
export enum PieceLevel {
    // Only ever reached by damage: nothing is drawn at level 1. A fighter worn down this far is
    // one more hit from destruction, and contributes only as much power as a station.
    One = 1,
    Two = 2,
    Three = 3
}

// Base power by type, for pieces that carry no level of their own - a special piece won from
// a technology, say. Anything added later just needs an entry here.
export const PIECE_POWER: Record<PieceType, number> = {
    [PieceType.Probe]: 0,
    [PieceType.Station]: 1,
    [PieceType.Fighter]: 2
}

export type Piece = Type.Static<typeof Piece>
export const Piece = Type.Object({
    id: Type.String(),
    playerId: Type.String(),
    type: Type.Enum(PieceType),
    // Probes and fighters. Absent on anything else.
    level: Type.Optional(Type.Enum(PieceLevel))
})

// How much this piece contributes toward controlling an adjacent planet, and - for a fighter -
// how much it has to beat to destroy something. A probe contributes nothing: it's an
// explorer, not a claim. A fighter's level is its power, so a level 3 fighter both holds
// planets harder and kills more.
export function powerOf(piece: Piece): number {
    if (piece.type === PieceType.Fighter) {
        return piece.level ?? PIECE_POWER[PieceType.Fighter]
    }
    return PIECE_POWER[piece.type] ?? 0
}

// How many of each type each player starts with in their bag. Probes and fighters are split
// evenly between the two levels (see buildBag), so both counts are even.
export const STARTING_BAG: Record<PieceType, number> = {
    [PieceType.Probe]: 8,
    [PieceType.Station]: 6,
    [PieceType.Fighter]: 8
}

// Which types are dealt out in two levels, three of each.
export const LEVELLED_TYPES: PieceType[] = [PieceType.Probe, PieceType.Fighter]
