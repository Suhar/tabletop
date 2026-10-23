import type { AnimationContext } from '@tabletop/frontend-components'
import type { AxialCoordinates, GameAction, Point } from '@tabletop/common'
import { getHex, hexKey, type HydratedEarendelGameState } from '@tabletop/earendel'
import { tick } from 'svelte'
import { ElementRegistry } from './elementRegistry.js'
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

// A station new to the board: the visible board still shows the state before the action until
// the animations finish, so the girders would otherwise grow out of an empty hex. A station that
// moved is not one of these; PieceMoveAnimator slides its own element to the new hex.
export type ArrivingStation = {
    coords: AxialCoordinates
    playerId: string
    hub: boolean
    linked: AxialCoordinates[]
}

const GROW_DURATION = 0.5
const FALLBACK_DURATION = 0.15

// Grows the girders a transition makes and fades the ones it breaks. With an action the girders
// grow on finalTimeline, after any piece has finished moving into place; without one, everything
// runs at once within the fallback budget.
export class TrussGrowthAnimator {
    growing: GrowingTruss[] = $state([])
    arriving: ArrivingStation[] = $state([])

    readonly clips = new ElementRegistry<SVGRectElement>()
    readonly girders = new ElementRegistry<SVGGElement>()

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

        const before = new Set(stationTubesOf(from.board).map(stationTubeKey))
        const made = stationTubesOf(to.board).filter((tube) => !before.has(stationTubeKey(tube)))
        if (made.length === 0) return

        const piecesBefore = new Set(
            Object.values(from.board.hexes).flatMap((hex) => (hex.piece ? [hex.piece.id] : []))
        )
        const changed = (coords: AxialCoordinates) =>
            getHex(from.board, coords)?.piece?.id !== getHex(to.board, coords)?.piece?.id

        const arrivals = new Map<number, ArrivingStation>()
        const growing = made.map((tube) => {
            const oriented = changed(tube.to) && !changed(tube.from) ? reversed(tube) : tube
            for (const coords of [oriented.from, oriented.to]) {
                const piece = getHex(to.board, coords)?.piece
                if (!piece || piecesBefore.has(piece.id) || arrivals.has(hexKey(coords))) continue
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

        const timeline = action ? animationContext.finalTimeline : animationContext.actionTimeline
        for (const truss of growing) {
            const clip = this.clips.get(truss.key)
            if (!clip) continue
            timeline.fromTo(
                clip,
                { attr: { width: 0 } },
                { attr: { width: truss.length }, duration, ease: 'power2.out' },
                0
            )
        }

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
