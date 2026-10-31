import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import { type Hex, HexKind, hexKey, type HydratedEarendelGameState } from '@tabletop/earendel'
import { tick } from 'svelte'
import { ElementRegistry } from './elementRegistry.js'

export const WIPE_DURATION = 0.9
const FALLBACK_WIPE_DURATION = 0.15

// A planet whose colour is changing, drawn in its new colour while a scan line wipes it in.
export type TerraformWipe = { key: string; hex: Hex }

// Recolours sweep across the planet from left to right behind a white line, leaving the new
// colour, before the new state is shown.
export class TerraformAnimator {
    wipes: TerraformWipe[] = $state([])

    readonly clips = new ElementRegistry<SVGRectElement>()
    readonly lines = new ElementRegistry<SVGGElement>()

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

        const recoloured = Object.values(to.board.hexes).filter((hex) => {
            if (hex.kind !== HexKind.Planet) return false
            const before = from.board.hexes[hexKey(hex.coords)]
            return before?.kind === HexKind.Planet && before.color !== hex.color
        })
        if (recoloured.length === 0) return

        this.wipes = recoloured.map((hex) => ({ key: String(hexKey(hex.coords)), hex }))

        // The copies have to be mounted before their clips and lines can be tweened.
        await tick()

        const duration = action ? WIPE_DURATION : FALLBACK_WIPE_DURATION
        for (const wipe of this.wipes) {
            const clip = this.clips.get(wipe.key)
            const line = this.lines.get(wipe.key)
            const width = Number(clip?.getAttribute('data-width') ?? 0)
            if (clip) {
                animationContext.actionTimeline.fromTo(
                    clip,
                    { attr: { width: 0 } },
                    { attr: { width }, duration, ease: 'power1.inOut' },
                    0
                )
            }
            if (line) {
                animationContext.actionTimeline.fromTo(
                    line,
                    { x: 0, opacity: 1 },
                    { x: width, duration, ease: 'power1.inOut' },
                    0
                )
                animationContext.actionTimeline.to(
                    line,
                    { opacity: 0, duration: Math.min(0.15, duration / 3) },
                    duration
                )
            }
        }

        animationContext.afterAnimations(() => {
            this.wipes = []
        })
    }
}
