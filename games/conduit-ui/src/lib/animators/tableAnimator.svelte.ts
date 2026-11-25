import { tick } from 'svelte'
import type { Point } from '@tabletop/common'
import type { AnimationContext, GameStateChangeListener } from '@tabletop/frontend-components'
import {
    isBuyTile,
    isFillMarket,
    isLoseInfrastructure,
    isPassTile,
    isPayRevenue,
    isPlaceBid,
    isPlaceTile,
    type HydratedConduitGameState,
    type PlaceTile
} from '@tabletop/conduit'
import { CellSize, cellKey } from '$lib/utils/boardLayout.js'
import { cubeShape, pileOffsets, TrackCubeSize } from '$lib/utils/cubeShape.js'
import {
    cellTableOrigin,
    spotTileOrigin,
    tableGeometry,
    TileInSpot,
    TileOrigin,
    TrackCell,
    trackCellOrigin
} from '$lib/utils/tableLayout.js'

type Timeline = AnimationContext['actionTimeline']

export type FlyingTile = {
    slot: number
    tileId: number
    faceUp: boolean
    from: Point
    to: Point
    // Cubes the new station takes, the winning cube first, and their owner's colour.
    cubes: number
    ownerId: string | undefined
}

type Session = {
    readonly auctionColumns: number
    readonly tableBeside: boolean
    readonly gameState: HydratedConduitGameState
    addGameStateChangeListener(listener: GameStateChangeListener<HydratedConduitGameState>): void
    removeGameStateChangeListener(listener: GameStateChangeListener<HydratedConduitGameState>): void
}

// A pose an animated wrapper is drawn in: offset, turn (degrees), scale and opacity, about a
// pivot in the wrapper's own coordinates.
type Pose = {
    x: number
    y: number
    rotate: number
    scaleX: number
    scaleY: number
    opacity: number
}

const Rest: Pose = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1, opacity: 1 }

const TileFlight = 0.55
const QuarterTurn = 0.28
const CubeDrop = 0.3
const CubeLift = 0.35
const Flip = 0.18

// Explains each committed action on the table. A placement plays as a chain of actions (the tile,
// revenue, infrastructure loss, the next market), each animated in turn before the chain's final
// state is published; the table shows the state each step reached, so every step animates from
// what is on screen. Undo and history steps without an action swap the state at once.
export class TableAnimator {
    flyingTile: FlyingTile | undefined = $state()
    // Stations shown face down mid-flip, before the state that flips them is shown.
    flipped: ReadonlySet<string> = $state.raw(new Set())

    // The state the latest step reached, for the published state it started from. A newly
    // published state supersedes it, so a step can never stick on screen.
    private stepped:
        { state: HydratedConduitGameState; over: HydratedConduitGameState } | undefined =
        $state.raw()

    readonly shownState: HydratedConduitGameState = $derived.by(() =>
        this.stepped && this.stepped.over === this.session.gameState
            ? this.stepped.state
            : this.session.gameState
    )

    private svg: SVGSVGElement | undefined
    // Wrappers this step has posed, put back at rest when the step's state is shown.
    private readonly posed = new Set<SVGElement>()

    constructor(private readonly session: Session) {}

    readonly attach = (svg: SVGSVGElement) => {
        this.svg = svg
        this.session.addGameStateChangeListener(this.onGameStateChange)
        return () => {
            this.session.removeGameStateChangeListener(this.onGameStateChange)
            this.svg = undefined
            this.posed.clear()
        }
    }

    // The published state supersedes every step; put away what the steps left out.
    settle() {
        this.flyingTile = undefined
        this.flipped = new Set()
        this.stepped = undefined
        this.restPosed()
    }

    private readonly onGameStateChange: GameStateChangeListener<HydratedConduitGameState> = async ({
        from,
        to,
        action,
        animationContext
    }) => {
        if (!from || !action) return
        animationContext.afterAnimations(() => this.showStep(to))
        const timeline = animationContext.actionTimeline
        if (isPlaceBid(action)) {
            await this.dropBid(from, to, timeline)
        } else if (isBuyTile(action)) {
            this.resolveBuy(from, timeline)
        } else if (isPassTile(action)) {
            this.resolvePass(from, to, timeline)
        } else if (isPlaceTile(action) && action.metadata) {
            await this.flyTile(action, action.metadata.faceUp, from, to, timeline)
        } else if (isPayRevenue(action)) {
            // The route animator explains the payouts; cubes paid out come off afterwards.
            this.liftSpentCubes(from, to, animationContext.finalTimeline, 0)
        } else if (isLoseInfrastructure(action)) {
            this.liftSpentCubes(from, to, timeline, 0)
            this.flipEmptied(from, to, timeline, 0.3)
        } else if (isFillMarket(action)) {
            await this.fillMarket(from, to, timeline)
        }
    }

    // Shows the state a step reached, with every posed wrapper back at rest, in one update.
    private showStep(state: HydratedConduitGameState) {
        this.restPosed()
        this.flyingTile = undefined
        this.flipped = new Set()
        this.stepped = { state, over: this.session.gameState }
    }

