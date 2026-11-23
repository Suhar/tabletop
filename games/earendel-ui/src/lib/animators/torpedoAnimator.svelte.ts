import type { AnimationContext } from '@tabletop/frontend-components'
import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { hexKey, type HydratedEarendelGameState, type Piece } from '@tabletop/earendel'
import { tick } from 'svelte'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { torpedoStrikeOf } from '$lib/utils/actionEffects.js'
import { ElementRegistry } from './elementRegistry.js'

// A torpedo turns to face its station, then runs into it: the blasts follow at the impact.
export const TORPEDO_AIM = 0.3
export const TORPEDO_RUN = 0.4
export const TORPEDO_IMPACT = TORPEDO_AIM + TORPEDO_RUN

export type FlyingTorpedo = { key: string; coords: AxialCoordinates; piece: Piece }

export class TorpedoAnimator {
    // A torpedo drawn for the strike when the board does not hold it: a placement followed at
    // once by its strike replays as two steps while the board still shows the state before both.
    flying: FlyingTorpedo[] = $state([])
    readonly elements = new ElementRegistry<SVGGElement>()

    constructor(private readonly nodeOf: (pieceId: string) => SVGGElement | undefined) {}

    async onGameStateChange({
        from,
        action,
        animationContext
    }: {
        to: HydratedEarendelGameState
        from?: HydratedEarendelGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        // Without an action (undo, state-only history) the torpedo simply comes or goes.
        if (!action || !from) return

        const strike = torpedoStrikeOf(action, from.board)
        if (!strike) return

        let node = this.nodeOf(strike.pieceId)
        if (!node) {
            const piece = from.board.hexes[hexKey(strike.from)]?.piece
            if (!piece) return
            const key = `${action.id}-${strike.pieceId}`
            this.flying = [{ key, coords: strike.from, piece }]
            animationContext.afterAnimations(() => {
                this.flying = []
            })
            await tick()
            node = this.elements.get(key)
            if (!node) return
        }

        const start = hexGeometry(strike.from).center
        const end = hexGeometry(strike.to).center
        const dx = end.x - start.x
        const dy = end.y - start.y
        // The dart points up at rest; this is the clockwise turn that points it at the station.
        const heading = (Math.atan2(dx, -dy) * 180) / Math.PI

        const timeline = animationContext.actionTimeline
        timeline.to(
            node,
            {
                rotation: `${heading}_short`,
                svgOrigin: `${start.x} ${start.y}`,
                duration: TORPEDO_AIM,
                ease: 'power2.inOut'
            },
            0
        )
        timeline.to(node, { x: dx, y: dy, duration: TORPEDO_RUN, ease: 'power3.in' }, TORPEDO_AIM)
        timeline.to(node, { opacity: 0, duration: 0.08 }, TORPEDO_IMPACT)
    }
}
