import { flushSync } from 'svelte'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    GameSession,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import {
    ActionType,
    ConduitRuntime,
    Definition,
    HydratedBuyTile,
    MachineState,
    type ConduitProjectedState
} from '@tabletop/conduit'
import { UiDefinition } from '$lib/definitions/definition.js'
import { ConduitUiRuntime } from '$lib/definitions/runtime.js'
import { ConduitGameSession } from '$lib/model/session.svelte.js'

const HarnessDefinition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...ConduitRuntime,
            sessionClass: GameSession,
            colorizer: ConduitUiRuntime.colorizer,
            gameUI: {
                load: async () => {
                    throw Error('The session harness does not render a table')
                },
                mount: () => {
                    throw Error('The session harness does not render a table')
                }
            }
        }
    }
}

const engine = new GameEngine(ConduitRuntime)

// A hotseat game, so the seat on screen is the one the state puts on the clock.
const SeatedGame: Game = {
    ...ConduitRuntime.initializer.initializeGame(
        {
            id: 'conduit-session',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config: {},
            players: ['p0', 'p1', 'p2'].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    ),
    hotseat: true
}

export type PlayedTable = { state: ConduitProjectedState; actions: GameAction[] }

// Plays from a seeded start until the first bought tile waits to be placed: every player bids on
// the first spot until they may pass, and each offer is bought when it can be.
export function firstPlacementTable(): PlayedTable {
    const started = engine.startGame(SeatedGame, { masterSeed: '0123456789abcdef0123456789abcdef' })
    let state = started.initialState
    const actions: GameAction[] = []
    const act = (type: ActionType, payload: Record<string, unknown> = {}) => {
        const action = {
            id: `a-${state.actionCount}`,
            index: state.actionCount,
            gameId: state.gameId,
            source: ActionSource.User,
            playerId: state.activePlayerIds[0],
            type,
            ...payload
        }
        const result = engine.executeAction({ action, state, game: started.startedGame })
        actions.push(...result.processedActions)
        state = result.updatedState
    }
    for (let step = 0; state.machineState !== MachineState.Placing; step++) {
        if (step > 100) throw Error('No tile was bought')
        const view = ConduitRuntime.hydrator.hydrateState(structuredClone(state))
        const seat = view.activePlayerIds[0]
        if (view.machineState === MachineState.Offering)
            act(HydratedBuyTile.canBuyTile(view, seat) ? ActionType.BuyTile : ActionType.PassTile)
        else if (view.canPassBid(seat)) act(ActionType.PassBid)
        else act(ActionType.PlaceBid, { spot: 1 })
    }
    return { state, actions }
}

const open: ConduitGameSession[] = []

export async function openSessionOn(table: PlayedTable): Promise<ConduitGameSession> {
    const appContext = createHarnessAppContext(HarnessDefinition)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: SeatedGame.id
    })
    const session = new ConduitGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: ConduitUiRuntime,
        game: SeatedGame,
        state: table.state,
        actions: table.actions
    })
    open.push(session)
    flushSync()
    await session.waitForVisibleTransitionSettled()
    flushSync()
    return session
}

export function disposeSessions(): void {
    for (const session of open.splice(0)) session.dispose()
}
