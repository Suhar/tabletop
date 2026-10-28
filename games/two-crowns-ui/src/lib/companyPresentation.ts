import { companyNameVariants } from '@tabletop/18xx-ui'
import {
    TwoCrownsBranchCompanies,
    TwoCrownsLukaCompanies,
    TwoCrownsNames,
    TwoCrownsPrivates
} from '@tabletop/two-crowns'

export const TwoCrownsCompanyNames = companyNameVariants(TwoCrownsNames, {
    ...Object.fromEntries(
        TwoCrownsLukaCompanies.map((company) => [
            company.companyId,
            { initials: company.companyId }
        ])
    ),
    ...Object.fromEntries(
        TwoCrownsBranchCompanies.map((branch) => [branch.id, { initials: branch.label }])
    ),
    ...Object.fromEntries(TwoCrownsPrivates.map((item) => [item.id, { initials: item.id }])),
    LUKA: { initials: 'LUKA', short: 'Luka' }
})
