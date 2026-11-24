import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { assertExists, Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { HydratedEarendelGameState, EarendelGameState } from '../model/gameState.js'
import { HydratedEarendelPlayerState, EarendelPlayerState } from '../model/playerState.js'

import { openingState } from '../util/turn.js'
import { buildBag } from '../util/bag.js'
import { buildStartingBoard } from '../util/boardSetup.js'
import { buildTileSupply } from '../util/tilePlacement.js'
import {
    buildFocusedTechnologyDeck,
    buildTechnologyDeck,
    selectPieceTechnologies
} from '../util/technologyDeck.js'
import { earendelConfig, type EarendelGameConfig, FULL_DECK, PiecesInPlay } from './config.js'
import type { TechnologyCategory, TechnologyEffectKind } from '../model/technology.js'
import { selectElevatedCards } from '../util/elevated.js'
import { EarendelColors } from './colors.js'

export class EarendelGameInitializer
    extends BaseGameInitializer<EarendelGameState, HydratedEarendelGameState>
    implements GameInitializer<EarendelGameState, HydratedEarendelGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedEarendelGameState {
        // Public randomness lays out what everyone sees; the protected stream shuffles the bags, the
        // deck and the tile supply.
        const prng = new Prng(state.prng)
        assertExists(state.protectedPrng, 'Earendel setup requires protected randomness')
        const secret = new Prng(state.protectedPrng)
        const players = this.initializePlayers(game, prng, secret)

        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)

        const orderedPlayers: EarendelPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const config = earendelConfig(game.config)
        const elevatedTechnologies = selectElevatedCards(config, secret)
        const pieceTechnologies = selectPieceTechnologies(
            secret,
            config.piecesInPlay ?? PiecesInPlay.Basic
        )
        const deck = [
            ...buildDeckFor(config, secret, pieceTechnologies),
            ...Object.values(elevatedTechnologies)
        ]
        shuffle(deck, secret.random)

        const earendelGameState: EarendelGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: openingState(config),
            heldPieces: [],
            turnManager: turnManager,
            board: buildStartingBoard(game.players.length, prng),
            technologyDeck: fullBag(deck),
            elevatedTechnologies,
            ...(pieceTechnologies ? { pieceTechnologies } : {}),
            technologyDiscard: [],
            tileSupply: fullBag(buildTileSupply(game.players.length, secret)),
            planetControllers: {},
            tradeRoutes: [],
            routesEstablished: 0,
            probeClaims: []
        })

        return new HydratedEarendelGameState(earendelGameState)
    }

    private initializePlayers(game: Game, prng: Prng, secret: Prng): EarendelPlayerState[] {
        const colors = structuredClone(EarendelColors)
        shuffle(colors, prng.random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedEarendelPlayerState({
                playerId: player.id,
                color: colors[index],
                bag: fullBag(buildBag(player.id, secret)),
                specialPieces: [],
                technologies: [],
                storedEffects: [],
                cooldowns: {},
                score: 0
            })
        })

        return players
    }
}

function buildDeckFor(
    config: EarendelGameConfig,
    prng: Prng,
    pieces?: Partial<Record<TechnologyCategory, TechnologyEffectKind>>
) {
    const choice = config.technologyDeck ?? FULL_DECK

    return choice === FULL_DECK
        ? buildTechnologyDeck(prng, pieces)
        : buildFocusedTechnologyDeck(prng, choice)
}

function fullBag<T>(items: T[]) {
    return { items, remaining: items.length }
}
