import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    shuffle
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, hexKey, isOpenHex } from '../model/board.js'
import { Piece, PieceType } from '../model/pieces.js'
import { resolveArrival } from '../util/arrival.js'
import { probeBlockedBy } from '../util/lineOfSight.js'
import { ScoredChain } from '../model/chains.js'

// Where the ship being placed comes from. Named pieceSource rather than source because
// GameAction already has a `source` (User vs System) and shadowing it silently breaks the
// action's own contract.
//
// Bag means the piece drawn at the start of this turn, already face up. A player who doesn't
// like what they drew may instead spend one of the special pieces in front of them, in which
// case the drawn piece goes back into the bag - so the source has to be part of the action
// rather than inferred.
export enum PieceSource {
    Bag = 'bag',
    Special = 'special'
}

export type PlacePieceMetadata = Type.Static<typeof PlacePieceMetadata>
export const PlacePieceMetadata = Type.Object({
    // Which ship was placed - for a bag turn the player didn't choose it, so history has to
    // say what they got.
    pieceType: Type.Optional(Type.Enum(PieceType)),
    // The drawn ship put back because a special piece was played instead.
    returnedToBag: Type.Optional(Piece),
    // Chains this placement completed, if any: two planets of one colour newly joined by an
    // unbroken run of the player's ships. Recorded because the points are scored here and
    // history has to be able to say why the score moved.
    chains: Type.Optional(Type.Array(ScoredChain)),
    // What a station paid: one for itself and one for every station already in the group it
    // joined. Absent for anything that isn't a station.
    stationGroupPoints: Type.Optional(Type.Number()),
    // Technologies gained by taking outright hold of an explored planet. Kept for good -
    // the planet can be taken away afterwards, the technology can't.
    // Planets this probe could be sent to from where it landed. The player may send it to one
    // of them or keep it on the board. Absent when the placement reached no planet, or wasn't
    // a probe at all.
    probeDestinations: Type.Optional(Type.Array(AxialCoordinates))
})

export type PlacePiece = Type.Static<typeof PlacePiece>
export const PlacePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlacePiece),
            playerId: Type.String(),
            coords: AxialCoordinates,
            pieceSource: Type.Enum(PieceSource),
            // Which ship: one of the pieces in hand, or - when the source is Special - which
            // face-up piece is being spent. Optional only because a hand of one has nothing
            // to express.
            pieceId: Type.Optional(Type.String()),
            metadata: Type.Optional(PlacePieceMetadata)
        })
    ])
)

export const PlacePieceValidator = Compile(PlacePiece)

export function isPlacePiece(action?: GameAction): action is PlacePiece {
    return action?.type === ActionType.PlacePiece
}

// The ordinary turn: take a ship - drawn blind from your own bag, or spent from the special
// pieces in front of you - and put it on an open hex. A probe placed beside an unexplored
// planet explores it, without that being a separate decision.
export class HydratedPlacePiece extends HydratableAction<typeof PlacePiece> implements PlacePiece {
    declare type: ActionType.PlacePiece
    declare playerId: string
    declare coords: AxialCoordinates
    declare pieceSource: PieceSource
    declare pieceId?: string
    declare metadata?: PlacePieceMetadata

