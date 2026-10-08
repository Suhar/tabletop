import {
    BaseGameInitializer,
    HydratedTurnManager,
    Prng,
    shuffle,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { INITIAL_OFFERING, RAILROADS } from '../components/railroads.js'
import { ActionBox } from '../model/actionBoxes.js'
import { AuctionKind } from '../model/auction.js'
import { HydratedSarGameState, type SarGameState } from '../model/gameState.js'
import { HydratedSarPlayerState, STARTING_CASH } from '../model/playerState.js'
import { openShareAuction } from '../model/shareAuctionRules.js'
import { SarColors } from './colors.js'
import { MachineState } from './states.js'

export class SarGameInitializer
    extends BaseGameInitializer<SarGameState, HydratedSarGameState>
    implements GameInitializer<SarGameState, HydratedSarGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedSarGameState {
        const prng = new Prng(state.prng)
        const colors = [...SarColors]
        shuffle(colors, prng.random)
        const players = game.players.map(
            (player, index) =>
                new HydratedSarPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    cash: STARTING_CASH[game.players.length],
                    locomotive: ActionBox.ConstructTrack
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const sarState: SarGameState = Object.assign(state, {
            players: turnManager.turnOrder.map((playerId) =>
                players.find((player) => player.playerId === playerId)!
            ),
            machineState: MachineState.Bidding,
            turnManager,
            railroads: RAILROADS.map((railroad) => ({
                id: railroad.id,
                open: false,
                treasury: 0,
                owners: []
            })),
            track: [],
            connections: [],
            developments: {},
            actionTrack: 0,
            dividendsPaid: 0,
            developmentsThisTurn: 0
        })
        const hydrated = new HydratedSarGameState(sarState)
        // The first seat opens the bidding for the CdFM.
        const [openerId] = turnManager.turnOrder
        openShareAuction(hydrated, {
            kind: AuctionKind.InitialOffering,
            railroadId: INITIAL_OFFERING[0],
            openerId,
            minimum: 0
        })
        hydrated.activePlayerIds = [openerId]
        return hydrated
    }
}
