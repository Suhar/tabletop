import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction, Point } from '@tabletop/common'
import type { HydratedEarendelGameState } from '@tabletop/earendel'
import { tick } from 'svelte'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { shotsOf } from '$lib/utils/actionEffects.js'
import { ElementRegistry } from './elementRegistry.js'
import { TORPEDO_IMPACT } from './torpedoAnimator.svelte.js'

export type Blast = { key: string; at: Point; destroyed: boolean; torpedo: boolean }

export class BlastAnimator {
    blasts: Blast[] = $state([])
    readonly elements = new ElementRegistry<SVGGElement>()

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
        if (!action || !from) return

        const shots = shotsOf(action, from.board)
        if (shots.length === 0) return

        this.blasts = shots.map((shot, index) => ({
            key: `${action.id}-${index}`,
            at: hexGeometry(shot.coords).center,
            destroyed: shot.destroyed,
            torpedo: shot.torpedo === true
        }))

        await tick()

        const timeline = animationContext.actionTimeline
        for (const blast of this.blasts) {
            const element = this.elements.get(blast.key)
            if (!element) continue

            // A torpedo's blast is bigger, and waits for the torpedo to arrive.
            const boom = blast.torpedo ? 1.4 : blast.destroyed ? 1 : 0.55
            const at = blast.torpedo ? TORPEDO_IMPACT : 0
            const flash = element.querySelector('[data-blast="flash"]')
            const ring = element.querySelector('[data-blast="ring"]')
            const sparks = element.querySelector('[data-blast="sparks"]')
            const origin = { transformOrigin: '50% 50%' }

            if (flash) {
                timeline.fromTo(
                    flash,
                    { ...origin, scale: 0.3 * boom, opacity: 1 },
                    {
                        scale: 1.7 * boom,
                        opacity: 0,
                        duration: blast.destroyed ? 0.38 : 0.32,
                        ease: 'power2.out'
                    },
                    at
                )
            }
            if (ring) {
                timeline.fromTo(
                    ring,
                    { ...origin, scale: 0.25 * boom, opacity: 0.95 },
                    {
                        scale: 2.3 * boom,
                        opacity: 0,
                        duration: blast.destroyed ? 0.78 : 0.32,
                        ease: 'power2.out'
                    },
                    at
                )
            }
            if (sparks) {
                timeline.fromTo(
                    sparks,
                    { ...origin, scale: 0.4, opacity: 1 },
                    { scale: 1.9 * boom, opacity: 0, duration: 0.62, ease: 'power2.out' },
                    at
                )
            }
        }

        animationContext.afterAnimations(() => {
            this.blasts = []
        })
    }
}
