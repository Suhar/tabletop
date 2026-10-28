import type { MarketZone } from '@tabletop/18xx-ui'
import { TwoCrownsPhases } from '@tabletop/two-crowns'
import { TwoCrownsTrainColors } from './trainPresentation.js'

// Each par price is the highest open from its first phase until the next price's first phase
// removes it, as the printed board lists beside each par space.
const ParPrices = [
    { color: 'yellow', price: 80, firstPhaseId: '2H' },
    { color: 'green', price: 74, firstPhaseId: '5H' },
    { color: 'blue', price: 65, firstPhaseId: '3+' },
    { color: 'red', price: 58, firstPhaseId: '7' }
] as const

const phaseIds = TwoCrownsPhases.phases.map((phase) => phase.id)

const parZones = ParPrices.map(({ color, price, firstPhaseId }, index) => {
    const removedAt = ParPrices[index + 1]?.firstPhaseId
    const phases = phaseIds.slice(
        phaseIds.indexOf(firstPhaseId),
        removedAt ? phaseIds.indexOf(removedAt) : undefined
    )
    const zone = {
        color,
        name: `Top par in ${phases.join(', ')}`,
        description: removedAt
            ? `Starting price $${price}, open until the first ${removedAt} is bought.`
            : `Starting price $${price}, open all game.`
    }
    return { zone, firstPhaseId, phases }
})

export const TwoCrownsMarketZones: readonly MarketZone[] = parZones.map(
    ({ zone, firstPhaseId }) => ({
        ...zone,
        fill: { kind: 'solid', color: TwoCrownsTrainColors[firstPhaseId] }
    })
)
