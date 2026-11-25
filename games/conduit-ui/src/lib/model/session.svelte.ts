import { GameSession, undoableStagedSelection } from '@tabletop/frontend-components'
import {
    assertExists,
    sameCoordinates,
    type GameAction,
    type OffsetCoordinates
} from '@tabletop/common'
import {
    ActionType,
    BuyTile,
    ChooseRoute,
    extraCubesPrice,
    PassBid,
    PassTile,
    PlaceBid,
    PlaceTile,
    isPayRevenue,
    MachineState,
    MaxExtraCubes,
    stationEarnings,
    type Payment,
    type StationRevenue,
    type ConduitProjectedState,
    type HydratedConduitGameState,
    type Placement,
    type Route
} from '@tabletop/conduit'
import {
    chooseCell,
    chooseRotation,
    PlacementStageOrder,
    type PlacementSelection
} from './stagedSelection.js'
import { boardBounds, cellKey } from '$lib/utils/boardLayout.js'
import { TableAnimator } from '$lib/animators/tableAnimator.svelte.js'
import { RouteAnimator } from '$lib/animators/routeAnimator.svelte.js'
import { RoutePace } from './routePace.svelte.js'
import { AuctionSpots } from '$lib/utils/tableLayout.js'
import { MediaQuery } from 'svelte/reactivity'

type SessionOptions = ConstructorParameters<
    typeof GameSession<ConduitProjectedState, HydratedConduitGameState>
>[0]

export type StationRoute = { route: Route | undefined; amount: number; tolls: Payment[] }

export type ShownRoute = { key: string; color: string; cells: OffsetCoordinates[] }

export class ConduitGameSession extends GameSession<
    ConduitProjectedState,
    HydratedConduitGameState
