import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { refreshPlanetControl } from '../util/control.js'
import { ActionType } from '../definition/actions.js'
import { Tile } from '../model/tile.js'
import {
    canPlaceTileAt,
    legalTilePlacements,
    placeTileOnBoard,
    TILE_ROTATIONS
} from '../util/tilePlacement.js'
import { returnToBag } from '../model/bags.js'
import { legalPlacementsOnTile } from '../util/placement.js'

export type PlaceTileMetadata = Type.Static<typeof PlaceTileMetadata>
export const PlaceTileMetadata = Type.Object({
    tile: Type.Optional(Tile),
    rotation: Type.Optional(Type.Number()),
    noTilePlaced: Type.Optional(Type.Boolean()),
    noShipPlaced: Type.Optional(Type.Boolean()),
    tileClosedToShip: Type.Optional(Type.Boolean())
})

export type PlaceTile = Type.Static<typeof PlaceTile>
export const PlaceTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceTile),
            playerId: Type.String(),
            coords: Type.Optional(AxialCoordinates),
            rotation: Type.Optional(Type.Number()),
            metadata: Type.Optional(PlaceTileMetadata)
        })
    ])
)

export const PlaceTileValidator = Compile(PlaceTile)

export function isPlaceTile(action?: GameAction): action is PlaceTile {
    return action?.type === ActionType.PlaceTile
}

export class HydratedPlaceTile extends HydratableAction<typeof PlaceTile> implements PlaceTile {
    declare type: ActionType.PlaceTile
    declare playerId: string
    declare coords?: AxialCoordinates
    declare rotation?: number
    declare metadata?: PlaceTileMetadata

    constructor(data: PlaceTile) {
        super(data, PlaceTileValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidPlaceTileReason(state)
        if (invalidReason) {
            throw Error(`Invalid PlaceTile action: ${invalidReason}`)
        }

        const pending = state.pendingTile
        assertExists(pending, 'PlaceTile requires a pending tile')

        // The ship that follows was drawn with the tile (rules.md, One-shot technologies).
        const drawn = state.heldPieces.find((piece) => piece.id === state.bonusPlacementPieceId)
        const returnDrawn = () => {
            if (!drawn) return
            state.heldPieces = state.heldPieces.filter((piece) => piece.id !== drawn.id)
            state.bonusPlacementPieceId = undefined
            returnToBag(
                state.getPlayerState(this.playerId).bag,
                [drawn],
                state.getProtectedPrng().random
            )
        }

        if (!this.coords) {
            state.pendingTile = undefined
            returnDrawn()
            refreshPlanetControl(state)

            this.metadata = { noTilePlaced: true }
            return
        }

        placeTileOnBoard(state.board, pending.tile, this.coords, this.rotation ?? 0)

        const room =
            drawn !== undefined &&
            legalPlacementsOnTile(state.board, this.playerId, drawn, pending.tile.id).length > 0

        if (room) {
            state.bonusPlacementTileId = pending.tile.id
        } else {
            returnDrawn()
        }

        state.pendingTile = undefined
        this.metadata = {
            tile: pending.tile,
            rotation: this.rotation ?? 0,
            ...(drawn && room ? {} : { noShipPlaced: true }),
            ...(drawn && !room ? { tileClosedToShip: true } : {})
        }
    }

    isValidPlaceTile(state: HydratedEarendelGameState): boolean {
        return this.invalidPlaceTileReason(state) === undefined
    }

    invalidPlaceTileReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingTile
        if (!pending) return 'No tile is waiting to be laid.'
        if (pending.playerId !== this.playerId) return "That tile isn't yours to lay."

        const rotation = this.rotation ?? 0
        if (!Number.isInteger(rotation) || rotation < 0 || rotation >= TILE_ROTATIONS) {
            return 'That is not a rotation a tile can be laid in.'
        }

        if (!this.coords) {
            return legalTilePlacements(state.board).length > 0
                ? 'There is somewhere to lay that tile, so it has to be laid.'
                : undefined
        }

        if (!canPlaceTileAt(state.board, this.coords, rotation)) {
            return 'A tile must cover empty space and touch the board with at least two of its hexes.'
        }

        return undefined
    }
}
