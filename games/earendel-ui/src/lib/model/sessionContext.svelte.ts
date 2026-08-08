import { createGameSessionContext } from '@tabletop/frontend-components'
import { EarendelGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<EarendelGameSession>()

export function setGameSession(session: EarendelGameSession) {
    setContext(session)
}

export function getGameSession(): EarendelGameSession {
    return getContext()
}
