import { withScenarios } from '@tabletop/18xx/scenarios'
import { Definition, TwoCrownsTitleRules } from '../definition/gameDefinition.js'

function preparedPositionsUnavailable(): never {
    throw new Error('The Two Crowns offers only the opening position so far')
}

export const TwoCrownsScenarios = withScenarios(Definition, TwoCrownsTitleRules, {
    createMarket: preparedPositionsUnavailable,
    createFinances: preparedPositionsUnavailable,
    prepareEnding: preparedPositionsUnavailable
})
