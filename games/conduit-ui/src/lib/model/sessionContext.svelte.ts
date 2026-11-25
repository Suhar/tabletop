import { createGameSessionContext } from '@tabletop/frontend-components'
import { ConduitGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<ConduitGameSession>()

export function setGameSession(session: ConduitGameSession) {
    setContext(session)
}

export function getGameSession(): ConduitGameSession {
    return getContext()
}