    constructor(data: PlacePiece) {
        super(data, PlacePieceValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidPlacePieceReason(state)
        if (invalidReason) {
            throw Error(`Invalid PlacePiece action: ${invalidReason}`)
        }

        const playerState = state.getPlayerState(this.playerId)

        // The ship was drawn when the turn opened, so the player chose this hex already
        // knowing what they had. Spending a special instead sends the drawn ship back.
        let piece: Piece
        let returnedToBag: Piece | undefined

        if (this.pieceSource === PieceSource.Bag) {
            const index = heldIndex(state, this.pieceId)
            piece = state.heldPieces.splice(index, 1)[0]
        } else {
            piece = playerState.specialPieces.splice(
                playerState.specialPieces.findIndex((candidate) => candidate.id === this.pieceId),
                1
            )[0]

            // The hand goes back in the bag, since a special piece is played instead of it.
            returnedToBag = state.heldPieces[0]
            if (state.heldPieces.length > 0) {
                playerState.bag.push(...state.heldPieces)
                state.heldPieces = []
                // Reshuffled, so putting one back tells the player nothing about what is next.
                shuffle(playerState.bag, state.getPrng().random)
            }
        }

        state.board.hexes[hexKey(this.coords)].piece = piece

        // Everything the arrival sets off - station points, chains, a fighter's shot, a probe's
        // exploration, control - lives in resolveArrival, because Tactical Feint has to be able
        // to do all of it to a ship it swapped into place rather than played from hand.
        const { stationPoints, chains, probeDestinations } = resolveArrival(
            state,
            this.playerId,
            this.coords
        )

        this.metadata = {
            pieceType: piece.type,
            ...(returnedToBag ? { returnedToBag } : {}),
            ...(stationPoints > 0 ? { stationGroupPoints: stationPoints } : {}),
            ...(chains.length > 0
                ? { chains: chains.map(({ pairKey: _pairKey, ...chain }) => chain) }
                : {}),
            ...(probeDestinations.length > 0 ? { probeDestinations } : {})
        }
    }

    isValidPlacePiece(state: HydratedEarendelGameState): boolean {
        return this.invalidPlacePieceReason(state) === undefined
    }

    // Same checks as isValidPlacePiece, but reports WHY - the client shows this instead of a
    // generic rejection (see the legality wrappers pattern).
    invalidPlacePieceReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) {
            return "It isn't your turn."
        }

        // Any open hex, anywhere. Deliberately no adjacency or connection requirement - the
        // whole board is in play every turn - so this being the only spatial check is the
        // rule, not an unfinished one.
        if (!isOpenHex(state.board, this.coords)) {
            return 'A ship can only go on an empty hex of open space - not on a planet, and not on an occupied hex.'
        }

        const playerState = state.getPlayerState(this.playerId)
        let piece: Piece | undefined

        if (this.pieceSource === PieceSource.Bag) {
            // The draw happens when the turn opens, so there is always something in hand by
            // the time a placement arrives - unless the turn has gone wrong elsewhere.
            if (state.heldPieces.length === 0) return 'Nothing has been drawn to place.'
            if (!this.pieceId && state.heldPieces.length > 1) {
                return 'Choose which of your ships to place.'
            }
            piece = this.pieceId
                ? state.heldPieces.find((candidate) => candidate.id === this.pieceId)
                : state.heldPieces[0]
            if (!piece) return "That ship isn't one of the ones you are holding."
        } else {
            if (!this.pieceId) return 'No special piece was chosen.'
            piece = playerState.specialPieces.find((candidate) => candidate.id === this.pieceId)
            if (!piece) return "That special piece isn't in front of you."
        }

        // The ship that follows a laid tile has to land on that tile - it is part of the
        // technology's effect, not a free placement anywhere.
        if (state.bonusPlacementTileId) {
            const hex = getHex(state.board, this.coords)
            if (hex?.tileId !== state.bonusPlacementTileId) {
                return 'That ship must be placed on the tile you just laid.'
            }
            if (this.pieceSource === PieceSource.Special) {
                return 'The ship that follows a tile is the one drawn with it.'
            }
            if (state.bonusPlacementPieceId && piece.id !== state.bonusPlacementPieceId) {
                return 'The ship drawn with the tile is the one that goes on it.'
            }
        }

        // Two of a player's stations with clear space between them close that space to
        // everyone else's probes. Only probes - anything else may be placed there, and doing
        // so breaks the line. This check is possible at all because the draw now happens
        // before the hex is chosen, so the engine knows what is being placed.
        if (piece.type === PieceType.Probe && probeBlockedBy(state.board, this.coords, this.playerId)) {
            return 'Two enemy stations watch that space — no probe of yours can enter it.'
        }

        return undefined
    }
}

// Which held ship a placement refers to. A hand of one needs no id; a drafted hand does, and
// validation has already insisted on it by the time this runs.
function heldIndex(state: HydratedEarendelGameState, pieceId?: string): number {
    if (!pieceId) return 0
    return state.heldPieces.findIndex((piece) => piece.id === pieceId)
}
