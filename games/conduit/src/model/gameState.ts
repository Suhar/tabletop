import {
    assert,
    assertExists,
    DrawBag,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedDrawBag,
    HydratedRoundManager,
    HydratedTurnManager,
    OffsetCoordinates,
    PrngState,
    RoundManager,
    sameCoordinates,
    Visibility
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { Board, Grid, type PlacedStation, type Route } from './board.js'
import { ConduitPlayerState, HydratedConduitPlayerState } from './playerState.js'
import {
    BasePrice,
    BidTrackSpaces,
    CubesPerRound,
    extraCubesPrice,
    marketTiles,
    MaxExtraCubes,
    MinimumBids,
    Rounds
} from './rules.js'

export type StationStack = Type.Static<typeof StationStack>
export const StationStack = DrawBag(Type.Integer())

const StationStackValidator = Compile(StationStack)

export class HydratedStationStack
    extends HydratedDrawBag<number, typeof StationStack>
    implements StationStack
{
    constructor(data: StationStack) {
        super(data, StationStackValidator)
    }
}

// A spot on the auction board. Bids list the cube owners from the bottom of the track up.
export type MarketSlot = Type.Static<typeof MarketSlot>
export const MarketSlot = Type.Object({
    tileId: Type.Optional(Type.Integer()),
    bids: Type.Array(Type.String()),
    buyerId: Type.Optional(Type.String())
})

export type Payment = Type.Static<typeof Payment>
export const Payment = Type.Object({
    playerId: Type.String(),
    amount: Type.Integer()
})

export type StationRevenue = Type.Static<typeof StationRevenue>
export const StationRevenue = Type.Object({
    playerId: Type.String(),
    tileId: Type.Integer(),
    route: Type.Array(OffsetCoordinates),
    amount: Type.Integer(),
    // Tolls paid to other players' Power Stations on the route.
    tolls: Type.Optional(Type.Array(Payment))
})

export interface Offer {
    slot: number
    tileId: number
    playerId: string
    price: number
}

// A station whose equally good routes would pay tolls to different players: its owner chooses
// among them before revenue (designer ruling, 2026-11-25). Each option is one route for each
// distinct set of players its tolls would pay; the owner names the one they choose by its cells.
export type RouteOption = Type.Static<typeof RouteOption>
export const RouteOption = Type.Object({
    cells: Type.Array(OffsetCoordinates),
    // The players the route's tolls would pay, one entry per station passed.
    tolls: Type.Array(Type.String())
})

export type RouteChoice = Type.Static<typeof RouteChoice>
export const RouteChoice = Type.Object({
    tileId: Type.Integer(),
    playerId: Type.String(),
    options: Type.Array(RouteOption),
    chosen: Type.Optional(Type.Array(OffsetCoordinates))
})

export interface PendingPlacement {
    slot: number
    tileId: number
    playerId: string
    faceUp: boolean
}

export type ConduitGameState = Type.Static<typeof ConduitGameState>
export const ConduitGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(ConduitPlayerState),
            machineState: Type.Enum(MachineState),
            roundManager: RoundManager,
            // Every tile left after setup, shuffled into one stack.
            deck: StationStack,
            market: Type.Array(MarketSlot),
            board: Board,
            // Players who have passed in this round's bidding.
            bidPasses: Type.Array(Type.String()),
            // Routes owners are choosing, or have chosen, for the revenue about to be paid.
            routeChoices: Type.Optional(Type.Array(RouteChoice))
        })
    ])
)

export const ConduitGameStateValidator = Compile(ConduitGameState)

export const ConduitProjectedState = Visibility.createProjectionSchema(ConduitGameState)
export type ConduitProjectedState = Type.Static<typeof ConduitProjectedState>
const ConduitProjectedStateValidator = Compile(ConduitProjectedState)

