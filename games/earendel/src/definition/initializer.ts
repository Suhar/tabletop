import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedEarendelGameState, EarendelGameState } from '../model/gameState.js'
import { HydratedEarendelPlayerState, EarendelPlayerState } from '../model/playerState.js'

import { MachineState } from './states.js'
import { type Piece, PieceType, PROBES_PER_LEVEL, ProbeLevel, STARTING_BAG } from '../model/pieces.js'
import { buildStartingBoard } from '../util/boardSetup.js'
import { buildTechnologyDeck } from '../util/technologyDeck.js'
import { EarendelGameConfig } from './config.js'
import { EarendelColors } from './colors.js'

// This class is responsible for initializing a new game, including setting up the initial game state and
// player states
export class EarendelGameInitializer
    extends BaseGameInitializer<EarendelGameState, HydratedEarendelGameState>
    implements GameInitializer<EarendelGameState, HydratedEarendelGameState>
{
    // When an exploration state is created, in order to avoid allowing the player to discover
    // hidden information, this method can be used to modify the game state to hide such information.
    // Shuffling the remaining cards in a deck would be a reasonable example.
    initializeExplorationState(state: EarendelGameState): EarendelGameState {
        // Exploring a game must not hand over what exploring a PLANET is supposed to reveal.
        // Three things are hidden: the technology deck's order (which is precisely what a
        // probe uncovers), the discard - which becomes the deck when it runs out - and every
        // player's bag, including the explorer's own. Shuffled with Math.random rather than
        // the seeded prng so an exploration branch can't be reproduced from the real game.
        const explorationState = structuredClone(state)
        shuffle(explorationState.technologyDeck, () => Math.random())
        shuffle(explorationState.technologyDiscard, () => Math.random())
        for (const player of explorationState.players) {
            shuffle(player.bag, () => Math.random())
        }
        return explorationState
    }

    // Initialize the game state based on things like the number of players and the game config
    initializeGameState(
        game: Game,
        state: UninitializedGameState
    ): HydratedEarendelGameState {
        // Initialize a pseudo random number generator for the state
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        // Every game state has a turn manager to track whose turn it is
        const turnManager = HydratedTurnManager.generate(players, prng.random)

        // Put players array in our randomly generated turn order
        const orderedPlayers: EarendelPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const config = game.config as EarendelGameConfig

        const earendelGameState: EarendelGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.PlacingPiece,
            turnManager: turnManager,
            // Two tiles per player, each with its own planet layout (see buildStartingBoard).
            board: buildStartingBoard(game.players.length, prng),
            technologyDeck: buildTechnologyDeck(prng),
            technologyDiscard: [],
            scoredPlanetPairs: [],
        })

        // I suppose the engine could actually do the hydration with the hydrator, but this is how it
        // it is done currently.
        return new HydratedEarendelGameState(earendelGameState)
    }

    // Initialize player states for all players in the game
    private initializePlayers(game: Game, prng: Prng): EarendelPlayerState[] {
        // Assign colors randomly to players
        const colors = structuredClone(EarendelColors)
        shuffle(colors, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedEarendelPlayerState({
                playerId: player.id,
                color: colors[index],
                // Each player has their own bag: 6 probes, 6 stations, 6 fighters, shuffled
                // once here and thereafter drawn from the front. Whoever empties theirs ends
                // the game (see EndOfGame), so every player has exactly the same number of
                // turns' worth of pieces.
                bag: buildBag(player.id, prng),
                specialPieces: [],
                score: 0
            })
        })

        return players
    }
}

// One player's starting bag, shuffled. Piece ids are stable and unique so the UI can key on
// them and history can name a specific ship.
function buildBag(playerId: string, prng: Prng): Piece[] {
    const bag: Piece[] = []
    for (const [type, count] of Object.entries(STARTING_BAG) as [PieceType, number][]) {
        for (let index = 0; index < count; index++) {
            // The six probes are three of each level - a level 3 probe reveals more
            // technology when it explores, so which one you draw shapes the turn.
            const level =
                type === PieceType.Probe
                    ? index < PROBES_PER_LEVEL
                        ? ProbeLevel.Two
                        : ProbeLevel.Three
                    : undefined
            bag.push({
                id: `${playerId}-${type}-${index}`,
                playerId,
                type,
                ...(level ? { level } : {})
            })
        }
    }
    shuffle(bag, prng.random)
    return bag
}
