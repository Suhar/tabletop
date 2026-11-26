// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Each is reached by real play from a seeded start, so its history and Undo work in the harness.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, GameEngine, PlayerStatus } from '@tabletop/common'
import {
    ActionType,
    ConduitGameStateValidator,
    ConduitInfo,
    ConduitRuntime,
    Definition,
    extraCubesPrice,
    MachineState
} from '@tabletop/conduit'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const NAMES = ['Ada', 'Ben', 'Cleo', 'Dev', 'Eve']

function table(slug, playerCount) {
    const engine = new GameEngine(ConduitRuntime)
    const game = ConduitRuntime.initializer.initializeGame(
        {
            id: `scenario-${slug}`,
            name: slug,
            typeId: ConduitInfo.id,
            ownerId: 'owner',
            config: {},
            players: NAMES.slice(0, playerCount).map((name, index) => ({
                id: `p${index}`,
                name,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const started = engine.startGame(game, { masterSeed: MASTER_SEED })
    let state = started.initialState
    const actions = []
    let count = 0

    const act = (type, payload = {}) => {
        const action = {
            id: `${slug}-${count++}`,
            gameId: started.startedGame.id,
            playerId: state.activePlayerIds[0],
            source: ActionSource.User,
            type,
            ...payload
        }
        const result = engine.executeCanonicalAction({ game: started.startedGame, state, action })
        state = result.updatedState
        actions.push(...result.processedActions)
    }
    const hydrated = () => ConduitRuntime.hydrator.hydrateState(structuredClone(state))

    const step = () => {
        const view = hydrated()
        switch (state.machineState) {
            case MachineState.Bidding: {
                const playerId = state.activePlayerIds[0]
                if (view.bidsBy(playerId) >= 2) {
                    act(ActionType.PassBid)
                    return
                }
                const spots = view.biddableSpots()
                act(ActionType.PlaceBid, { spot: spots[count % spots.length] })
                return
            }
            case MachineState.Offering: {
                const offer = view.currentOffer()
                const buys = offer.price <= 4 && view.canAfford(offer.playerId)
                act(buys ? ActionType.BuyTile : ActionType.PassTile)
                return
            }
            case MachineState.Placing: {
                const placement = view.pendingPlacement()
                const [option] = view.grid().legalPlacements(placement.tileId, placement.faceUp)
                const { supply, cash } = view.getPlayerState(placement.playerId)
                const oneExtra = extraCubesPrice(1)
                const extra = placement.faceUp && supply > 0 && cash >= oneExtra ? 1 : 0
                act(ActionType.PlaceTile, {
                    cell: option.cell,
                    rotation: option.rotations[0],
                    extraCubes: extra
                })
                return
            }
            case MachineState.ChoosingRoutes: {
                const choice = view.pendingRouteChoice()
                act(ActionType.ChooseRoute, {
                    tileId: choice.tileId,
                    route: choice.options[0].cells
                })
                return
            }
            default:
                throw Error(`No decision in ${state.machineState}`)
        }
    }

    const playUntil = (done) => {
        for (let guard = 0; !done(hydrated()); guard++) {
            if (guard > 2000) throw Error(`${slug}: the position never came up`)
            step()
        }
    }

    const write = () => {
        if (!ConduitGameStateValidator.Check(state)) throw Error(`${slug}: invalid state`)
        const file = { game: started.startedGame, state, actions }
        writeFileSync(join(OUT, `${slug}.json`), `${JSON.stringify(file, null, 2)}\n`)
        console.log(`${slug}.json: ${actions.length} actions, ${state.machineState}`)
    }

    return { act, playUntil, write, hydrated }
}

{
    const scenario = table('mid-game-grid', 4)
    scenario.playUntil((view) => view.round === 3 && view.machineState === MachineState.Bidding)
    scenario.write()
}

{
    const scenario = table('stacked-offer', 3)
    const order = scenario.hydrated().turnManager.turnOrder
    const [first, , third] = order
    const bids = [1, 2, 2, 1, 2, 1, 1]
    for (const spot of bids) scenario.act(ActionType.PlaceBid, { spot })
    for (let pass = 0; pass < 3; pass++) scenario.act(ActionType.PassBid)
    const view = scenario.hydrated()
    if (view.machineState !== MachineState.Offering) throw Error('stacked-offer: bidding goes on')
    if (view.market[0].bids.join() !== [first, first, third, first].join())
        throw Error(`stacked-offer: track is ${view.market[0].bids.join()}`)
    scenario.write()
}

{
    const span = (values) => Math.max(...values, 0) - Math.min(...values, 0) + 1
    const spans = (view) => [
        span(view.board.stations.map((station) => station.cell.col)),
        span(view.board.stations.map((station) => station.cell.row))
    ]
    const scenario = table('placing-a-station', 4)
    scenario.playUntil(
        (view) =>
            view.machineState === MachineState.Placing &&
            view.pendingPlacement()?.faceUp === true &&
            Math.max(...spans(view)) === 6
    )
    console.log(
        `placing-a-station: round ${scenario.hydrated().round}, grid ${spans(scenario.hydrated()).join('x')}`
    )
    scenario.write()
}

{
    const scenario = table('last-tile', 3)
    scenario.playUntil(
        (view) =>
            view.round === 5 &&
            view.machineState === MachineState.Placing &&
            view.market.filter((spot) => spot.tileId !== undefined).length === 1
    )
    scenario.write()
}

{
    const scenario = table('route-choice', 4)
    scenario.playUntil((view) => view.machineState === MachineState.ChoosingRoutes)
    const choice = scenario.hydrated().pendingRouteChoice()
    console.log(
        `route-choice: round ${scenario.hydrated().round}, ${choice.playerId}'s tile ${choice.tileId}, options ${choice.options.map((option) => option.tolls.join('+') || 'none').join(' / ')}`
    )
    scenario.write()
}
