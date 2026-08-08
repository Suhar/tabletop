import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { hexKey, isOpenHex } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { markExplored, planetsExploredBy } from '../util/exploration.js'

// Where the ship being placed comes from. Named pieceSource rather than source because
// GameAction already has a `source` (User vs System) and shadowing it silently breaks the
// action's own contract.
//
// Where the ship being placed comes from. Drawing is the ordinary turn; a player may instead
// spend one of the special pieces sitting face-up in front of them, which is why the source
// has to be part of the action rather than inferred.
export enum PieceSource {
    Bag = 'bag',
    Special = 'special'
}

export type PlacePieceMetadata = Type.Static<typeof PlacePieceMetadata>
export const PlacePieceMetadata = Type.Object({
    // Which ship actually came out of the bag - the player doesn't choose it, so history has
    // to say what they got.
    pieceType: Type.Optional(Type.Enum(PieceType)),
    // Planets this placement discovered, if it was a probe. Empty or absent otherwise.
    explored: Type.Optional(Type.Array(AxialCoordinates))
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
            // Only meaningful when source is Special - which face-up piece is being spent.
            // A bag draw has no choice to express.
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

        // A bag draw is resolved HERE rather than by the client, so the drawn ship is decided
        // by authoritative state and lands in the action log where undo and replay can see it.
        const piece =
            this.pieceSource === PieceSource.Bag
                ? playerState.drawFromBag()!
                : playerState.specialPieces.splice(
                      playerState.specialPieces.findIndex((candidate) => candidate.id === this.pieceId),
                      1
                  )[0]

        state.board.hexes[hexKey(this.coords)].piece = piece

        const explored = markExplored(state.board, planetsExploredBy(state.board, this.coords, piece.type))

        this.metadata = {
            pieceType: piece.type,
            ...(explored.length > 0 ? { explored } : {})
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

        if (!isOpenHex(state.board, this.coords)) {
            return 'A ship can only go on an empty hex of open space - not on a planet, and not on an occupied hex.'
        }

        const playerState = state.getPlayerState(this.playerId)

        if (this.pieceSource === PieceSource.Bag) {
            // An empty bag ends the game rather than blocking a turn, so reaching here means
            // something has gone wrong with the turn order rather than with this placement.
            if (playerState.bagIsEmpty) return 'Your bag is empty.'
            return undefined
        }

        if (!this.pieceId) return 'No special piece was chosen.'
        if (!playerState.specialPieces.some((piece) => piece.id === this.pieceId)) {
            return "That special piece isn't in front of you."
        }

        return undefined
    }
}
