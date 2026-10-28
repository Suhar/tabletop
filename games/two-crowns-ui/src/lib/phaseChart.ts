import { createPhaseChart } from '@tabletop/18xx-ui'
import { TwoCrownsPhases, TwoCrownsTrainDepot } from '@tabletop/two-crowns'

export const TwoCrownsPhaseChart = createPhaseChart({
    phases: TwoCrownsPhases,
    depot: TwoCrownsTrainDepot,
    rustNotes: {
        '4+': 'At phase D, a company-owned 4+ survives only if it has had no operating opportunity. It rusts after its company’s next run step, even if unused, and cannot be traded.'
    },
    phaseNotes: {
        '2H': 'Start prices: 58, 65, 74, 80.',
        '4H': 'Wiener Neustadt purchasable through 3+ for up to $200 (not by the Luka).',
        '5H': '80 start price removed; available: 58, 65, 74.',
        '3+': '74 start price removed; available: 58, 65.',
        '4+': 'Privates close except the Štedionica.',
        '7': '65 start price removed; only 58 remains.'
    },
    notes: ['The Luka may buy at most one train from the bank per operating turn.']
})
