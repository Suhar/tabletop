import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import type { GameInfo } from '@tabletop/common'
import { TwoCrownsTitle } from '../generated/data.js'
import { TwoCrownsConfigurator } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const TwoCrownsInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: 'two-crowns',
    metadata: {
        name: TwoCrownsTitle.name,
        hasScores: true,
        designer: TwoCrownsTitle.designer,
        year: '',
        description:
            'Austria and Hungary race their railways to Rijeka. A prototype 18xx for 3–5 players on The Old Prince 1871’s rules, with the Croatian map, privates and companies.',
        minPlayers: 3,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: false
    },
    configurator: new TwoCrownsConfigurator()
}
