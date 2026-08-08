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
        return state
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
            machineState: MachineState.StartOfTurn,
            turnManager: turnManager,
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
            })
        })

        return players
    }
}
