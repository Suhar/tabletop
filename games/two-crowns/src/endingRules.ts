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
        if (company.id === 'P12' && !company.closed)
            return portfolioWealth(
                state,
                { kind: 'company', companyId: 'P12' },
                TwoCrownsEndingRules
            ).map((item) => ({ ...item, label: `Štedionica: ${item.label}` }))
        let value = 0
        if (certificate.kind === 'share' && company.id === 'LUKA') value = 80 * certificate.shares
        else if (!company.closed) {
            value =
                certificate.kind === 'share'
                    ? marketShareValue(TwoCrownsMarket, state, certificate)
                    : TwoCrownsPrivateCatalog.faceValue(company.id)
        }
        return [certificateWealthItem(TwoCrownsNames, certificate, value)]
    }
}
