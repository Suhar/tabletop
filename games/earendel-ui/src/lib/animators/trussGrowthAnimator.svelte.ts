import type { AnimationContext } from '@tabletop/frontend-components'
import type { AxialCoordinates, GameAction, Point } from '@tabletop/common'
import { getHex, hexKey, type HydratedEarendelGameState } from '@tabletop/earendel'
import { tick } from 'svelte'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { trussEnds } from '$lib/utils/stationGeometry.js'
import {
    linkedStationNeighbors,
    stationTubeKey,
    stationTubesOf,
    type StationTube
} from '$lib/utils/stationLinks.js'

// A girder growing out of a station that has just arrived, toward the station it links to.
export type GrowingTruss = {
    key: string
    playerId: string
    start: Point
    end: Point
    length: number
    degrees: number
}

// A station that has arrived but is not on the visible board yet: the board still shows the
// state before the action until the animations finish, so the girders would otherwise grow out of
// an empty hex.
export type ArrivingStation = {
    coords: AxialCoordinates
    playerId: string
    hub: boolean
    linked: AxialCoordinates[]
}

// Seconds. A live action (or a replay of one) is worth watching; undo and history scrubbing only
// need the change to be followable.
const GROW_DURATION = 0.5
const FALLBACK_GROW_DURATION = 0.15

// Grows the girders between linked stations when a link is made. Keyed on the state rather than
// on an action type: placing a station, a Wormhole jump, a Tactical Feint, and undoing a station's
// destruction all make links, and they are all the same change here - a girder in the new state
// that the old one did not have.
//
// Pattern B (new item): the new station and its girders are drawn transiently while the board
// still shows the old state, each girder revealed from its new station outward by a clip that
// widens along it, and the transients are cleared just as the real state takes over.
export class TrussGrowthAnimator {
    growing: GrowingTruss[] = $state([])
    arriving: ArrivingStation[] = $state([])

    private clips = new Map<string, SVGRectElement>()

    setClip(key: string, element?: SVGRectElement) {
        if (element) {
            this.clips.set(key, element)
        } else {
            this.clips.delete(key)
        }
    }

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

        const before = new Set(stationTubesOf(from.board).map(stationTubeKey))
        const made = stationTubesOf(to.board).filter((tube) => !before.has(stationTubeKey(tube)))
        if (made.length === 0) return

        // A station has arrived at a hex if a different piece - or none - stood there before.
        const arrived = (coords: AxialCoordinates) =>
            getHex(from.board, coords)?.piece?.id !== getHex(to.board, coords)?.piece?.id

        const arrivals = new Map<number, ArrivingStation>()
        const growing = made.map((tube) => {
            // Grow from the end that arrived, toward the one already standing.
            const oriented = arrived(tube.to) && !arrived(tube.from) ? reversed(tube) : tube
            for (const coords of [oriented.from, oriented.to]) {
                if (!arrived(coords) || arrivals.has(hexKey(coords))) continue
                const piece = getHex(to.board, coords)?.piece
                if (!piece) continue
                arrivals.set(hexKey(coords), {
                    coords,
                    playerId: piece.playerId,
                    hub: piece.hub === true,
                    linked: linkedStationNeighbors(to.board, coords, piece.playerId)
                })
            }
            return growingTruss(oriented)
        })

        this.growing = growing
        this.arriving = [...arrivals.values()]

        // The transient girders have to be mounted before their clips can be tweened.
        await tick()

        const duration = action ? GROW_DURATION : FALLBACK_GROW_DURATION
        for (const truss of growing) {
            const clip = this.clips.get(truss.key)
            if (!clip) continue
            animationContext.actionTimeline.fromTo(
                clip,
                { attr: { width: 0 } },
                { attr: { width: truss.length }, duration, ease: 'power2.out' },
                0
            )
        }

        // Runs in the same synchronous step as the state swap, so the real girders replace these
        // without a frame of neither.
        animationContext.afterAnimations(() => {
            this.growing = []
            this.arriving = []
        })
    }
}

function reversed(tube: StationTube): StationTube {
    return { ...tube, from: tube.to, to: tube.from, fromHub: tube.toHub, toHub: tube.fromHub }
}

function growingTruss(tube: StationTube): GrowingTruss {
    const { start, end } = trussEnds(
        hexGeometry(tube.from).center,
        hexGeometry(tube.to).center,
        tube.fromHub,
        tube.toHub
    )
    return {
        // Hex keys joined with a dash, so the key is safe inside a clip-path url().
        key: stationTubeKey(tube).replace(':', '-'),
        playerId: tube.playerId,
        start,
        end,
        length: Math.hypot(end.x - start.x, end.y - start.y),
        degrees: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
    }
}

export function animateTrussClip(
    node: SVGRectElement,
    params: { animator: TrussGrowthAnimator; key: string }
) {
    let current = params
    current.animator.setClip(current.key, node)

    return {
        update(next: { animator: TrussGrowthAnimator; key: string }) {
            if (next.key === current.key) return
            current.animator.setClip(current.key, undefined)
            current = next
            current.animator.setClip(current.key, node)
        },
        destroy() {
            current.animator.setClip(current.key, undefined)
        }
    }
}