    private restPosed() {
        for (const element of this.posed) {
            element.removeAttribute('transform')
            element.removeAttribute('opacity')
        }
        this.posed.clear()
    }

    private find(selector: string): SVGGElement | undefined {
        return this.svg?.querySelector<SVGGElement>(selector) ?? undefined
    }

    // Tweens a wrapper from one pose to another, writing its transform itself (GSAP's own SVG
    // transforms misplace pieces under zoom). An arrival is drawn in its first pose at once.
    private pose(
        timeline: Timeline,
        element: SVGElement | undefined,
        from: Partial<Pose>,
        to: Partial<Pose>,
        options: { duration: number; ease?: string; at: number; pivot?: Point; arrival?: boolean }
    ) {
        if (!element) return
        this.posed.add(element)
        const pivot = options.pivot ?? { x: 0, y: 0 }
        const pose: Pose = { ...Rest, ...from }
        const draw = () => {
            element.setAttribute(
                'transform',
                `translate(${pose.x + pivot.x} ${pose.y + pivot.y}) rotate(${pose.rotate}) ` +
                    `scale(${pose.scaleX} ${pose.scaleY}) translate(${-pivot.x} ${-pivot.y})`
            )
            element.setAttribute('opacity', `${pose.opacity}`)
        }
        if (options.arrival) draw()
        timeline.to(
            pose,
            {
                ...to,
                duration: options.duration,
                ease: options.ease ?? 'power2.out',
                onUpdate: draw
            },
            options.at
        )
    }

    // A bid cube drops onto its track space.
    private async dropBid(
        from: HydratedConduitGameState,
        to: HydratedConduitGameState,
        timeline: Timeline
    ) {
        const slot = to.market.findIndex(
            (spot, index) => spot.bids.length > (from.market[index]?.bids.length ?? 0)
        )
        if (slot < 0) return
        const index = from.market[slot].bids.length
        this.showStep(to)
        await tick()
        this.pose(
            timeline,
            this.find(`[data-bid="${slot}-${index}"]`),
            { y: -44, opacity: 0 },
            { y: 0, opacity: 1 },
            { duration: 0.42, ease: 'bounce.out', at: 0, arrival: true }
        )
    }

    // The bottom cube moves onto the bought tile; every other cube lifts back to its owner.
    private resolveBuy(from: HydratedConduitGameState, timeline: Timeline) {
        const offer = from.currentOffer()
        if (!offer) return
        const bids = from.market[offer.slot].bids
        const cube = cubeShape(TrackCubeSize)
        const start = trackCellOrigin(0)
        const onTile = {
            x: TileOrigin.x + TileInSpot / 2 - (start.x + TrackCell / 2),
            y:
                TileOrigin.y +
                TileInSpot / 2 -
                cube.height / 2 -
                (start.y + (TrackCell - cube.height) / 2)
        }
        this.pose(
            timeline,
            this.find(`[data-bid="${offer.slot}-0"]`),
            {},
            { ...onTile, scaleX: 1.2, scaleY: 1.2 },
            { duration: 0.5, ease: 'power2.inOut', at: 0.1 }
        )
        bids.forEach((_, index) => {
            if (index === 0) return
            this.pose(
                timeline,
                this.find(`[data-bid="${offer.slot}-${index}"]`),
                {},
                { y: -30, opacity: 0 },
                { duration: CubeLift, at: 0.1 + 0.06 * index }
            )
        })
    }

    // The passer's bottom cubes lift off and the cubes above slide down the track.
    private resolvePass(
        from: HydratedConduitGameState,
        to: HydratedConduitGameState,
        timeline: Timeline
    ) {
        const offer = from.currentOffer()
        if (!offer) return
        const before = from.market[offer.slot].bids.length
        const removed = before - to.market[offer.slot].bids.length
        for (let index = 0; index < before; index++) {
            const element = this.find(`[data-bid="${offer.slot}-${index}"]`)
            if (index < removed) {
                this.pose(
                    timeline,
                    element,
                    {},
                    { y: -30, opacity: 0 },
                    { duration: CubeLift, at: 0.05 * index }
                )
                continue
            }
            const here = trackCellOrigin(index)
            const there = trackCellOrigin(index - removed)
            this.pose(
                timeline,
                element,
                {},
                { x: there.x - here.x, y: there.y - here.y },
                { duration: 0.32, ease: 'power2.inOut', at: 0.25 }
            )
        }
    }

