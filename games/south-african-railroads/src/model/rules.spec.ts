import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    MachineContext,
    PlayerStatus,
    assertExists,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { SarRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { RailroadId } from '../components/railroads.js'
import { ActionBox } from './actionBoxes.js'
import type { HydratedSarGameState, SarGameState } from './gameState.js'
import { homeLinks } from './track.js'
import { freeBuildHome } from './freeBuild.js'

const engine = new GameEngine(SarRuntime)
const game = SarRuntime.initializer.initializeGame(
    {
        id: 'sar-rules',
        typeId: Definition.info.id,
        ownerId: 'owner',
        config: {},
        players: ['a', 'b', 'c', 'd'].map((id) => ({
            id,
            name: id,
            isHuman: true,
            status: PlayerStatus.Joined
        }))
    },
    Definition
)

let step = 0
function run(state: SarGameState, action: Record<string, unknown>): SarGameState {
    const [playerId] = state.activePlayerIds
    const full: GameAction = {
        id: `t${step++}`,
        gameId: game.id,
        source: ActionSource.User,
        playerId,
        type: ActionType.PassBid,
        ...action
    }
    return engine.executeCanonicalAction({ game, state, action: full }).updatedState
}

// Every opening share goes unbid to its opener, who builds the first home link listed.
function afterInitialOffering(): SarGameState {
    let state = engine.startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: ['a', 'b', 'c', 'd'] }
    }).initialState
    while (state.machineState !== MachineState.ChoosingAction) {
        if (state.machineState === MachineState.Bidding) {
            state = run(state, { type: ActionType.PassBid })
        } else {
            const due = state.freeBuild
            assertExists(due, 'Free build due')
            const linkId = homeLinks(state, freeBuildHome(due.railroadId))[0]
            state = run(state, {
                type: ActionType.BuildTrack,
                railroadId: due.railroadId,
                linkIds: [linkId]
            })
        }
    }
    return state
}

function hydrate(state: SarGameState): HydratedSarGameState {
    return SarRuntime.hydrator.hydrateState(state)
}

describe('the initial offering', () => {
    it('gives every unbid share to its opener and starts with the CMRC holder', () => {
        const state = hydrate(afterInitialOffering())
        expect(state.railroad(RailroadId.CdFM).owners).toEqual(['a'])
        expect(state.railroad(RailroadId.CMRC).owners).toEqual(['a'])
        expect(state.railroad(RailroadId.ZASM).open).toBe(false)
        expect(state.activePlayerIds).toEqual(['a'])
    })

    it('records the starting incomes the rulebook lists', () => {
        const state = hydrate(afterInitialOffering())
        expect(state.income(RailroadId.CdFM)).toBe(4)
        expect(state.income(RailroadId.CSAR)).toBe(4)
        expect(state.income(RailroadId.NRC)).toBe(4)
        expect(state.income(RailroadId.CMRC)).toBe(4)
        expect([4, 6]).toContain(state.income(RailroadId.CTRD))
    })

    it('puts winning bids in the railroad treasury', () => {
        let state = engine.startGame(game, {
            masterSeed: '0123456789abcdef0123456789abcdef',
            startingPositions: { playerIds: ['a', 'b', 'c', 'd'] }
        }).initialState
        state = run(state, { type: ActionType.PlaceBid, amount: 7 })
        for (let pass = 0; pass < 3; pass++) {
            state = run(state, { type: ActionType.PassBid })
        }
        const hydrated = hydrate(state)
        expect(hydrated.machineState).toBe(MachineState.FreeBuild)
        expect(hydrated.railroad(RailroadId.CdFM).treasury).toBe(7)
        expect(hydrated.getPlayerState('a').cash).toBe(63)
    })
})

describe('income and value', () => {
    it('matches the rulebook NRC example', () => {
        const state = hydrate(afterInitialOffering())
        state.track = state.track.filter((built) => built.railroadId !== RailroadId.NRC)
        state.track.push(
            { linkId: 'glencoe-junction~ladysmith', railroadId: RailroadId.NRC },
            { linkId: 'glencoe-junction~vryheid', railroadId: RailroadId.NRC },
            { linkId: 'hlobane~vryheid', railroadId: RailroadId.NRC }
        )
        state.developments = { ladysmith: 1, hlobane: 1 }
        expect(state.income(RailroadId.NRC)).toBe(15)
        expect(state.value(RailroadId.NRC)).toBe(15)
        expect(state.minimumBid(RailroadId.NRC)).toBe(3)
        expect(state.dividendPerShare(RailroadId.NRC)).toBe(3)
    })

    it('rounds the final payoff up over the shares sold', () => {
        const state = hydrate(afterInitialOffering())
        // CdFM: one $5 link worth 4 income, one share sold.
        expect(state.finalPayoffPerShare(RailroadId.CdFM)).toBe(9)
        state.railroad(RailroadId.CdFM).owners.push('b')
        expect(state.finalPayoffPerShare(RailroadId.CdFM)).toBe(5)
    })
})

describe('choosing an action', () => {
    it('forbids repeating the last action except Construct Track', () => {
        const state = hydrate(afterInitialOffering())
        state.getPlayerState('a').locomotive = ActionBox.OfferStock
        expect(state.availableBoxes('a')).not.toContain(ActionBox.OfferStock)
        state.getPlayerState('a').locomotive = ActionBox.ConstructTrack
        expect(state.availableBoxes('a')).toContain(ActionBox.ConstructTrack)
    })

    it('closes a box once its slots are full', () => {
        const state = hydrate(afterInitialOffering())
        state.getPlayerState('b').locomotive = ActionBox.PayDividends
        expect(state.availableBoxes('a')).not.toContain(ActionBox.PayDividends)
        state.getPlayerState('c').locomotive = ActionBox.DevelopSettlements
        expect(state.availableBoxes('a')).toContain(ActionBox.DevelopSettlements)
        state.getPlayerState('d').locomotive = ActionBox.DevelopSettlements
        expect(state.availableBoxes('a')).not.toContain(ActionBox.DevelopSettlements)
    })
})

