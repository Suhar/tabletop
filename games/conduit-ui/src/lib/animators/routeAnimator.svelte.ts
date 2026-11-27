import { gsap } from 'gsap'
import { flushSync, tick } from 'svelte'
import { assertExists, type Game, type OffsetCoordinates } from '@tabletop/common'
import type { AnimationContext, GameStateChangeListener } from '@tabletop/frontend-components'
import {
    Grid,
    isPayRevenue,
    stationTile,
    type HydratedConduitGameState,
    type PlacedStation,
    type SearchStep,
    type StationRevenue
} from '@tabletop/conduit'
import type { Pace } from '$lib/model/routePace.svelte.js'
import { emblemRing } from '$lib/utils/emblem.js'

type Timeline = AnimationContext['actionTimeline']

export type RouteShow = {
    key: string
    color: string
    station: OffsetCoordinates
    emblem: Emblem
    caption: string
    tie?: string
    verdict: string
    layers: SearchStep[][]
    ends: { cell: OffsetCoordinates; emblem: Emblem }[]
    candidates: OffsetCoordinates[][]
    route: OffsetCoordinates[]
    amount: number
    bonuses: { cell: OffsetCoordinates; color: string; amount: number }[]
    payments: { playerId: string; amount: number }[]
}

type Session = {
    readonly game: Game
    readonly routePace: { readonly current: Pace }
    readonly colors: { getPlayerBgColorValue(playerId?: string): string }
    nameOf(playerId: string): string
    addGameStateChangeListener(listener: GameStateChangeListener<HydratedConduitGameState>): void
    removeGameStateChangeListener(listener: GameStateChangeListener<HydratedConduitGameState>): void
}

const Intro = 0.45
const Layer = 0.34
const FoundHold = 0.35
const TieHold = 1.3
const RouteStep = 0.22
const PayHold = 1.1
const NoRouteHold = 1.1

export class RouteAnimator {
    shows: RouteShow[] = $state.raw([])
    cash: ReadonlyMap<string, number> | undefined = $state.raw()
    // Step by step, only the station being explained is mounted, so a payout never mounts every
    // station's search at once.
    mounted: ReadonlySet<number> = $state.raw(new Set())
    detailed = $state(false)

    private svg: SVGSVGElement | undefined

    constructor(private readonly session: Session) {}

    readonly attach = (svg: SVGSVGElement) => {
        this.svg = svg
        this.session.addGameStateChangeListener(this.onGameStateChange)
        return () => {
            this.session.removeGameStateChangeListener(this.onGameStateChange)
            this.svg = undefined
        }
    }

    settle() {
        this.shows = []
        this.cash = undefined
        this.mounted = new Set()
    }

    private readonly onGameStateChange: GameStateChangeListener<HydratedConduitGameState> = async ({
        from,
        action,
        animationContext
    }) => {
        if (!from || !action || !isPayRevenue(action) || !action.metadata) return
        const shows = this.showsFor(from, action.metadata.revenues)
        if (shows.length === 0) return
        const quick = this.session.routePace.current === 'quick'
        this.shows = shows
        this.detailed = !quick
        this.cash = new Map(from.players.map((player) => [player.playerId, player.cash]))
        animationContext.afterAnimations(() => this.settle())
        if (quick) {
            this.mounted = new Set(shows.map((_, index) => index))
            await tick()
            this.playQuick(animationContext)
        } else {
            this.playSteps(animationContext)
        }
    }

