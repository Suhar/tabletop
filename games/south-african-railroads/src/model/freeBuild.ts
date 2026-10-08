import { SETTLEMENTS } from '../components/mapData.js'
import type { RailroadId } from '../components/railroads.js'

export function freeBuildHome(railroadId: RailroadId): string {
    const home = SETTLEMENTS.find((candidate) => candidate.homeOf === railroadId)
    if (!home) {
        throw Error(`${railroadId} has no home settlement`)
    }
    return home.id
}
