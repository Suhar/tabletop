import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { assertExists, Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { bagOf } from '../util/drawBags.js'
import { HydratedEarendelGameState, EarendelGameState } from '../model/gameState.js'
import { HydratedEarendelPlayerState, EarendelPlayerState } from '../model/playerState.js'

import { turnStartState } from '../util/turn.js'
import { buildBag } from '../util/bag.js'
import { buildStartingBoard } from '../util/boardSetup.js'
import { buildTileSupply } from '../util/tilePlacement.js'
import { buildFocusedTechnologyDeck, buildTechnologyDeck } from '../util/technologyDeck.js'
import { earendelConfig, type EarendelGameConfig, FULL_DECK } from './config.js'
import { isTechnologyEffectKind } from '../model/technology.js'
import { EarendelColors } from './colors.js'

// This class is responsible for initializing a new game, including setting up the initial game state and
// player states
export class EarendelGameInitializer
    extends BaseGameInitializer<EarendelGameState, HydratedEarendelGameState>
    implements GameInitializer<EarendelGameState, HydratedEarendelGameState>
{
    // Tournament seating: an assigned order replaces the shuffled turn order, and nothing else in
    // setup depends on order, so the board, bags, deck and colours are the same either way.
    readonly supportsStartingPositions = true

    // Initialize the game state based on things like the number of players and the game config
    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedEarendelGameState {
        // Initialize a pseudo random number generator for the state
        // Public randomness lays out what everyone sees: colours, turn order, the board. The
        // protected stream shuffles what nobody may see: the bags, the deck and the tile supply.
        const prng = new Prng(state.prng)
        assertExists(state.protectedPrng, 'Earendel setup requires protected randomness')
        const secret = new Prng(state.protectedPrng)
        const players = this.initializePlayers(game, prng, secret)

        // Every game state has a turn manager to track whose turn it is
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)

        // Put players array in turn order
        const orderedPlayers: EarendelPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const config = earendelConfig(game.config)

        const earendelGameState: EarendelGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: turnStartState(config),
            heldPieces: [],
            turnManager: turnManager,
            // Two tiles per player, each with its own planet layout (see buildStartingBoard).
            board: buildStartingBoard(game.players.length, prng),
            technologyDeck: bagOf(buildDeckFor(config, secret)),
            technologyDiscard: [],
            tileSupply: bagOf(buildTileSupply(game.players.length, secret)),
            queuedTechnologyEffects: [],
            planetControllers: {},
            scoredPlanetPairs: [],
            probeClaims: []
        })

        // I suppose the engine could actually do the hydration with the hydrator, but this is how it
        // it is done currently.
        return new HydratedEarendelGameState(earendelGameState)
    }

    // Initialize player states for all players in the game
    private initializePlayers(game: Game, prng: Prng, secret: Prng): EarendelPlayerState[] {
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
                bag: bagOf(buildBag(player.id, secret)),
                specialPieces: [],
                technologies: [],
                storedEffects: [],
                cooldownEffects: [],
                cooldowns: {},
                score: 0
            })
        })

        return players
    }
}

// The full deck unless the config names a single technology to fill it with, which is a
// testing aid rather than a variant (see config.ts).
function buildDeckFor(config: EarendelGameConfig, prng: Prng) {
    const choice = config.technologyDeck ?? FULL_DECK

    return isTechnologyEffectKind(choice)
        ? buildFocusedTechnologyDeck(prng, choice)
        : buildTechnologyDeck(prng)
}
