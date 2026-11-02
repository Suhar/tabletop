import type { AnimationContext } from '@tabletop/frontend-components'
import type { AxialCoordinates } from '@tabletop/common'
import { hexKey, type HydratedEarendelGameState, type Piece } from '@tabletop/earendel'

export type ArrivingPiece = { key: string; coords: AxialCoordinates; piece: Piece }

// The visible board keeps the state from before an action until its animations end, so a piece the
// action placed would be missing all that while. Every newly arrived piece is drawn here instead,
// from the start of the change until the new state is shown.
export class ArrivalAnimator {
    arriving: ArrivingPiece[] = $state([])

    async onGameStateChange({
        to,
        from,
        animationContext
    }: {
        to: HydratedEarendelGameState
        from?: HydratedEarendelGameState
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) return

        const before = new Set(
            Object.values(from.board.hexes).flatMap((hex) => (hex.piece ? [hex.piece.id] : []))
        )
        const arrived = Object.values(to.board.hexes).flatMap((hex) =>
            hex.piece && !before.has(hex.piece.id)
                ? [
                      {
                          key: `${hex.piece.id}@${hexKey(hex.coords)}`,
                          coords: hex.coords,
                          piece: hex.piece
                      }
                  ]
                : []
        )
        if (arrived.length === 0) return

        this.arriving = arrived
        animationContext.afterAnimations(() => {
            this.arriving = []
        })
    }
}
