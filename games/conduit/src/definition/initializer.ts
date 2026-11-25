import {
    assertExists,
    BaseGameInitializer,
    Game,
    type GameInitializer,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    shuffle,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import {
    type ConduitGameState,
    type ConduitProjectedState,
    HydratedConduitGameState
} from '../model/gameState.js'
import { newPlayerState } from '../model/playerState.js'
import { CentralCell, neighborCell, type PlacedStation } from '../model/board.js'
import { BaseLetters, Side, StationLetter, tileIdsOfLetter } from '../components/tiles.js'
import { MachineState } from './states.js'
import { ConduitColors } from './colors.js'

// One tile from each of the A-D groups forms a cross around the Central Station: A to the North,
// B to the East, C to the South and D to the West, each turned at random.
const SetupCross = [
    { letter: StationLetter.A, side: Side.North },
    { letter: StationLetter.B, side: Side.East },
    { letter: StationLetter.C, side: Side.South },
    { letter: StationLetter.D, side: Side.West }
] as const

export class ConduitGameInitializer
    extends BaseGameInitializer<ConduitProjectedState, HydratedConduitGameState>
    implements GameInitializer<ConduitProjectedState, HydratedConduitGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedConduitGameState {
        const prng = new Prng(state.prng)
        assertExists(state.protectedPrng, 'Shuffling the tiles requires protectedPrng')
        const protectedPrng = new Prng(state.protectedPrng)

        const colors = structuredClone(ConduitColors)
        shuffle(colors, prng.random)
        const players = game.players.map((player, index) =>
            newPlayerState(player.id, colors[index])
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)

        // Each letter's tiles are shuffled apart for the cross; the rest are shuffled together into
        // one stack.
        const groups = BaseLetters.map((letter) => {
            const tileIds = tileIdsOfLetter(letter)
            shuffle(tileIds, protectedPrng.random)
            return tileIds
        })
        const stations = SetupCross.map(({ side }, index): PlacedStation => {
            const tileId = groups[index].shift()
            assertExists(tileId, 'Every letter has tiles')
            return {
                cell: neighborCell(CentralCell, side),
                tileId,
                rotation: Math.floor(prng.random() * 4),
                faceUp: true,
                cubes: 0
            }
        })
        const rest = groups.flat()
        shuffle(rest, protectedPrng.random)

        const conduitState: ConduitGameState = Object.assign(state, {
            players,
            turnManager,
            machineState: MachineState.Bidding,
            roundManager: HydratedRoundManager.generate(),
            deck: { items: rest, remaining: rest.length },
            market: [],
            board: { stations },
            bidPasses: []
        })
        const hydrated = new HydratedConduitGameState(conduitState)
        hydrated.fillMarket()
        return hydrated
    }
}
