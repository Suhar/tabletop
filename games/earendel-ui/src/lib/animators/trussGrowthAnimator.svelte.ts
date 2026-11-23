import type { AnimationContext } from '@tabletop/frontend-components'
import type { AxialCoordinates, GameAction, Point } from '@tabletop/common'
import { type EarendelBoard, getHex, type HydratedEarendelGameState } from '@tabletop/earendel'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import { ElementRegistry } from './elementRegistry.js'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { trussEnds } from '$lib/utils/stationGeometry.js'
import { stationTubeKey, stationTubesOf, type StationTube } from '$lib/utils/stationLinks.js'

export type GrowingTruss = {
    key: string
    playerId: string
    // The girder as the board will draw it, so the swap to the real one is seamless.
    girder: { start: Point; end: Point }
    // The clip grows from the new station's end toward the station it joins.
    start: Point
    length: number
    degrees: number
}

// The clip overreaches the girder by this much so the rails' stroke ends aren't trimmed.
export const CLIP_OVERREACH = 2

const GROW_DURATION = 0.5
const FALLBACK_DURATION = 0.15

export class TrussGrowthAnimator {
    growing: GrowingTruss[] = $state([])
    // While girders grow, stations dock as they will on this board, so their stubs drop at once.
    dockingBoard: EarendelBoard | undefined = $state()

    readonly clips = new ElementRegistry<SVGRectElement>()
    readonly girders = new ElementRegistry<SVGGElement>()

    constructor(private readonly shownBoard: () => EarendelBoard) {}

    async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedEarendelGameState
        from?: HydratedEarendelGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) return

        const duration = action ? GROW_DURATION : FALLBACK_DURATION
        const after = new Set(stationTubesOf(to.board).map(stationTubeKey))
        for (const tube of stationTubesOf(from.board)) {
            const key = stationTubeKey(tube)
            const girder = this.girders.get(key)
            if (after.has(key) || !girder) continue
            animationContext.actionTimeline.to(
                girder,
                { opacity: 0, duration: FALLBACK_DURATION },
                0
            )
        }

        // Stood in against the board on show, not this step's start: while a run of actions
        // plays, the board on show is still the one from before the first of them, so a girder
        // an earlier step grew stays drawn, full length, while a later step animates.
        const shown = new Set(stationTubesOf(this.shownBoard()).map(stationTubeKey))
        // Keyed as the growing trusses are, so a girder this step did not make is known as one.
        const before = new Set(stationTubesOf(from.board).map(trussKey))
        const made = stationTubesOf(to.board).filter((tube) => !shown.has(stationTubeKey(tube)))
        if (made.length === 0) return

        const changed = (coords: AxialCoordinates) =>
            getHex(from.board, coords)?.piece?.id !== getHex(to.board, coords)?.piece?.id

        // A girder grows out from the station that has just arrived.
        const growing = made.map((tube) =>
            growingTruss(tube, changed(tube.to) && !changed(tube.from) ? reversed(tube) : tube)
        )

        this.growing = growing
        this.dockingBoard = to.board

        // The transient girders have to be mounted before their clips can be tweened.
        await tick()

        const timeline = action ? animationContext.finalTimeline : animationContext.actionTimeline
        for (const truss of growing) {
            const clip = this.clips.get(truss.key)
            if (!clip) continue
            if (before.has(truss.key)) {
                gsap.set(clip, { attr: { width: truss.length + 2 * CLIP_OVERREACH } })
                continue
            }
            timeline.fromTo(
                clip,
                { attr: { width: 0 } },
                {
                    attr: { width: truss.length + 2 * CLIP_OVERREACH },
                    duration,
                    ease: 'power2.out'
                },
                0
            )
        }

        animationContext.afterAnimations(() => {
            this.growing = []
            this.dockingBoard = undefined
        })
    }
}

function reversed(tube: StationTube): StationTube {
    return { ...tube, from: tube.to, to: tube.from, fromHub: tube.toHub, toHub: tube.fromHub }
}

function girderEnds(tube: StationTube): { start: Point; end: Point } {
    return trussEnds(
        hexGeometry(tube.from).center,
        hexGeometry(tube.to).center,
        tube.fromHub,
        tube.toHub
    )
}

// A truss's key: its tube's hex keys joined with a dash, so it is safe inside a clip-path url().
function trussKey(tube: StationTube): string {
    return stationTubeKey(tube).replace(':', '-')
}

function growingTruss(tube: StationTube, oriented: StationTube): GrowingTruss {
    const { start, end } = girderEnds(oriented)
    return {
        key: trussKey(tube),
        playerId: tube.playerId,
        girder: girderEnds(tube),
        start,
        length: Math.hypot(end.x - start.x, end.y - start.y),
        degrees: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
    }
}