    // The tile flies from its auction spot to its cell, turns to the chosen rotation, and the
    // extra cubes drop onto it one by one.
    private async flyTile(
        action: PlaceTile,
        faceUp: boolean,
        from: HydratedConduitGameState,
        to: HydratedConduitGameState,
        timeline: Timeline
    ) {
        const placement = from.pendingPlacement()
        if (!placement) return
        const before = tableGeometry(
            from.board,
            this.session.auctionColumns,
            this.session.tableBeside
        )
        const cubes = faceUp ? 1 + action.extraCubes : 0
        this.flyingTile = {
            slot: placement.slot,
            tileId: placement.tileId,
            faceUp,
            from: spotTileOrigin(placement.slot, before),
            // Where the cell is on the board as shown; the board grows to fit once the tile lands.
            to: cellTableOrigin(action.cell, before),
            cubes,
            ownerId: faceUp ? action.playerId : undefined
        }
        await tick()
        const flight = this.flyingTile
        const wrapper = this.find('[data-flying-tile]')
        const turner = this.find('[data-flying-turn]')
        if (!flight || !wrapper) return
        const startScale = (before.auctionScale * TileInSpot) / CellSize
        const half = CellSize / 2
        this.pose(
            timeline,
            wrapper,
            {
                x: flight.from.x,
                y: flight.from.y,
                scaleX: startScale,
                scaleY: startScale
            },
            { x: flight.to.x, y: flight.to.y, scaleX: 1, scaleY: 1 },
            { duration: TileFlight, ease: 'power2.inOut', at: 0, arrival: true }
        )
        const turns = faceUp ? shortestTurns(action.rotation) : 0
        if (turns !== 0) {
            this.pose(
                timeline,
                turner,
                {},
                { rotate: turns * 90 },
                {
                    duration: QuarterTurn * Math.abs(turns),
                    ease: 'power1.inOut',
                    at: TileFlight + 0.05,
                    pivot: { x: half, y: half }
                }
            )
        }
        const landed = TileFlight + 0.1 + QuarterTurn * Math.abs(turns)
        pileOffsets(cubes, 1).forEach((_, index) => {
            if (index === 0) return
            this.pose(
                timeline,
                this.find(`[data-flying-cube="${index}"]`),
                { y: -36, opacity: 0 },
                { y: 0, opacity: 1 },
                {
                    duration: CubeDrop,
                    ease: 'bounce.out',
                    at: landed + 0.16 * (index - 1),
                    arrival: true
                }
            )
        })
    }

    // One cube comes off each station that lost one, back to its owner's reserve.
    private liftSpentCubes(
        from: HydratedConduitGameState,
        to: HydratedConduitGameState,
        timeline: Timeline,
        at: number
    ) {
        const after = to.grid()
        let order = 0
        for (const station of from.board.stations) {
            if (station.ownerId === undefined || station.cubes === 0) continue
            const now = after.stationAt(station.cell)
            const left = now?.ownerId === station.ownerId ? now.cubes : 0
            if (left >= station.cubes) continue
            const top = Math.min(station.cubes, 4) - 1
            this.pose(
                timeline,
                this.find(`[data-cube="${cellKey(station.cell)}-${top}"]`),
                {},
                { y: -26, opacity: 0 },
                { duration: CubeLift, at: at + 0.04 * order++ }
            )
        }
    }

    // A station left empty turns over: it narrows to an edge, shows its back, and widens again.
    private flipEmptied(
        from: HydratedConduitGameState,
        to: HydratedConduitGameState,
        timeline: Timeline,
        at: number
    ) {
        const after = to.grid()
        const flipping = from.board.stations.filter(
            (station) => station.faceUp && after.stationAt(station.cell)?.faceUp === false
        )
        if (flipping.length === 0) return
        const keys = flipping.map((station) => cellKey(station.cell))
        const pivot = { x: CellSize / 2, y: CellSize / 2 }
        for (const key of keys) {
            const element = this.find(`[data-station-tile="${key}"]`)
            this.pose(
                timeline,
                element,
                {},
                { scaleX: 0 },
                { duration: Flip, ease: 'power1.in', at, pivot }
            )
            this.pose(
                timeline,
                element,
                { scaleX: 0 },
                { scaleX: 1 },
                { duration: Flip, ease: 'power1.out', at: at + Flip, pivot }
            )
        }
        timeline.call(() => (this.flipped = new Set(keys)), [], at + Flip)
    }

    // The new market's tiles turn face up one after another.
    private async fillMarket(
        from: HydratedConduitGameState,
        to: HydratedConduitGameState,
        timeline: Timeline
    ) {
        const fresh = to.market
            .map((spot, slot) => ({ spot, slot }))
            .filter(
                ({ spot, slot }) =>
                    spot.tileId !== undefined && spot.tileId !== from.market[slot]?.tileId
            )
            .map(({ slot }) => slot)
        if (fresh.length === 0) return
        this.showStep(to)
        await tick()
        fresh.forEach((slot, order) => {
            this.pose(
                timeline,
                this.find(`[data-market-tile="${slot}"]`),
                { scaleX: 0 },
                { scaleX: 1 },
                { duration: 0.26, at: 0.1 * order, arrival: true }
            )
        })
    }
}

// Quarter turns from the printed orientation to a rotation, the short way round.
function shortestTurns(rotation: number): number {
    return rotation === 3 ? -1 : rotation
}
