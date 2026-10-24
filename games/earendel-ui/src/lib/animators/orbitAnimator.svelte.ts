import type { AnimationContext } from '@tabletop/frontend-components'
import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { hexKey, type EarendelBoard, type HydratedEarendelGameState } from '@tabletop/earendel'
import { gsap } from 'gsap'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { ElementRegistry } from './elementRegistry.js'

export const ORBIT_RADIUS = 33
export const ORBITER_SCALE = 0.35
export const ORBIT_PERIOD = 40 // seconds per revolution, matching orbit-spin in Board
const ORBIT_DURATION = 0.7
const FALLBACK_ORBIT_DURATION = 0.15

// Where the k-th of n orbiters sits around its planet before the orbit's own rotation.
export function orbitSlot(planet: AxialCoordinates, index: number, count: number) {
    const center = hexGeometry(planet).center
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count
    return {
        x: center.x + ORBIT_RADIUS * Math.cos(angle),
        y: center.y + ORBIT_RADIUS * Math.sin(angle),
        angle
    }
}

type NewOrbiter = { pieceId: string; planet: AxialCoordinates; index: number; count: number }

function newOrbiters(from: EarendelBoard, to: EarendelBoard): NewOrbiter[] {
    return Object.values(to.hexes).flatMap((hex) => {
        const orbiters = hex.orbiters ?? []
        const before = new Set(
            (from.hexes[hexKey(hex.coords)]?.orbiters ?? []).map((probe) => probe.id)
        )
        return orbiters.flatMap((probe, index) =>
            before.has(probe.id)
                ? []
                : [{ pieceId: probe.id, planet: hex.coords, index, count: orbiters.length }]
        )
    })
}

// The orbit's current rotation, in radians, read from its running CSS animation.
function currentRotation(element: Element | undefined): number {
    if (!element) return 0
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return Math.atan2(matrix.b, matrix.a)
}

// A probe whose claim paid flies from its hex into the planet's orbit, shrinking as it goes,
// and lands where its orbiter will be drawn once the new state is shown.
export class OrbitAnimator {
    readonly orbits = new ElementRegistry<SVGGElement>()

    constructor(private pieceNode: (pieceId: string) => SVGGElement | undefined) {}

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

        const duration = action ? ORBIT_DURATION : FALLBACK_ORBIT_DURATION
        for (const orbiter of newOrbiters(from.board, to.board)) {
            const node = this.pieceNode(orbiter.pieceId)
            const fromHex = Object.values(from.board.hexes).find(
                (hex) => hex.piece?.id === orbiter.pieceId
            )
            if (!node || !fromHex) continue

            // The orbit keeps turning while the probe flies, so aim where the slot will be.
            const turned =
                currentRotation(this.orbits.get(String(hexKey(orbiter.planet)))) +
                (2 * Math.PI * duration) / ORBIT_PERIOD
            const center = hexGeometry(orbiter.planet).center
            const slot = orbitSlot(orbiter.planet, orbiter.index, orbiter.count)
            const angle = slot.angle + turned
            const start = hexGeometry(fromHex.coords).center

            gsap.set(node, { svgOrigin: `${start.x} ${start.y}` })
            animationContext.actionTimeline.to(
                node,
                {
                    x: center.x + ORBIT_RADIUS * Math.cos(angle) - start.x,
                    y: center.y + ORBIT_RADIUS * Math.sin(angle) - start.y,
                    scale: ORBITER_SCALE,
                    duration,
                    ease: 'power2.inOut'
                },
                0
            )
        }
    }
}
