import { assertExists } from '@tabletop/common'
import { TwoCrownsPlayerData } from './generated/data.js'

export function twoCrownsPlayerSetup(playerCount: number) {
    const setup = TwoCrownsPlayerData.find((entry) => entry.count === playerCount)
    assertExists(setup, `The Two Crowns has no setup for ${playerCount} players`)
    return setup
}
