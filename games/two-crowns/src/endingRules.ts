import { TwoCrownsNames } from './names.js'
import { TwoCrownsMarket } from './stockMarket.js'
import {
    certificateWealthItem,
    getCompany,
    marketShareValue,
    portfolioWealth,
    type EndingRules
} from '@tabletop/18xx'
import { TwoCrownsPrivateCatalog } from './privates.js'
import { bondShareNumber, isBond } from './holdings.js'
import { twoCrownsRole } from './companies.js'
const HolderLabels: Record<string, string> = { P12: 'Austrian Bank', P14: 'Hungarian Bank' }
export const TwoCrownsEndingRules: EndingRules = {
    trigger(state) {
        if (state.bankruptcy) return { reason: 'Bankruptcy' }
        if (state.phaseId === 'D')
            return {
                reason: 'First D',
                finalOperatingSet: (state.operatingSet?.number ?? 0) + 1
            }
        return undefined
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        const holder = HolderLabels[company.id]
        if (holder && !company.closed)
            return portfolioWealth(
                state,
                { kind: 'company', companyId: company.id },
                TwoCrownsEndingRules
            ).map((item) => ({ ...item, label: `${holder}: ${item.label}` }))
        let value = 0
        if (certificate.kind === 'share' && company.id === 'LUKA') value = 80 * certificate.shares
        else if (isBond(company.id) && !company.closed) {
            // An unexchanged Bond is worth the share it becomes.
            const share = state.certificates.find(
                (item) =>
                    item.id ===
                    `${twoCrownsRole(state, 'narodna')}:share:${bondShareNumber(company.id)}`
            )
            value = share ? marketShareValue(TwoCrownsMarket, state, share) : 0
        } else if (!company.closed) {
            value =
                certificate.kind === 'share'
                    ? marketShareValue(TwoCrownsMarket, state, certificate)
                    : TwoCrownsPrivateCatalog.faceValue(company.id)
        }
        return [certificateWealthItem(TwoCrownsNames, certificate, value)]
    }
}
