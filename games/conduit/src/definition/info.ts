import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const ConduitInfo: GameInfo = {
    id: 'conduit',
    metadata: {
        name: 'Conduit',
        hasScores: true,
        designer: 'Dan Domme',
        description:
            'Invest in a regional power grid. Bid cubes for station tiles, wire them into the network ' +
            'and earn from the shortest route to the next station letter, while stations without ' +
            'investment go dark. The player who contributes most to the grid earns the most cash.',
        year: '2026',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        // A prototype in playtesting: only alpha testers and developers see it.
        visibility: GameVisibility.Alpha
    }
}
