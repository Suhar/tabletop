import type { AnimationContext } from '@tabletop/frontend-components'
import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { getHex, PieceType, type HydratedEarendelGameState } from '@tabletop/earendel'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { pieceMovesBetween } from '$lib/utils/actionEffects.js'
import { linkedStationNeighbors } from '$lib/utils/stationLinks.js'

export const MOVE_DURATION = 0.45
export const FALLBACK_MOVE_DURATION = 0.15
// A docked station waits while its girders fade, so it leaves with all its stubs back.
const UNDOCK_PAUSE = 0.2

type RenderedPiece = { node: SVGGElement; coords: AxialCoordinates }

export class PieceMoveAnimator {
    private pieces = new Map<string, RenderedPiece>()

    // Stations moving in the current transition: drawn with every docking stub until it ends.
    undocked: string[] = $state([])

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
        const moves = pieceMovesBetween(from.board, to.board)

        const undocked = moves.flatMap((move) => {
            const piece = getHex(from.board, move.from)?.piece
            if (piece?.type !== PieceType.Station) return []
            const docked = linkedStationNeighbors(from.board, move.from, piece.playerId).length > 0
            return [{ pieceId: move.pieceId, docked }]
        })
        // Only with an action: the actionless fallback stays within its short budget.
        const start = action && undocked.some((station) => station.docked) ? UNDOCK_PAUSE : 0
        if (undocked.length > 0) {
            this.undocked = undocked.map((station) => station.pieceId)
            animationContext.afterAnimations(() => {
                this.undocked = []
            })
        }

        for (const move of moves) {
            const rendered = this.pieces.get(move.pieceId)
            if (!rendered) continue

            const base = hexGeometry(rendered.coords).center
            const target = hexGeometry(move.to).center
            animationContext.actionTimeline.to(
                rendered.node,
                { x: target.x - base.x, y: target.y - base.y, duration, ease: 'power2.inOut' },
                start
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
