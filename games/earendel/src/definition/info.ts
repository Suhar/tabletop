import { type GameInfo, GameVisibility } from '@tabletop/common'
import { GAME_VERSION } from './version.js'
import { EarendelConfigurator } from './configurator.js'

export const EarendelInfo: GameInfo = {
    id: 'earendel',
    metadata: {
        name: 'Earendel',
        designer: 'Unknown',
        description: 'Earendel is a tabletop game implemented using the Tabletop framework.',
        year: '2026',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        // Listed only for alpha testers while the rules are still settling.
        visibility: GameVisibility.Alpha
    },
    configurator: new EarendelConfigurator()
}