> {
    private readonly phone = new MediaQuery('max-width: 639px')
    private readonly wide = new MediaQuery('min-aspect-ratio: 5/4')
    // A wide screen puts the auction board, in two columns, beside the grid instead of above it.
    readonly tableBeside = $derived(!this.phone.current && this.wide.current)
    readonly auctionColumns = $derived(this.phone.current ? 3 : this.tableBeside ? 2 : AuctionSpots)
    readonly tableAnimator = new TableAnimator(this)
    readonly routePace = new RoutePace()
    readonly routeAnimator = new RouteAnimator(this)
    rulesOpen = $state(false)
    inspectedCell: OffsetCoordinates | undefined = $state()
    // A station under the mouse previews its route until the pointer leaves.
    hoveredCell: OffsetCoordinates | undefined = $state()
    // The route option under the mouse while an owner chooses a route.
    previewOption: number | undefined = $state()

    private selection: PlacementSelection = $state({})

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                PlacementStageOrder,
                () => this.selection,
                (selection) => (this.selection = selection)
            )
        )
    }

    private readonly canAct = $derived(
        this.isPlayable &&
            !this.isViewingHistory &&
            this.isMyTurn &&
            this.gameState.result === undefined
    )

    readonly canUndo = $derived(
        this.isPlayable &&
            !this.isViewingHistory &&
            (this.hasLocalSelection || Boolean(this.undoableAction))
    )

    // The state the table shows: the published state, or while a chain of actions animates, the
    // step it has reached.
    readonly tableState: HydratedConduitGameState = $derived(this.tableAnimator.shownState)

    readonly grid = $derived(this.tableState.grid())
    readonly bounds = $derived(boardBounds(this.tableState.board))
    readonly closedConnections = $derived(this.grid.closedConnections())

    // What each Power Station would earn if revenue were paid now, and the tolls its route would
    // pay other players.
    readonly stationRoutes: Map<string, StationRoute> = $derived(
        new Map(
            stationEarnings(this.tableState.board).map(({ station, route, amount, tolls }) => [
                cellKey(station.cell),
                { route, amount, tolls }
            ])
        )
    )

    // What each player would earn if revenue were paid now: their stations' routes plus the tolls
    // other players' routes would pay them.
    readonly projectedIncome: Map<string, number> = $derived.by(() => {
        const totals = new Map<string, number>()
        const add = (playerId: string, amount: number) =>
            totals.set(playerId, (totals.get(playerId) ?? 0) + amount)
        for (const station of this.tableState.ownedStations()) {
            const earning = this.stationRoutes.get(cellKey(station.cell))
            if (!earning || station.ownerId === undefined) continue
            add(station.ownerId, earning.amount)
            for (const toll of earning.tolls) add(toll.playerId, toll.amount)
        }
        return totals
    })

    private readonly highlightedCell = $derived(this.inspectedCell ?? this.hoveredCell)

    readonly inspectedRoute: Route | undefined = $derived(
        this.highlightedCell
            ? this.stationRoutes.get(cellKey(this.highlightedCell))?.route
            : undefined
    )

    // A revenue step viewed in the history shows what each station was paid, and by which route.
    readonly paidRevenues: StationRevenue[] | undefined = $derived(
        this.isViewingHistory && isPayRevenue(this.currentAction)
            ? this.currentAction.metadata?.revenues
            : undefined
    )

    // A route being chosen, for everyone at the table, and the player's own choice to make.
    readonly shownRouteChoice = $derived(
        this.tableState.machineState === MachineState.ChoosingRoutes
            ? this.tableState.pendingRouteChoice()
            : undefined
    )
    readonly routeChoice = $derived(
        // Not while a chain of actions animates: the published state still holds the old choice.
        this.canTake(ActionType.ChooseRoute) && !this.busy
            ? this.gameState.pendingRouteChoice()
            : undefined
    )
    // The option the board shows brightly: the one under the mouse, else the first.
    readonly focusedOption = $derived(this.shownRouteChoice ? (this.previewOption ?? 0) : undefined)

    readonly shownRoutes: ShownRoute[] = $derived.by(() => {
        const choice = this.shownRouteChoice
        if (choice && this.focusedOption !== undefined && !this.isViewingHistory) {
            const option = choice.options[this.focusedOption]
            return option
                ? [
                      {
                          key: `choice-${choice.tileId}-${this.focusedOption}`,
                          color: this.colors.getPlayerBgColorValue(choice.playerId),
                          cells: option.cells
                      }
                  ]
                : []
        }
        if (this.paidRevenues) {
            return this.paidRevenues
                .filter((revenue) => revenue.route.length > 1)
                .map((revenue) => ({
                    key: `paid-${revenue.tileId}`,
                    color: this.colors.getPlayerBgColorValue(revenue.playerId),
                    cells: revenue.route
                }))
        }
        const route = this.inspectedRoute
        const ownerId = this.highlightedCell
            ? this.grid.stationAt(this.highlightedCell)?.ownerId
            : undefined
        return route && route.cells.length > 1
            ? [
                  {
                      key: 'inspected',
                      color: this.colors.getPlayerBgColorValue(ownerId),
                      cells: route.cells
                  }
              ]
            : []
    })

    // The badge on each Power Station: what it was paid in a viewed revenue step, otherwise what
    // it would earn now.
    readonly stationBadges: Map<string, number> = $derived.by(() => {
        const paid = this.paidRevenues
        if (!paid) {
            return new Map(
                [...this.stationRoutes.entries()].map(([key, route]) => [key, route.amount])
            )
        }
        const stations = this.tableState.board.stations
        return new Map(
            paid.flatMap((revenue) => {
                const station = stations.find((candidate) => candidate.tileId === revenue.tileId)
                return station ? [[cellKey(station.cell), revenue.amount] as const] : []
            })
        )
    })

    readonly offer = $derived(this.gameState.currentOffer())
    readonly pendingPlacement = $derived(this.gameState.pendingPlacement())
    readonly shownOffer = $derived(this.tableState.currentOffer())
    readonly shownPlacement = $derived(this.tableState.pendingPlacement())

    // A player's cash as the table shows it: during revenue it rises payout by payout.
    cashOf(playerId: string): number {
        return (
            this.routeAnimator.cash?.get(playerId) ?? this.tableState.getPlayerState(playerId).cash
        )
    }

    nameOf(playerId: string): string {
        return this.game.players.find((player) => player.id === playerId)?.name ?? playerId
    }

    readonly isBidding = $derived(this.canTake(ActionType.PlaceBid))
    readonly biddableSlots: number[] = $derived(
        this.isBidding ? this.gameState.biddableSlots() : []
    )
    readonly canPassBid = $derived(this.canTake(ActionType.PassBid))
    readonly canBuy = $derived(this.canTake(ActionType.BuyTile))
    readonly canPass = $derived(this.canTake(ActionType.PassTile))
    readonly isOffered = $derived(this.canBuy || this.canPass)

    readonly placement = $derived(
        this.canTake(ActionType.PlaceTile) ? this.pendingPlacement : undefined
    )
    // Placement targets wait while a change animates, since the board may still be catching up.
    readonly placementOptions: Placement[] = $derived(
        this.placement && !this.busy
            ? this.grid.legalPlacements(this.placement.tileId, this.placement.faceUp)
            : []
    )
    readonly chosenCell = $derived(this.selection.cell?.value)
    readonly rotationsForChosenCell: number[] = $derived(
        this.placementOptions.find(
            (option) => this.chosenCell && sameCoordinates(option.cell, this.chosenCell)
        )?.rotations ?? []
    )
    // A chosen cell shows the tile in its first legal turn until the player turns it.
    readonly chosenRotation: number | undefined = $derived(
        this.selection.rotation?.value ?? this.rotationsForChosenCell[0]
    )
    // Which way the last press turned the tile, so the preview turns the same way.
    turnedTo: { rotation: number; direction: 1 | -1 } | undefined = $state()
    readonly mySupply = $derived(this.myPlayerState?.supply ?? 0)
    // Each extra-cube count the player may put on a new station, with what it costs: the supply,
    // the three-cube limit and the player's cash all limit it.
    readonly extraCubeChoices: { count: number; price: number; affordable: boolean }[] =
        $derived.by(() => {
            const most = Math.min(this.mySupply, MaxExtraCubes)
            const cash = this.myPlayerState?.cash ?? 0
            return Array.from({ length: Math.max(0, most) + 1 }, (_, count) => {
                const price = extraCubesPrice(count)
                return { count, price, affordable: price <= cash }
            })
        })

    // Each revenue payout is its own history step, so stepping back shows the routes it paid.
    override shouldAutoStepAction(action: GameAction, next?: GameAction): boolean {
        return !isPayRevenue(action) && super.shouldAutoStepAction(action, next)
    }

    override beforeNewState() {
        this.previewOption = undefined
        this.tableAnimator.settle()
        this.routeAnimator.settle()
    }

    toggleRules() {
        this.rulesOpen = !this.rulesOpen
    }

    closeRules() {
        this.rulesOpen = false
    }

    hoverStation(cell: OffsetCoordinates | undefined) {
        this.hoveredCell = cell
    }

    inspectStation(cell: OffsetCoordinates | undefined) {
        this.inspectedCell =
            cell && this.inspectedCell && sameCoordinates(cell, this.inspectedCell)
                ? undefined
                : cell
    }

    async bid(slot: number) {
        await this.applyAction(this.createPlayerAction(PlaceBid, { slot }))
    }

    async passBid() {
        await this.applyAction(this.createPlayerAction(PassBid))
    }

    async buyTile() {
        await this.applyAction(this.createPlayerAction(BuyTile))
    }

    // Chooses the option at this position in the choice, naming its route by its cells.
    async chooseRoute(option: number) {
        const choice = this.routeChoice
        const route = choice?.options[option]?.cells
        if (!choice || !route) return
        await this.applyAction(
            this.createPlayerAction(ChooseRoute, { tileId: choice.tileId, route })
        )
    }

    previewRoute(option: number | undefined) {
        this.previewOption = option
    }

    async passTile() {
        await this.applyAction(this.createPlayerAction(PassTile))
    }

    // A face-down tile has nothing more to choose. A face-up tile shows in its first legal turn,
    // to be turned and given extra cubes; with one turn and no cubes to add, it goes straight down.
    async chooseCell(cell: OffsetCoordinates) {
        const placement = this.placement
        if (!placement || this.busy) return
        if (this.chosenCell && sameCoordinates(cell, this.chosenCell)) {
            this.selection = {}
            return
        }
        if (!placement.faceUp) {
            await this.place(cell, 0, 0)
            return
        }
        const option = this.placementOptions.find((candidate) =>
            sameCoordinates(candidate.cell, cell)
        )
        assertExists(option, 'The chosen cell is a legal placement')
        if (option.rotations.length === 1 && this.mySupply === 0) {
            await this.place(cell, option.rotations[0], 0)
            return
        }
        this.selection = chooseCell(this.selection, cell)
    }

    // Turns the tile to its next legal turn clockwise (1) or anticlockwise (-1). Each press
    // replaces the last, so one Undo puts the tile back in its first turn.
    turnTile(direction: 1 | -1) {
        const rotations = this.rotationsForChosenCell
        const current = this.chosenRotation
        if (this.busy || current === undefined || rotations.length < 2) return
        const index = rotations.indexOf(current)
        const next = rotations[(index + direction + rotations.length) % rotations.length]
        this.turnedTo = { rotation: next, direction }
        this.selection = chooseRotation(this.selection, next, 'manual')
    }

    async chooseExtraCubes(extraCubes: number) {
        const cell = this.chosenCell
        const rotation = this.chosenRotation
        assertExists(cell, 'Cubes go on a chosen cell')
        assertExists(rotation, 'Cubes go on a turned tile')
        await this.place(cell, rotation, extraCubes)
    }

    private async place(cell: OffsetCoordinates, rotation: number, extraCubes: number) {
        await this.applyAction(this.createPlayerAction(PlaceTile, { cell, rotation, extraCubes }))
    }

    private canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }
}
