import type { AnimationContext } from '@tabletop/frontend-components'
import type { AxialCoordinates, GameAction } from '@tabletop/common'
import type { HydratedEarendelGameState } from '@tabletop/earendel'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { pieceMovesBetween } from '$lib/utils/actionEffects.js'

export const MOVE_DURATION = 0.45
export const FALLBACK_MOVE_DURATION = 0.15

type RenderedPiece = { node: SVGGElement; coords: AxialCoordinates }

export class PieceMoveAnimator {
    private pieces = new Map<string, RenderedPiece>()

    setPiece(pieceId: string, piece: RenderedPiece) {
        this.pieces.set(pieceId, piece)
    }

    nodeOf(pieceId: string): SVGGElement | undefined {
        return this.pieces.get(pieceId)?.node
    }

    releasePiece(pieceId: string, node: SVGGElement) {
        if (this.pieces.get(pieceId)?.node === node) this.pieces.delete(pieceId)
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

        const duration = action ? MOVE_DURATION : FALLBACK_MOVE_DURATION
        for (const move of pieceMovesBetween(from.board, to.board)) {
            const rendered = this.pieces.get(move.pieceId)
            if (!rendered) continue

            const base = hexGeometry(rendered.coords).center
            const target = hexGeometry(move.to).center
            animationContext.actionTimeline.to(
                rendered.node,
                { x: target.x - base.x, y: target.y - base.y, duration, ease: 'power2.inOut' },
                0
            )
        }
    }
}

export function animatePiece(
    node: SVGGElement,
    params: { animator: PieceMoveAnimator; pieceId: string; coords: AxialCoordinates }
) {
    let current = params
    current.animator.setPiece(current.pieceId, { node, coords: current.coords })

    return {
        update(next: { animator: PieceMoveAnimator; pieceId: string; coords: AxialCoordinates }) {
            current.animator.releasePiece(current.pieceId, node)
            current = next
            current.animator.setPiece(current.pieceId, { node, coords: current.coords })
        },
        destroy() {
            current.animator.releasePiece(current.pieceId, node)
        }
    }
}
