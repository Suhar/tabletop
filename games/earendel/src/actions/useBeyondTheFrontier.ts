import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { drawIfAny } from '../model/bags.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { Piece } from '../model/pieces.js'
import { Tile } from '../model/tile.js'
import { legalTilePlacements } from '../util/tilePlacement.js'

export type UseBeyondTheFrontierMetadata = Type.Static<typeof UseBeyondTheFrontierMetadata>
export const UseBeyondTheFrontierMetadata = Type.Object({
    tile: Type.Optional(Tile),
    // The ship drawn to follow the tile, face up; absent when the bag was empty.
    drawn: Type.Optional(Piece)
})

export type UseBeyondTheFrontier = Type.Static<typeof UseBeyondTheFrontier>
export const UseBeyondTheFrontier = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseBeyondTheFrontier),
            playerId: Type.String(),
            // The tile comes out of the hidden supply and its ship out of the bag, so Undo must
            // not reach back past it.
            revealsInfo: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(UseBeyondTheFrontierMetadata)
        })
    ])
)

export const UseBeyondTheFrontierValidator = Compile(UseBeyondTheFrontier)

export function isUseBeyondTheFrontier(action?: GameAction): action is UseBeyondTheFrontier {
    return action?.type === ActionType.UseBeyondTheFrontier
}

// Whether a tile could be drawn and laid: there is one in the supply, and room for it.
export function canGrowBoard(state: HydratedEarendelGameState): boolean {
    return !state.tileSupply.isEmpty() && legalTilePlacements(state.board).length > 0
}

// Beyond the Frontier (rules.md, One-shot technologies): once, when its holder chooses, a tile
// is drawn from the supply for them to lay, and a ship from their bag to follow onto it. Both
// are drawn here, so the player knows the ship before deciding where the tile goes.
export class HydratedUseBeyondTheFrontier
    extends HydratableAction<typeof UseBeyondTheFrontier>
    implements UseBeyondTheFrontier
{
    declare type: ActionType.UseBeyondTheFrontier
    declare playerId: string
    declare revealsInfo?: boolean
    declare metadata?: UseBeyondTheFrontierMetadata

    constructor(data: UseBeyondTheFrontier) {
        super(data, UseBeyondTheFrontierValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseBeyondTheFrontierReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseBeyondTheFrontier action: ${invalidReason}`)
        }

        const playerState = state.getPlayerState(this.playerId)
        playerState.spendStoredEffect(TechnologyEffectKind.GrowBoard)

        const tile = drawIfAny(state.tileSupply)
        assertExists(tile, 'Validated: the supply holds a tile')
        state.pendingTile = { playerId: this.playerId, tile }

        const drawn = playerState.drawFromBag()
        if (drawn) {
            state.heldPieces.push(drawn)
            state.bonusPlacementPieceId = drawn.id
        }

        this.revealsInfo = true
        this.metadata = { tile, ...(drawn ? { drawn } : {}) }
    }

    isValidUseBeyondTheFrontier(state: HydratedEarendelGameState): boolean {
        return this.invalidUseBeyondTheFrontierReason(state) === undefined
    }

    invalidUseBeyondTheFrontierReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'
        if (state.pendingTechnology || state.pendingTile) {
            return 'Finish the technology you are already resolving first.'
        }

        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasStoredEffect(TechnologyEffectKind.GrowBoard)) {
            return 'You have no Beyond the Frontier to use.'
        }
        if (state.tileSupply.isEmpty()) return 'There are no tiles left to lay.'
        if (legalTilePlacements(state.board).length === 0) {
            return 'There is nowhere to lay a tile.'
        }

        return undefined
    }
}
