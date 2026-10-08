import type { GameAction } from '@tabletop/common'
import {
    ActionBox,
    AuctionKind,
    externalConnection,
    isBuildConnection,
    isBuildTrack,
    isChooseAction,
    isDeclineOffer,
    isDelegateBuild,
    isDevelop,
    isFinishDevelopment,
    isOfferShare,
    isPassBid,
    isPayDividends,
    isPlaceBid,
    link,
    railroadDefinition,
    settlement,
    type RailroadId,
    type ShareSale
} from '@tabletop/south-african-railroads'

// A description reads as text with player names spliced in where a segment names a player.
export type DescriptionSegment = string | { playerId: string } | { railroadId: RailroadId }
export type Description = DescriptionSegment[]

export const BOX_NAMES: Record<ActionBox, string> = {
    [ActionBox.ConstructTrack]: 'Construct Track',
    [ActionBox.OfferStock]: 'Offer Stock',
    [ActionBox.DevelopSettlements]: 'Develop Settlements',
    [ActionBox.PayDividends]: 'Pay Dividends'
}

export function linkName(linkId: string): string {
    return link(linkId)
        .ends.map((id) => settlement(id).name)
        .join('–')
}

export function saleDescription(sale: ShareSale): Description {
    const railroad = { railroadId: sale.railroadId }
    if (sale.buyerId === undefined) {
        return ['nobody bought the ', railroad, ' share']
    }
    if (sale.price === 0 && sale.kind !== AuctionKind.OfferStock) {
        return [{ playerId: sale.buyerId }, ' takes the ', railroad, ' share free']
    }
    return [{ playerId: sale.buyerId }, ` buys the `, railroad, ` share for $${sale.price}`]
}

export function describeAction(action: GameAction): Description {
    if (isPlaceBid(action)) {
        return [`bid $${action.amount}`]
    }
    if (isPassBid(action)) {
        return ['passed']
    }
    if (isChooseAction(action)) {
        const track = action.metadata ? ` (action track ${action.metadata.actionTrack})` : ''
        const idle = action.metadata?.nothingToDo ? ' with nothing to do' : ''
        return [`chose ${BOX_NAMES[action.box]}${track}${idle}`]
    }
    if (isBuildTrack(action)) {
        const cost = action.metadata?.cost ?? 0
        const links = action.linkIds.map(linkName).join(' and ')
        const price = cost === 0 ? ' free' : ` for $${cost}`
        const zasm = action.metadata?.opensZasm ? ' · Johannesburg reached: the ZASM opens' : ''
        return [`built ${links} for the `, { railroadId: action.railroadId }, `${price}${zasm}`]
    }
    if (isBuildConnection(action)) {
        const connection = externalConnection(action.connectionId)
        const perShare = action.metadata?.perShare ?? 0
        return [
            `connected the `,
            { railroadId: action.railroadId },
            ` to ${connection.name} for $${connection.price} · special dividend $${perShare} a share`
        ]
    }
    if (isDelegateBuild(action)) {
        return [
            'had ',
            { playerId: action.builderId },
            ' build for the ',
            { railroadId: action.railroadId }
        ]
    }
    if (isDevelop(action)) {
        const name = settlement(action.settlementId).name
        const cost = action.metadata?.cost ? ` for $${action.metadata.cost}` : ''
        const income = action.metadata ? ` (now $${action.metadata.income})` : ''
        return [`developed ${name}${cost}${income}`]
    }
    if (isFinishDevelopment(action)) {
        return ['stopped after one development']
    }
    if (isOfferShare(action)) {
        const minimum = action.metadata ? ` · minimum $${action.metadata.minimum}` : ''
        return action.ownShare
            ? ['offered one of their own ', { railroadId: action.railroadId }, ` shares${minimum}`]
            : ['offered a ', { railroadId: action.railroadId }, ` share${minimum}`]
    }
    if (isDeclineOffer(action)) {
        return ['offered no share']
    }
    if (isPayDividends(action)) {
        const metadata = action.metadata
        if (!metadata) {
            return ['Dividends paid']
        }
        const rates = metadata.rates
            .map((rate) => `${railroadDefinition(rate.railroadId).shortName} $${rate.perShare}`)
            .join(', ')
        return [
            metadata.final
                ? `Final payoff per share: ${rates}`
                : `Dividend ${metadata.dividendNumber} per share: ${rates}`
        ]
    }
    return [action.type]
}

export function actionSale(action: GameAction): ShareSale | undefined {
    if (isPlaceBid(action) || isPassBid(action) || isOfferShare(action)) {
        return action.metadata?.sale
    }
    return undefined
}

export function withdrawnBidders(action: GameAction): string[] {
    if (isPlaceBid(action) || isOfferShare(action)) {
        return action.metadata?.withdrawnPlayerIds ?? []
    }
    return []
}
