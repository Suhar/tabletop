import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Tile } from '../model/tile.js'
import {
    canPlaceTileAt,
    legalTilePlacements,
    openHexesOfTile,
    placeTileOnBoard,
    TILE_ROTATIONS
} from '../util/tilePlacement.js'

export type PlaceTileMetadata = Type.Static<typeof PlaceTileMetadata>
export const PlaceTileMetadata = Type.Object({
    tile: Type.Optional(Tile),
    rotation: Type.Optional(Type.Number()),
    // True when the supply was empty or there was nowhere legal to lay it.
    noTilePlaced: Type.Optional(Type.Boolean()),
    // The tile went down but no ship followed - an empty bag, or no room on the tile.
    noShipPlaced: Type.Optional(Type.Boolean())
})

export type PlaceTile = Type.Static<typeof PlaceTile>
export const PlaceTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceTile),
            playerId: Type.String(),
            // Draws from the shared tile supply, so undo stops here for the same reason it
            // stops at a technology reveal.
            revealsInfo: Type.Literal(true),
            // The tile's origin hex. Absent only when no tile could be laid at all.
            coords: Type.Optional(AxialCoordinates),
            // How far the tile is turned, 0-5. A sixth of a turn each.
            rotation: Type.Optional(Type.Number()),
            metadata: Type.Optional(PlaceTileMetadata)
        })
    ])
)

export const PlaceTileValidator = Compile(PlaceTile)

export function isPlaceTile(action?: GameAction): action is PlaceTile {
    return action?.type === ActionType.PlaceTile
}

// Grows the board: a tile from the supply, laid so that at least two of its hexes touch the
// existing map. The ship that follows is a separate action, because it is a real placement
// and everything a placement triggers has to happen to it.
export class HydratedPlaceTile extends HydratableAction<typeof PlaceTile> implements PlaceTile {
    declare type: ActionType.PlaceTile
    declare playerId: string
    declare revealsInfo: true
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

        const pending = state.pendingTile!

        if (!this.coords) {
            state.pendingTile = undefined
            this.metadata = { noTilePlaced: true }
            return
        }

        placeTileOnBoard(state.board, pending.tile, this.coords, this.rotation ?? 0)

        // The ship that follows is drawn here rather than on entering the next state, so the
        // turn can be routed knowing whether there is anything to place. An empty bag means
        // the tile is laid and that is that.
        const playerState = state.getPlayerState(this.playerId)
        const drawn = playerState.drawFromBag()
        const room = openHexesOfTile(state.board, pending.tile.id).length > 0

        if (drawn && room) {
            state.drawnPiece = drawn
            state.bonusPlacementTileId = pending.tile.id
        } else if (drawn) {
            playerState.bag.push(drawn)
        }

        state.pendingTile = undefined
        this.metadata = {
            tile: pending.tile,
            rotation: this.rotation ?? 0,
            ...(drawn && room ? {} : { noShipPlaced: true })
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
