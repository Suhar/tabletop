import { GameSession } from '@tabletop/frontend-components'
import type { HydratedEarendelGameState, EarendelGameState } from '@tabletop/earendel'

export class EarendelGameSession extends GameSession<
    EarendelGameState,
    HydratedEarendelGameState
> {}
