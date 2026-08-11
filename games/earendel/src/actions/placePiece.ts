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
import { Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { explorablePlanets } from '../util/exploration.js'
import { chainsCompletedBy } from '../util/chains.js'
import { stationGroupPoints } from '../util/stations.js'
import { applyTechnologyGains } from '../util/technologyGrants.js'
import { destroyableTargets } from '../util/attack.js'
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
    technologiesGained: Type.Optional(Type.Record(Type.String(), Type.Array(Type.String()))),
    // Planets this probe could explore from where it landed. One of them will be explored -
    // the player picks which - and the rest stay unexplored. Absent when the placement
    // reached no unexplored planet, or wasn't a probe at all.
    explorable: Type.Optional(Type.Array(AxialCoordinates))
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

        // The ship was drawn when the turn opened, so the player chose this hex already
        // knowing what they had. Spending a special instead sends the drawn ship back.
        let piece: Piece
        let returnedToBag: Piece | undefined

        if (this.pieceSource === PieceSource.Bag) {
            piece = state.drawnPiece!
        } else {
            piece = playerState.specialPieces.splice(
                playerState.specialPieces.findIndex((candidate) => candidate.id === this.pieceId),
                1
            )[0]

            returnedToBag = state.drawnPiece
            if (returnedToBag) {
                // Back in and reshuffled, so putting one back tells the player nothing about
                // what comes next.
                playerState.bag.push(returnedToBag)
                shuffle(playerState.bag, state.getPrng().random)
            }
        }

        state.drawnPiece = undefined
        state.board.hexes[hexKey(this.coords)].piece = piece

        // A station pays for the company it keeps: one for itself, one for each station
        // already in the group it joins. Scored on every placement, so a cluster built up
        // one station at a time pays 1, 2, 3, ...
        const stationPoints =
            piece.type === PieceType.Station
                ? stationGroupPoints(state.board, this.playerId, this.coords)
                : 0
        playerState.score += stationPoints

        // Joining two planets of one colour pays T(n) on the n ships between them. Scored
        // here, on the placement that completes it, and never again for that pair.
        const chains = chainsCompletedBy(
            state.board,
            this.playerId,
            this.coords,
            state.scoredPlanetPairs
        )
        for (const chain of chains) {
            playerState.score += chain.points
            state.scoredPlanetPairs.push(chain.pairKey)
        }

        // Taking outright hold of an explored planet hands its technology over, permanently.
        // A probe can never do this - zero power holds nothing - but the check is general.
        const technologiesGained = applyTechnologyGains(state, this.coords)

        // A fighter arrives shooting: it may destroy one adjacent piece weaker than itself.
        // Optional, and the target is the player's choice, so it parks a decision rather
        // than resolving here.
        const targets = destroyableTargets(state.board, this.coords, this.playerId)
        if (targets.length > 0) {
            state.pendingAttack = {
                playerId: this.playerId,
                fighterCoords: this.coords,
                targets
            }
        }

        // A probe landing beside unexplored planets doesn't resolve anything here: which
        // planet it explores is the player's choice, and the reveal that follows consumes the
        // technology deck. Both belong in their own actions so each is separately undoable
        // and the deck is only touched once the target is settled.
        const explorable = explorablePlanets(state.board, this.coords, piece.type)
        if (explorable.length > 0) {
            state.pendingExploration = {
                playerId: this.playerId,
                probeCoords: this.coords,
                // A probe won from a technology may not carry a level of its own; the
                // weaker level is the safe reading.
                probeLevel: piece.level ?? PieceLevel.Two,
                candidatePlanets: explorable
            }
        }

        this.metadata = {
            pieceType: piece.type,
            ...(returnedToBag ? { returnedToBag } : {}),
            ...(stationPoints > 0 ? { stationGroupPoints: stationPoints } : {}),
            ...(chains.length > 0
                ? { chains: chains.map(({ pairKey: _pairKey, ...chain }) => chain) }
                : {}),
            ...(Object.keys(technologiesGained).length > 0 ? { technologiesGained } : {}),
            ...(explorable.length > 0 ? { explorable } : {})
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
            // The draw happens when the turn opens, so there is always something face up by
            // the time a placement arrives - unless the turn has gone wrong elsewhere.
            if (!state.drawnPiece) return 'Nothing has been drawn to place.'
            piece = state.drawnPiece
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
