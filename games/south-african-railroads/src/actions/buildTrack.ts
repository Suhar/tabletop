import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../components/railroads.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { DOUBLE_LINK_COST, LINK_COST, homeLinks, isDoubleBuild } from '../model/track.js'
import { freeBuildHome } from '../model/freeBuild.js'

export type BuildTrackMetadata = Type.Static<typeof BuildTrackMetadata>
export const BuildTrackMetadata = Type.Object({
    cost: Type.Number(),
    income: Type.Number(),
    opensZasm: Type.Boolean()
})

export type BuildTrack = Type.Static<typeof BuildTrack>
export const BuildTrack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildTrack),
            playerId: Type.String(),
            metadata: Type.Optional(BuildTrackMetadata),
            railroadId: Type.Enum(RailroadId),
            linkIds: Type.Array(Type.String(), { minItems: 1, maxItems: 2 })
        })
    ])
)

export const BuildTrackValidator = Compile(BuildTrack)

export function isBuildTrack(action?: GameAction): action is BuildTrack {
    return action?.type === ActionType.BuildTrack
}

export class HydratedBuildTrack extends HydratableAction<typeof BuildTrack> implements BuildTrack {
    declare type: ActionType.BuildTrack
    declare playerId: string
    declare metadata?: BuildTrackMetadata
    declare railroadId: RailroadId
    declare linkIds: string[]

    constructor(data: BuildTrack) {
        super(data, BuildTrackValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        const cost = state.freeBuild ? this.validateFreeBuild(state) : this.validatePaidBuild(state)
        const zasmWasClosed = !state.railroad(RailroadId.ZASM).open
        state.railroad(this.railroadId).treasury -= cost
        for (const linkId of this.linkIds) {
            state.track.push({ linkId, railroadId: this.railroadId })
        }
        state.freeBuild = undefined
        state.delegation = undefined
        this.metadata = {
            cost,
            income: state.income(this.railroadId),
            opensZasm: zasmWasClosed && state.reachesJohannesburg(this.linkIds)
        }
    }

    private validateFreeBuild(state: HydratedSarGameState): number {
        const due = state.freeBuild
        assert(
            due?.playerId === this.playerId && due.railroadId === this.railroadId,
            'This free build belongs to another railroad'
        )
        assert(
            this.linkIds.length === 1 &&
                homeLinks(state, freeBuildHome(this.railroadId)).includes(this.linkIds[0]),
            'The free link must leave the railroad’s home'
        )
        return 0
    }

    private validatePaidBuild(state: HydratedSarGameState): number {
        assert(
            state.builderRailroads(this.playerId).includes(this.railroadId),
            'You cannot build for this railroad'
        )
        if (this.linkIds.length === 1) {
            assert(
                state.singleBuilds(this.railroadId).includes(this.linkIds[0]),
                'That link cannot be built'
            )
            return LINK_COST
        }
        assert(
            state.railroad(this.railroadId).treasury >= DOUBLE_LINK_COST &&
                isDoubleBuild(state, this.railroadId, this.linkIds),
            'Those links cannot be built together'
        )
        return DOUBLE_LINK_COST
    }

    static canBuild(state: HydratedSarGameState, playerId: string): boolean {
        if (state.freeBuild) {
            return state.freeBuild.playerId === playerId
        }
        return state
            .builderRailroads(playerId)
            .some((railroadId) => state.singleBuilds(railroadId).length > 0)
    }
}
