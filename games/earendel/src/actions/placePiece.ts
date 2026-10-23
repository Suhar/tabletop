import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, hexKey, isOpenHex } from '../model/board.js'
import { Piece, PieceType } from '../model/pieces.js'
import { resolveArrival } from '../util/arrival.js'
import { probeBlockedBy } from '../util/lineOfSight.js'
import { ScoredChain } from '../model/chains.js'
import { returnTo } from '../util/drawBags.js'

// Not `source`: GameAction already has a `source` (User vs System).
export enum PieceSource {
    Bag = 'bag',
    Special = 'special'
}

export type PlacePieceMetadata = Type.Static<typeof PlacePieceMetadata>
export const PlacePieceMetadata = Type.Object({
    pieceType: Type.Optional(Type.Enum(PieceType)),
    returnedToBag: Type.Optional(Piece),
    chains: Type.Optional(Type.Array(ScoredChain)),
    stationGroupPoints: Type.Optional(Type.Number()),
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
            pieceId: Type.Optional(Type.String()),
            metadata: Type.Optional(PlacePieceMetadata)
        })
    ])
)

export const PlacePieceValidator = Compile(PlacePiece)

export function isPlacePiece(action?: GameAction): action is PlacePiece {
    return action?.type === ActionType.PlacePiece
}

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

            returnedToBag = state.heldPieces[0]
            if (state.heldPieces.length > 0) {
                returnTo(playerState.bag, state.heldPieces, state.getProtectedPrng().random)
                state.heldPieces = []
            }
        }

        state.board.hexes[hexKey(this.coords)].piece = piece

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

    invalidPlacePieceReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) {
            return "It isn't your turn."
        }

        if (!isOpenHex(state.board, this.coords)) {
            return 'A ship can only go on an empty hex of open space - not on a planet, and not on an occupied hex.'
        }

        const playerState = state.getPlayerState(this.playerId)
        let piece: Piece | undefined

        if (this.pieceSource === PieceSource.Bag) {
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

        if (
            piece.type === PieceType.Probe &&
            probeBlockedBy(state.board, this.coords, this.playerId)
        ) {
            return 'Two enemy stations watch that space — no probe of yours can enter it.'
        }

        return undefined
    }
}

function heldIndex(state: HydratedEarendelGameState, pieceId?: string): number {
    if (!pieceId) return 0
    return state.heldPieces.findIndex((piece) => piece.id === pieceId)
}
