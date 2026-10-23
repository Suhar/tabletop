import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, hexKey, sameHex } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { resolveArrival } from '../util/arrival.js'
import { canUseCooldownEffect, startCooldown } from '../util/cooldowns.js'
import { planetsBeside, wormholeDestinations } from '../util/wormhole.js'
import { ScoredChain } from '../model/chains.js'

export type UseTradeRouteWormholeMetadata = Type.Static<typeof UseTradeRouteWormholeMetadata>
export const UseTradeRouteWormholeMetadata = Type.Object({
    // Which ship travelled, for history - the hexes alone say nothing a reader would recognise.
    pieceType: Type.Optional(Type.Enum(PieceType)),
    // The same arrival bookkeeping a placement records, because the ship arrives as if placed.
    stationGroupPoints: Type.Optional(Type.Number()),
    chains: Type.Optional(Type.Array(ScoredChain)),
    probeDestinations: Type.Optional(Type.Array(AxialCoordinates))
})

export type UseTradeRouteWormhole = Type.Static<typeof UseTradeRouteWormhole>
export const UseTradeRouteWormhole = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseTradeRouteWormhole),
            playerId: Type.String(),
            // The ship being sent, and the empty hex it arrives on.
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(UseTradeRouteWormholeMetadata)
        })
    ])
)

export const UseTradeRouteWormholeValidator = Compile(UseTradeRouteWormhole)

export function isUseTradeRouteWormhole(action?: GameAction): action is UseTradeRouteWormhole {
    return action?.type === ActionType.UseTradeRouteWormhole
}

// Sends a ship from beside one planet to beside a different planet of the same colour, where it
// counts as newly placed.
//
// The colour is the route: two planets of one colour are the two ends of a wormhole, and anything
// standing beside one can be at the other. Which pair of planets justified the hop is not part of
// the action - a ship beside two planets has two colours to travel on, so the player picks a
// destination hex and the engine checks that some pair exists. See wormholeDestinations.
//
// "Newly placed" is the same promise Tactical Feint makes, and it is kept by the same code:
// resolveArrival. So a station arriving pays for its new complex, a chain the hop completes pays,
// a fighter fires, a probe explores, and control is recomputed.
export class HydratedUseTradeRouteWormhole
    extends HydratableAction<typeof UseTradeRouteWormhole>
    implements UseTradeRouteWormhole
{
    declare type: ActionType.UseTradeRouteWormhole
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: UseTradeRouteWormholeMetadata

    constructor(data: UseTradeRouteWormhole) {
        super(data, UseTradeRouteWormholeValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseTradeRouteWormholeReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseTradeRouteWormhole action: ${invalidReason}`)
        }

        const fromHex = state.board.hexes[hexKey(this.from)]
        const piece = fromHex.piece!

        delete fromHex.piece
        state.board.hexes[hexKey(this.to)].piece = piece

        startCooldown(state, this.playerId, TechnologyEffectKind.TradeRouteWormhole)

        // After the hop, so the board the arrival is measured against is the one the hop made -
        // including the gap the ship left behind, which can break a chain it was part of.
        const { stationPoints, chains, probeDestinations } = resolveArrival(state, this.playerId, this.to)

        this.metadata = {
            pieceType: piece.type,
            ...(stationPoints > 0 ? { stationGroupPoints: stationPoints } : {}),
            ...(chains.length > 0
                ? { chains: chains.map(({ pairKey: _pairKey, ...chain }) => chain) }
                : {}),
            ...(probeDestinations.length > 0 ? { probeDestinations } : {})
        }
    }

    isValidUseTradeRouteWormhole(state: HydratedEarendelGameState): boolean {
        return this.invalidUseTradeRouteWormholeReason(state) === undefined
    }

    invalidUseTradeRouteWormholeReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        // The arrival can raise a shot or an exploration of its own, and there is one slot for
        // each: travelling on top of a decision already waiting would overwrite it.
        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        if (!canUseCooldownEffect(state, this.playerId, TechnologyEffectKind.TradeRouteWormhole)) {
            return 'Your Trade Route Wormhole is not ready.'
        }

        const piece = getHex(state.board, this.from)?.piece
        if (!piece) return 'There is no ship there.'
        if (piece.playerId !== this.playerId) return "That ship isn't yours."

        if (planetsBeside(state.board, this.from).length === 0) {
            return 'Only a ship standing beside a planet can travel.'
        }

        // The one check, rather than a series: the destination list already knows that the hex is
        // empty, that it touches a different planet of a colour this ship can travel on, and that
        // a station blockade doesn't shut a probe out of it.
        const destinations = wormholeDestinations(state.board, this.from, this.playerId)
        if (destinations.length === 0) {
            return 'That ship has nowhere to travel to.'
        }
        if (!destinations.some((destination) => sameHex(destination, this.to))) {
            return 'A wormhole only reaches an empty hex beside a different planet of the same colour.'
        }

        return undefined
    }
}
