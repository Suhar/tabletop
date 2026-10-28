import { companyCharters } from '@tabletop/18xx'
import { TwoCrownsBranches } from './branches.js'
import { TwoCrownsCompanies } from './companies.js'
import { TwoCrownsPrivates } from './privates.js'

export const TwoCrownsCharters = companyCharters(() => ({
    shareCounts: Object.fromEntries([
        ...TwoCrownsCompanies.map((company) => [company.companyId, 10]),
        ...TwoCrownsBranches.map((branch) => [branch.id, 10])
    ]),
    privateRevenues: Object.fromEntries(
        TwoCrownsPrivates.map((company) => [company.id, company.revenue])
    ),
    unsharedCompanyIds: ['LUKA']
}))
