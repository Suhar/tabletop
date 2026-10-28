import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { TwoCrownsRouteRules } from '@tabletop/two-crowns'

serveAutorouter(TwoCrownsRouteRules, solverUrl)