    private showsFor(from: HydratedConduitGameState, revenues: StationRevenue[]): RouteShow[] {
        const grid = new Grid(from.board)
        return revenues.flatMap((revenue, index) => {
            const station = from.board.stations.find(
                (candidate) => candidate.tileId === revenue.tileId
            )
            const search = station ? grid.routeSearch(station.cell) : undefined
            if (!station || !search) return []
            const letter = stationTile(station.tileId).letter
            const name = this.session.nameOf(revenue.playerId)
            const route = revenue.route.length > 1 ? revenue.route : []
            const candidates = search.candidates.length > 1 ? search.candidates : []
            const chose = from.routeChoices?.find((choice) => choice.tileId === station.tileId)
            const bonuses = revenue.bonuses?.length
                ? route.slice(1).flatMap((cell) => {
                      const passed = grid.stationAt(cell)
                      return passed?.ownerId !== undefined &&
                          passed.ownerId !== revenue.playerId &&
                          passed.faceUp &&
                          passed.cubes > 0
                          ? [
                                {
                                    cell,
                                    color: this.session.colors.getPlayerBgColorValue(
                                        passed.ownerId
                                    ),
                                    amount: 1
                                }
                            ]
                          : []
                  })
                : []
            return [
                {
                    key: `${revenue.tileId}-${index}`,
                    color: this.session.colors.getPlayerBgColorValue(revenue.playerId),
                    station: station.cell,
                    emblem: this.emblemOf(station),
                    caption: `${name}’s ${letter} → nearest ${search.target}`,
                    tie: chose
                        ? `Tie: ${name} chose who gets the bonus`
                        : candidates.length > 0
                          ? this.tieRule(search.candidates)
                          : undefined,
                    // Rules: $1 plus $1 per station, both ends included; face-down tiles are
                    // not stations.
                    verdict:
                        route.length > 0
                            ? `+$${revenue.amount} · ${revenue.amount - 1} stations`
                            : `No ${search.target} in reach`,
                    layers: search.layers,
                    ends: search.candidates.map((candidate) => {
                        const cell = candidate.cells.at(-1)
                        assertExists(cell, 'A candidate route ends at a destination')
                        return { cell, emblem: this.emblemOf(grid.stationAt(cell) ?? station) }
                    }),
                    candidates: chose
                        ? chose.options.map((option) => option.cells)
                        : candidates.map((candidate) => candidate.cells),
                    route,
                    amount: revenue.amount,
                    bonuses,
                    payments: [
                        { playerId: revenue.playerId, amount: revenue.amount },
                        ...(revenue.bonuses ?? [])
                    ]
                }
            ]
        })
    }

    private find(selector: string): SVGElement | undefined {
        return this.svg?.querySelector<SVGElement>(selector) ?? undefined
    }

    private findAll(selector: string): SVGElement[] {
        return [...(this.svg?.querySelectorAll<SVGElement>(selector) ?? [])]
    }

    private playSteps(animationContext: AnimationContext) {
        const timeline = animationContext.actionTimeline
        let at = 0
        this.shows.forEach((show, index) => {
            const length = this.scheduleOf(show).end
            const part = gsap.timeline()
            part.to({}, { duration: length }, 0)
            timeline.add(part, at)
            timeline.call(() => this.mountAndExplain(part, show, index), [], at)
            at += length
        })
    }

    // Mounts synchronously, so the part's tweens find the drawing while it plays.
    private mountAndExplain(part: Timeline, show: RouteShow, index: number) {
        this.mounted = new Set([index])
        flushSync()
        this.explain(part, show, index)
    }

    private explain(timeline: Timeline, show: RouteShow, index: number) {
        const id = `${index}`
        const { searching, found, drawing, paid, end } = this.scheduleOf(show)
        this.reveal(timeline, id, 0)
        this.ring(timeline, this.find(`[data-show-ring="${id}"]`), 0)
        this.fade(timeline, this.find(`[data-show-caption="${id}"]`), 1, 0, 0.2)

        show.layers.forEach((_, layer) => {
            const start = searching + layer * Layer
            for (const segment of this.findAll(`[data-show-segment="${id}-${layer}"]`)) {
                timeline.to(
                    segment,
                    { attr: { 'stroke-dashoffset': 0 }, duration: Layer * 0.9, ease: 'none' },
                    start
                )
            }
            for (const tint of this.findAll(`[data-show-tint="${id}-${layer}"]`)) {
                this.fade(timeline, tint, 1, start + Layer * 0.55, 0.2)
            }
        })
        if (show.route.length === 0) {
            this.fade(timeline, this.find(`[data-show-caption="${id}"]`), 0, found, 0.15)
            this.fade(timeline, this.find(`[data-show-verdict="${id}"]`), 1, found, 0.2)
            this.hide(timeline, id, end)
            return
        }

        for (const ring of this.findAll(`[data-show-end="${id}"]`)) this.ring(timeline, ring, found)
        if (show.tie) {
            const tie = found + FoundHold
            this.fade(timeline, this.find(`[data-show-caption="${id}"]`), 0, tie, 0.15)
            this.fade(timeline, this.find(`[data-show-tie="${id}"]`), 1, tie, 0.2)
            for (const candidate of this.findAll(`[data-show-candidate="${id}"]`)) {
                this.fade(timeline, candidate, 1, tie, 0.25)
                this.fade(timeline, candidate, 0, tie + TieHold, 0.2)
            }
        }
        for (const searched of this.findAll(`[data-show-searched="${id}"]`)) {
            this.fade(timeline, searched, 0.25, drawing, 0.3)
        }
        for (const line of this.findAll(`[data-show-route="${id}"]`)) {
            timeline.to(
                line,
                {
                    attr: { 'stroke-dashoffset': 0 },
                    duration: paid - drawing,
                    ease: 'power1.inOut'
                },
                drawing
            )
        }
        this.fade(timeline, this.find(`[data-show-caption="${id}"]`), 0, paid, 0.15)
        this.fade(timeline, this.find(`[data-show-tie="${id}"]`), 0, paid, 0.15)
        this.fade(timeline, this.find(`[data-show-verdict="${id}"]`), 1, paid, 0.2)
        this.payout(timeline, id, paid)
        this.hide(timeline, id, end)
    }