export class HydratedConduitGameState
    extends HydratableGameState<typeof ConduitProjectedState, HydratedConduitPlayerState>
    implements ConduitProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedConduitPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare roundManager: HydratedRoundManager
    declare deck: StationStack
    declare market: MarketSlot[]
    declare board: Board
    declare bidPasses: string[]
    declare routeChoices?: RouteChoice[]

    constructor(data: ConduitProjectedState) {
        super(data, ConduitProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedConduitPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
    }

    get round(): number {
        return this.roundManager.series.length
    }

    // After the fifth round, revenue and infrastructure loss repeat until no cubes are left.
    isPayingOut(): boolean {
        return this.round >= Rounds
    }

    startPlayerId(): string {
        return this.turnManager.turnOrder[0]
    }

    grid(): Grid {
        return new Grid(this.board)
    }

    // The market is drawn from the top of the stack.
    fillMarket(): number[] {
        this.roundManager.startRound(this.actionCount)
        const deck = new HydratedStationStack(this.deck)
        const count = marketTiles(this.players.length, this.round)
        assert(deck.remaining >= count, 'The stack has run out')
        const tileIds = Array.from({ length: count }, () => deck.draw())
        this.deck = deck.dehydrate()
        this.market = tileIds.map((tileId) => ({ tileId, bids: [] }))
        this.bidPasses = []
        return tileIds
    }

    bidsBy(playerId: string): number {
        return this.market.reduce(
            (total, slot) => total + slot.bids.filter((bidder) => bidder === playerId).length,
            0
        )
    }

    biddableSlots(): number[] {
        return this.market
            .map((slot, index) => ({ slot, index }))
            .filter(({ slot }) => slot.tileId !== undefined && slot.bids.length < BidTrackSpaces)
            .map(({ index }) => index)
    }

    canBid(playerId: string): boolean {
        return (
            this.getPlayerState(playerId).supply > 0 &&
            this.biddableSlots().length > 0 &&
            !this.bidPasses.includes(playerId)
        )
    }

    // Bidding goes on until everyone has passed or cannot bid. A player with an empty supply is
    // skipped (designer ruling).
    isBiddingOver(): boolean {
        return !this.players.some((player) => this.canBid(player.playerId))
    }

    // A player may pass once they have placed the minimum themselves, even with tiles unbid.
    canPassBid(playerId: string): boolean {
        return this.bidsBy(playerId) >= MinimumBids && this.canBid(playerId)
    }

    passBid(playerId: string) {
        this.bidPasses = [...this.bidPasses, playerId]
    }

    placeBid(playerId: string, slot: number) {
        assert(this.biddableSlots().includes(slot), `Slot ${slot} cannot take a bid`)
        this.getPlayerState(playerId).takeFromSupply(1)
        this.market[slot].bids.push(playerId)
    }

    private unresolvedSlot(): number | undefined {
        const index = this.market.findIndex((slot) => slot.tileId !== undefined)
        return index < 0 ? undefined : index
    }

    currentOffer(): Offer | undefined {
        const slot = this.unresolvedSlot()
        if (slot === undefined) {
            return undefined
        }
        const { tileId, bids, buyerId } = this.market[slot]
        if (tileId === undefined || buyerId !== undefined || bids.length === 0) {
            return undefined
        }
        return { slot, tileId, playerId: bids[0], price: BasePrice + bids.length }
    }

    // A bought tile is placed face up by its buyer. A tile no one bought goes face down, placed by
    // the Start Player.
    pendingPlacement(): PendingPlacement | undefined {
        const slot = this.unresolvedSlot()
        if (slot === undefined) {
            return undefined
        }
        const { tileId, bids, buyerId } = this.market[slot]
        assertExists(tileId, 'An unresolved slot holds its tile')
        if (buyerId !== undefined) {
            return { slot, tileId, playerId: buyerId, faceUp: true }
        }
        if (bids.length === 0) {
            return { slot, tileId, playerId: this.startPlayerId(), faceUp: false }
        }
        return undefined
    }

    isResolutionOver(): boolean {
        return this.unresolvedSlot() === undefined
    }

    // The price is $1 plus a dollar per cube on the track. Each other player's cube earns its owner
    // a dollar and goes back to their supply; each of the buyer's own pays a dollar to the bank. The
    // bottom cube will go onto the tile; the buyer's other cubes go back to their supply (designer
    // ruling).
    buyTile(playerId: string): Payment[] {
        const offer = this.currentOffer()
        assertExists(offer, 'A tile is on offer')
        assert(offer.playerId === playerId, `Player ${playerId} is not being offered the tile`)
        const buyer = this.getPlayerState(playerId)
        buyer.pay(offer.price)

        const slot = this.market[offer.slot]
        const [, ...others] = slot.bids
        const payments = new Map<string, number>()
        for (const bidderId of others) {
            payments.set(bidderId, (payments.get(bidderId) ?? 0) + 1)
            this.getPlayerState(bidderId).returnToSupply(1)
            if (bidderId !== playerId) {
                this.getPlayerState(bidderId).earn(1)
            }
        }
        slot.bids = []
        slot.buyerId = playerId
        return [...payments.entries()]
            .filter(([bidderId]) => bidderId !== playerId)
            .map(([bidderId, amount]) => ({ playerId: bidderId, amount }))
    }

    // Passing takes a dollar from the bank and returns the passer's bottom cube, along with any of
    // their cubes directly above it, to their supply (designer ruling). Returns the cubes removed.
    passTile(playerId: string): number {
        const offer = this.currentOffer()
        assertExists(offer, 'A tile is on offer')
        assert(offer.playerId === playerId, `Player ${playerId} is not being offered the tile`)
        const slot = this.market[offer.slot]
        const run = slot.bids.findIndex((bidderId) => bidderId !== playerId)
        const removed = run < 0 ? slot.bids.length : run
        slot.bids.splice(0, removed)
        const passer = this.getPlayerState(playerId)
        passer.returnToSupply(removed)
        passer.earn(1)
        return removed
    }

    canAfford(playerId: string): boolean {
        const offer = this.currentOffer()
        return offer !== undefined && this.getPlayerState(playerId).cash >= offer.price
    }

    // The buyer may add up to three extra cubes from supply, at $1, $2 and $3. Returns their price.
    placeTile(
        playerId: string,
        cell: OffsetCoordinates,
        rotation: number,
        extraCubes: number
    ): number {
        const placement = this.pendingPlacement()
        assertExists(placement, 'A tile is waiting to be placed')
        assert(placement.playerId === playerId, `Player ${playerId} is not placing the tile`)
        const face = { tileId: placement.tileId, rotation, faceUp: placement.faceUp }
        assert(this.grid().isLegalPlacement(face, cell), 'The tile cannot go there')
        assert(placement.faceUp || extraCubes === 0, 'A face-down tile takes no cubes')
        assert(extraCubes <= MaxExtraCubes, `At most ${MaxExtraCubes} extra cubes`)

        const station: PlacedStation = { cell, ...face, cubes: 0 }
        const extraPrice = placement.faceUp ? extraCubesPrice(extraCubes) : 0
        if (placement.faceUp) {
            const player = this.getPlayerState(playerId)
            assert(player.cash >= extraPrice, 'The player cannot pay for the extra cubes')
            player.pay(extraPrice)
            player.takeFromSupply(extraCubes)
            station.ownerId = playerId
            station.cubes = 1 + extraCubes
        }
        this.board.stations.push(station)
        this.market[placement.slot] = { bids: [] }
        return extraPrice
    }

    // The stations whose owners must choose a route before revenue: those whose equally good
    // routes would pay tolls to different players. Owners choose in turn order from the Start
    // Player; one owner's stations in board order.
    findRouteChoices(): RouteChoice[] {
        const grid = this.grid()
        const choices: RouteChoice[] = []
        for (const station of this.ownedStations()) {
            const ownerId = station.ownerId
            if (ownerId === undefined) continue
            const options = new Map<string, RouteOption>()
            for (const route of grid.bestRoutes(station.cell)) {
                const tolls = tollPayees(grid, route.cells, ownerId).toSorted()
                const key = tolls.join(',')
                if (!options.has(key)) options.set(key, { cells: route.cells, tolls })
            }
            if (options.size > 1) {
                choices.push({
                    tileId: station.tileId,
                    playerId: ownerId,
                    options: [...options.values()]
                })
            }
        }
        const order = this.turnManager.turnOrder
        return choices.toSorted((a, b) => order.indexOf(a.playerId) - order.indexOf(b.playerId))
    }

    pendingRouteChoice(): RouteChoice | undefined {
        return this.routeChoices?.find((choice) => choice.chosen === undefined)
    }

    // The option whose route follows these cells, if the pending choice offers one.
    routeOption(choice: RouteChoice, route: OffsetCoordinates[]): RouteOption | undefined {
        return choice.options.find((option) => sameRoute(option.cells, route))
    }

    // Returns the option chosen.
    chooseRoute(playerId: string, tileId: number, route: OffsetCoordinates[]): RouteOption {
        const choice = this.pendingRouteChoice()
        assertExists(choice, 'A route is waiting to be chosen')
        assert(choice.playerId === playerId, `Player ${playerId} is not choosing a route`)
        assert(choice.tileId === tileId, `Tile ${tileId} is not the route being chosen`)
        const option = this.routeOption(choice, route)
        assertExists(option, 'The route is one of the options')
        choice.chosen = option.cells
        return option
    }

    // The routes owners chose, by station tile.
    chosenRoutes(): Map<number, OffsetCoordinates[]> {
        return new Map(
            (this.routeChoices ?? []).flatMap((choice) =>
                choice.chosen === undefined ? [] : [[choice.tileId, choice.chosen] as const]
            )
        )
    }

    ownedStations(): PlacedStation[] {
        return this.board.stations.filter((station) => station.ownerId !== undefined)
    }

    // Each Power Station earns $1 plus $1 per station on its route, and every other player's Power
    // Station on the route earns its owner $1. A station with no route earns nothing.
    payRevenue(): StationRevenue[] {
        const earnings = stationEarnings(this.board, this.chosenRoutes())
        this.routeChoices = undefined
        for (const { ownerId, amount, tolls } of earnings) {
            this.getPlayerState(ownerId).earn(amount)
            for (const toll of tolls) {
                this.getPlayerState(toll.playerId).earn(toll.amount)
            }
        }
        return earnings.map(({ station, ownerId, route, amount, tolls }) => ({
            playerId: ownerId,
            tileId: station.tileId,
            route: route?.cells ?? [],
            amount,
            ...(tolls.length > 0 ? { tolls } : {})
        }))
    }

    // Stations without cubes flip face down, the setup cross included, so the cross flips at the
    // end of round 1. Every other station then loses a cube to its owner's reserve; one left empty
    // stays face up with no owner until the next infrastructure loss (designer ruling): it earns
    // nothing and collects no toll, but other routes still count it and may end on it. Returns the
    // tiles flipped.
    loseInfrastructure(): number[] {
        const flipped = this.board.stations.filter(
            (station) => station.faceUp && station.cubes === 0
        )
        for (const station of flipped) {
            station.faceUp = false
            delete station.ownerId
        }
        for (const station of this.board.stations) {
            if (station.cubes === 0) continue
            station.cubes -= 1
            if (station.ownerId !== undefined) {
                this.getPlayerState(station.ownerId).retireCube()
            }
            if (station.cubes === 0) delete station.ownerId
        }
        return flipped.map((station) => station.tileId)
    }

    cubesOnBoard(): number {
        return this.board.stations.reduce((total, station) => total + station.cubes, 0)
    }

    // The round ends with every player moving cubes from reserve to supply, except after the fifth
    // round, and the Start Player marker passing clockwise.
    endRound(): Payment[] {
        this.roundManager.endRound(this.actionCount)
        const refills = this.isPayingOut()
            ? []
            : this.players.map((player) => ({
                  playerId: player.playerId,
                  amount: player.refillSupply(CubesPerRound)
              }))
        this.turnManager.newFirstPlayer(this.turnManager.nextPlayer(this.startPlayerId()))
        return refills
    }

    // Most cash wins; ties go to the most cubes in supply, and players still tied share the win.
    leadingPlayerIds(): string[] {
        const rank = (player: HydratedConduitPlayerState) => [player.cash, player.supply]
        const best = this.players.reduce((leader, player) =>
            compareRanks(rank(player), rank(leader)) > 0 ? player : leader
        )
        return this.players
            .filter((player) => compareRanks(rank(player), rank(best)) === 0)
            .map((player) => player.playerId)
    }
}