describe('construction', () => {
    it('never passes a double build through Johannesburg', () => {
        const state = hydrate(afterInitialOffering())
        state.railroad(RailroadId.CTRD).treasury = 15
        state.track.push(
            { linkId: 'klerksdorp~potchefstroom', railroadId: RailroadId.CTRD },
            { linkId: 'klerksdorp~vierfontein', railroadId: RailroadId.CTRD },
            { linkId: 'kroonstad~vierfontein', railroadId: RailroadId.CTRD },
            { linkId: 'dover~kroonstad', railroadId: RailroadId.CTRD }
        )
        const middle = ([first, second]: readonly [string, string]) =>
            first.split('~').find((end) => second.split('~').includes(end))
        const doubles = state.doubleBuilds(RailroadId.CTRD)
        expect(doubles).toContainEqual(['dover~vereeniging', 'johannesburg~vereeniging'])
        expect(doubles.every((build) => middle(build) !== 'johannesburg')).toBe(true)
    })

    it('needs track at Mafeking and pays a rounded-down special dividend', () => {
        let state = afterInitialOffering()
        const hydrated = hydrate(state)
        hydrated.railroad(RailroadId.CTRD).treasury = 30
        hydrated.track.push(
            { linkId: 'mafeking~purdimoe', railroadId: RailroadId.CTRD },
            { linkId: 'purdimoe~warrenton', railroadId: RailroadId.CTRD },
            { linkId: 'kimberley~warrenton', railroadId: RailroadId.CTRD }
        )
        expect(hydrated.connectionBuilds(RailroadId.CTRD).map((c) => c.id)).toEqual([
            'bechuanaland'
        ])
        state = hydrated.dehydrate()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        const owner = hydrate(state).controllers(RailroadId.CTRD)[0]
        const income = hydrate(state).income(RailroadId.CTRD)
        if (state.activePlayerIds[0] !== owner) {
            state = run(state, {
                type: ActionType.DelegateBuild,
                railroadId: RailroadId.CTRD,
                builderId: owner
            })
        }
        const cashBefore = hydrate(state).getPlayerState(owner).cash
        state = run(state, {
            type: ActionType.BuildConnection,
            railroadId: RailroadId.CTRD,
            connectionId: 'bechuanaland'
        })
        const after = hydrate(state)
        const links = after.track.filter((t) => t.railroadId === RailroadId.CTRD).length
        expect(after.value(RailroadId.CTRD)).toBe(links * 5 + 40)
        expect(after.getPlayerState(owner).cash - cashBefore).toBe(Math.floor(income / 5))
    })

    it('opens the ZASM for auction when track reaches Johannesburg', () => {
        let state = afterInitialOffering()
        const hydrated = hydrate(state)
        hydrated.railroad(RailroadId.CdFM).treasury = 5
        hydrated.track.push(
            { linkId: 'kaapmuiden~komatipoort', railroadId: RailroadId.CdFM },
            { linkId: 'kaapmuiden~nelspruit', railroadId: RailroadId.CdFM },
            { linkId: 'machadodorp~nelspruit', railroadId: RailroadId.CdFM },
            { linkId: 'belfast~machadodorp', railroadId: RailroadId.CdFM },
            { linkId: 'belfast~witbank', railroadId: RailroadId.CdFM }
        )
        state = hydrated.dehydrate()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.CdFM,
            linkIds: ['johannesburg~witbank']
        })
        const after = hydrate(state)
        expect(after.machineState).toBe(MachineState.Bidding)
        expect(after.auction?.railroadId).toBe(RailroadId.ZASM)
        expect(after.activePlayerIds).toEqual(['a'])
    })
})

describe('developing settlements', () => {
    it('charges $3 for a second development except in Johannesburg', () => {
        let state = afterInitialOffering()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        state = run(state, { type: ActionType.Develop, settlementId: 'lourenco-marques' })
        const hydrated = hydrate(state)
        expect(hydrated.developmentCost('johannesburg')).toBe(0)
        expect(hydrated.developmentCost('komatipoort')).toBe(3)
        expect(hydrated.mayFinishDeveloping()).toBe(false)
        const cash = hydrated.getPlayerState('a').cash
        state = run(state, { type: ActionType.Develop, settlementId: 'komatipoort' })
        const after = hydrate(state)
        expect(after.getPlayerState('a').cash).toBe(cash - 3)
        expect(after.income(RailroadId.CdFM)).toBe(8)
        expect(after.machineState).toBe(MachineState.ChoosingAction)
    })

    it('lets the player stop after one development once Johannesburg is full', () => {
        const state = hydrate(afterInitialOffering())
        state.developments = { johannesburg: 8 }
        state.developmentsThisTurn = 1
        expect(state.mayFinishDeveloping()).toBe(true)
        expect(
            SarRuntime.stateHandlers[MachineState.DevelopingSettlements].validActionsForPlayer(
                'a',
                new MachineContext({ gameConfig: {}, gameState: state })
            )
        ).toContain(ActionType.FinishDevelopment)
    })
})
