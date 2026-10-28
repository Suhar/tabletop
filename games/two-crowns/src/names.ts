import { titleNames, isTreasuryPoolId } from '@tabletop/18xx'
import { TwoCrownsBranches } from './branches.js'
import { TwoCrownsCompanies } from './companies.js'
import { TwoCrownsPrivates } from './privates.js'

const PoolNames: Readonly<Record<string, string>> = {
    market: 'Market',
    reserved: 'Reserved exchanges',
    auction: 'Auction'
}

export const TwoCrownsNames = titleNames(
    Object.fromEntries([
        ...TwoCrownsCompanies.map((company) => [company.companyId, company.name]),
        ...TwoCrownsBranches.map((branch) => [branch.id, branch.name]),
        ['LUKA', 'Luka'],
        ...TwoCrownsPrivates.map((company) => [company.id, company.name])
    ]),
    (poolId) => (isTreasuryPoolId(poolId) ? 'Treasury shares' : PoolNames[poolId])
)
