import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction, Point } from '@tabletop/common'
import type { HydratedEarendelGameState } from '@tabletop/earendel'
import { tick } from 'svelte'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { shotsOf } from '$lib/utils/actionEffects.js'
import { ElementRegistry } from './elementRegistry.js'

export type Blast = { key: string; at: Point; destroyed: boolean }

// Pattern B: a shot landing, larger with sparks for a kill than for a fighter knocked down a
// level. Played on actionTimeline while the target is still drawn from the state before the shot,
// so the swap that removes or demotes it lands after the blast. Only with an action.
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
            destroyed: shot.destroyed
        }))

        await tick()

        const timeline = animationContext.actionTimeline
        for (const blast of this.blasts) {
            const element = this.elements.get(blast.key)
            if (!element) continue

            const boom = blast.destroyed ? 1 : 0.55
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
                    0
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
                    0
                )
            }
            if (sparks) {
                timeline.fromTo(
                    sparks,
                    { ...origin, scale: 0.4, opacity: 1 },
                    { scale: 1.9, opacity: 0, duration: 0.62, ease: 'power2.out' },
                    0
                )
            }
        }

        animationContext.afterAnimations(() => {
            this.blasts = []
        })
    }
}
