import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction, Point } from '@tabletop/common'
import type { HydratedEarendelGameState } from '@tabletop/earendel'
import { tick } from 'svelte'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { scoreSourcesOf, type ScoreSource } from '$lib/utils/actionEffects.js'
import { ElementRegistry } from './elementRegistry.js'

export type ScoreFloat = Omit<ScoreSource, 'coords'> & { key: string; at: Point }

const RISE = 70
const STACK_GAP = 30

export class ScoreFloatAnimator {
    floats: ScoreFloat[] = $state([])
    readonly elements = new ElementRegistry<SVGGElement>()

    async onGameStateChange({
        action,
        animationContext
    }: {
        to: HydratedEarendelGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!action) return

        const sources = scoreSourcesOf(action)
        if (sources.length === 0) return

        this.floats = sources.map((source, index) => {
            const center = hexGeometry(source.coords).center
            return {
                key: `${action.id}-${index}`,
                points: source.points,
                caption: source.caption,
                playerId: source.playerId,
                at: { x: center.x, y: center.y - index * STACK_GAP }
            }
        })

        await tick()

        const timeline = animationContext.finalTimeline
        for (const float of this.floats) {
            const element = this.elements.get(float.key)
            if (!element) continue
            timeline.fromTo(
                element,
                { y: 0, opacity: 0 },
                { y: -RISE, duration: 0.8, ease: 'power1.out' },
                0
            )
            timeline.to(element, { opacity: 1, duration: 0.12 }, 0)
            timeline.to(element, { opacity: 0, duration: 0.25 }, 0.55)
        }

        animationContext.afterAnimations(() => {
            this.floats = []
        })
    }
}