    private playQuick(animationContext: AnimationContext) {
        const timeline = animationContext.actionTimeline
        this.shows.forEach((show, index) => {
            const id = `${index}`
            this.reveal(timeline, id, 0)
            this.ring(timeline, this.find(`[data-show-ring="${id}"]`), 0)
            for (const line of this.findAll(`[data-show-route="${id}"]`)) {
                timeline.to(
                    line,
                    { attr: { 'stroke-dashoffset': 0 }, duration: 0.5, ease: 'power1.inOut' },
                    0.1
                )
            }
            this.payout(timeline, id, 0.6)
        })
        animationContext.ensureDuration(1.7)
    }

    private reveal(timeline: Timeline, id: string, at: number) {
        const group = this.find(`[data-show="${id}"]`)
        if (group) timeline.set(group, { attr: { visibility: 'visible' } }, at)
    }

    private hide(timeline: Timeline, id: string, at: number) {
        const group = this.find(`[data-show="${id}"]`)
        if (group) timeline.set(group, { attr: { visibility: 'hidden' } }, at)
    }

    private fade(
        timeline: Timeline,
        element: SVGElement | undefined,
        opacity: number,
        at: number,
        duration: number
    ) {
        if (element) timeline.to(element, { attr: { opacity }, duration, ease: 'none' }, at)
    }

    private ring(timeline: Timeline, element: SVGElement | undefined, at: number) {
        if (!element) return
        const pop = { scale: 1.45, opacity: 0 }
        timeline.to(
            pop,
            {
                scale: 1,
                opacity: 1,
                duration: 0.35,
                ease: 'back.out(2)',
                onUpdate: () => {
                    element.setAttribute('transform', `scale(${pop.scale})`)
                    element.setAttribute('opacity', `${pop.opacity}`)
                }
            },
            at
        )
    }

    private payout(timeline: Timeline, id: string, at: number) {
        for (const pill of this.findAll(`[data-show-pay="${id}"]`)) {
            const rise = { y: 0, opacity: 0 }
            timeline.to(
                rise,
                {
                    y: -34,
                    opacity: 1,
                    duration: 0.6,
                    ease: 'power2.out',
                    onUpdate: () => {
                        pill.setAttribute('transform', `translate(0 ${rise.y})`)
                        pill.setAttribute('opacity', `${rise.opacity}`)
                    }
                },
                at
            )
        }
        const glow = this.find(`[data-show-glow="${id}"]`)
        if (glow) timeline.set(glow, { attr: { visibility: 'visible' } }, at)
        for (const line of this.findAll(`[data-show-route="${id}"]`)) {
            timeline.set(line, { attr: { visibility: 'hidden' } }, at)
        }
        for (const ring of this.findAll(`[data-show-ring="${id}"], [data-show-end="${id}"]`)) {
            this.fade(timeline, ring, 0, at, 0.3)
        }
        const index = Number(id)
        timeline.call(() => this.pay(index), [], at)
    }

    private pay(index: number) {
        const show = this.shows[index]
        if (!show || !this.cash) return
        const cash = new Map(this.cash)
        for (const { playerId, amount } of show.payments) {
            cash.set(playerId, (cash.get(playerId) ?? 0) + amount)
        }
        this.cash = cash
    }

    private emblemOf(station: PlacedStation): Emblem {
        return {
            path: emblemRing(stationTile(station.tileId).letter),
            rotation: station.rotation * 90
        }
    }

    private scheduleOf(show: RouteShow) {
        const searching = Intro
        const found = searching + show.layers.length * Layer
        if (show.route.length === 0) {
            return { searching, found, drawing: found, paid: found, end: found + NoRouteHold }
        }
        const drawing = found + FoundHold + (show.tie ? TieHold : 0)
        const paid = drawing + Math.max(0.45, RouteStep * show.route.length)
        return { searching, found, drawing, paid, end: paid + PayHold }
    }

    // Rules: a tie goes to the most stations passed, then the fewest of the owner's own.
    private tieRule(candidates: { stations: number; own: number }[]): string {
        const most = Math.max(...candidates.map((candidate) => candidate.stations))
        const longest = candidates.filter((candidate) => candidate.stations === most)
        if (longest.length < candidates.length) return 'Tie: most stations wins'
        const fewest = Math.min(...longest.map((candidate) => candidate.own))
        if (longest.some((candidate) => candidate.own !== fewest))
            return 'Tie: fewest own stations wins'
        return 'Tie: equal routes'
    }
}

export type Emblem = { path: string; rotation: number }
