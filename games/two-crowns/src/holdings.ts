import type { Certificate, Owner } from '@tabletop/18xx'

// Charters that hold shares for their owner (1874design.md, Austrian Bank and Hungarian Bank).
export const ShareHoldingCharterIds = ['P12', 'P14'] as const
export function isShareHoldingCharter(owner: Owner): boolean {
    return (
        owner.kind === 'company' &&
        (ShareHoldingCharterIds as readonly string[]).includes(owner.companyId)
    )
}
// A share no player or bank pool can buy: held by a player, a charter, or reserved.
export function isHeldShare(certificate: Certificate): boolean {
    return (
        certificate.owner.kind === 'player' ||
        certificate.poolId === 'reserved' ||
        isShareHoldingCharter(certificate.owner)
    )
}

// One Public Line Bond per player (1874design.md, Public Line Bond). Bond n exchanges for
// reserved Public Line share n.
export const MaxPlayers = 5
export const BondIds = Array.from({ length: MaxPlayers }, (_, index) => `BD${index + 1}`)
export function isBond(privateCompanyId: string): boolean {
    return BondIds.includes(privateCompanyId)
}
export function bondShareNumber(privateCompanyId: string): number {
    return BondIds.indexOf(privateCompanyId) + 1
}
// The Hungarian Bank's Public Line share is the last ordinary share.
export const CharterPublicShareNumber = 8