export function revenueFor(route: Route | undefined): number {
    return route ? 1 + route.stations : 0
}

export interface StationEarning {
    station: PlacedStation
    ownerId: string
    route: Route | undefined
    amount: number
    tolls: Payment[]
}

// What each owned station would earn if revenue were paid now. A toll goes to every Power Station
// (face up, with a cube) on the route that another player owns, the destination included; the
// unowned setup tiles never collect. A station's owner's chosen route, where they had a choice,
// replaces the one the search finds.
export function stationEarnings(
    board: Board,
    chosen: ReadonlyMap<number, OffsetCoordinates[]> = new Map()
): StationEarning[] {
    const grid = new Grid(board)
    return board.stations.flatMap((station) => {
        const ownerId = station.ownerId
        if (ownerId === undefined) {
            return []
        }
        const cells = chosen.get(station.tileId)
        const route = cells
            ? {
                  cells,
                  stations: cells.filter((cell) => grid.stationAt(cell)?.faceUp).length
              }
            : grid.bestRoute(station.cell)
        const tolls = route
            ? tollPayees(grid, route.cells, ownerId).map((playerId) => ({ playerId, amount: 1 }))
            : []
        return [{ station, ownerId, route, amount: revenueFor(route), tolls }]
    })
}

// The players a route's tolls pay: the owner of each other player's Power Station it passes (face
// up, with a cube), the destination included.
function tollPayees(grid: Grid, cells: OffsetCoordinates[], ownerId: string): string[] {
    return cells.slice(1).flatMap((cell) => {
        const passed = grid.stationAt(cell)
        return passed?.ownerId !== undefined &&
            passed.ownerId !== ownerId &&
            passed.faceUp &&
            passed.cubes > 0
            ? [passed.ownerId]
            : []
    })
}

function sameRoute(a: OffsetCoordinates[], b: OffsetCoordinates[]): boolean {
    return a.length === b.length && a.every((cell, index) => sameCoordinates(cell, b[index]))
}

function compareRanks(a: number[], b: number[]): number {
    for (let index = 0; index < a.length; index++) {
        if (a[index] !== b[index]) {
            return a[index] - b[index]
        }
    }
    return 0
}
