import type { AnimationContext } from '@tabletop/frontend-components'
import type { AxialCoordinates } from '@tabletop/common'
import type { GameAction } from '@tabletop/common'
import {
    type EarendelBoard,
    hexKey,
    type HydratedEarendelGameState,
    type Piece
} from '@tabletop/earendel'
import { tick } from 'svelte'
import { ElementRegistry } from './elementRegistry.js'

export type ArrivingPiece = { key: string; coords: AxialCoordinates; piece: Piece }

// The opening station's flourish: each orbit spreads from the station and fades.
const FLOURISH = 0.9
const FLOURISH_GAP = 0.2

// The visible board keeps the state from before an action until its animations end, so a piece the
// action placed would be missing all that while. Every newly arrived piece is drawn here instead,
// from the start of the change until the new state is shown.
export class ArrivalAnimator {
    arriving: ArrivingPiece[] = $state([])
    // The opening stations' flourish groups, one per arriving founding station.
    readonly flourishes = new ElementRegistry<SVGGElement>()

    constructor(private readonly shownBoard: () => EarendelBoard) {}

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

        // Stood in against the board on show, not this step's start: while a run of actions
        // plays, the board on show is still the one from before the first of them, so a ship
        // placed by an earlier step keeps its stand-in while a later step animates.
        const pieceIds = (board: EarendelBoard) =>
            new Set(Object.values(board.hexes).flatMap((hex) => (hex.piece ? [hex.piece.id] : [])))
        const shown = pieceIds(this.shownBoard())
        const before = pieceIds(from.board)
        const arrived = Object.values(to.board.hexes).flatMap((hex) =>
            hex.piece && !shown.has(hex.piece.id)
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

        // The flourish explains a placement, so only the action that placed the station plays
        // it; undo and state-only history show the station in place.
        const placedNow = arrived.filter(
            (arrival) => arrival.piece.founding && !before.has(arrival.piece.id)
        )
        if (!action || placedNow.length === 0) return
        await tick()
        const timeline = animationContext.actionTimeline
        for (const arrival of placedNow) {
            const group = this.flourishes.get(arrival.key)
            if (!group) continue
            const orbits = [
                group.querySelector('[data-flourish="outer"]'),
                group.querySelector('[data-flourish="inner"]')
            ]
            orbits.forEach((orbit, index) => {
                if (!orbit) return
                timeline.fromTo(
                    orbit,
                    { transformOrigin: '50% 50%', scale: 0.35, opacity: 0.9 },
                    { scale: 2.1, opacity: 0, duration: FLOURISH, ease: 'power2.out' },
                    index * FLOURISH_GAP
                )
            })
        }
    }
}
