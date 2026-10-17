import { assertExists, type GameAction } from '@tabletop/common'
import {
    ActionBox,
    AuctionKind,
    LEAVE_TOWN_PAYOUT,
    isBuildConnection,
    isBuildTrack,
    isChooseAction,
    isDeclineOffer,
    isDelegateBuild,
    isDevelop,
    isFinishDevelopment,
    isFoundSpecialConnection,
    isLeaveTown,
    isOfferShare,
    isPassBid,
    isPayDividends,
    isPlaceBid,
    type RailroadId,
    type SarMap,
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

export const BOX_SHORT_NAMES: Record<ActionBox, string> = {
    [ActionBox.ConstructTrack]: 'Build',
    [ActionBox.OfferStock]: 'Offer',
    [ActionBox.DevelopSettlements]: 'Develop',
    [ActionBox.PayDividends]: 'Dividends'
}

function freeDevelopmentName(map: SarMap): string {
    const settlementId = map.definition.freeDevelopmentId
    assertExists(settlementId, `The ${map.definition.name} map develops nowhere free`)
    return map.settlement(settlementId).name
}

// What a box does, short enough for the action strip.
export function boxTerms(map: SarMap, box: ActionBox, finalPayoffNext: boolean): string {
    switch (box) {
        case ActionBox.ConstructTrack:
            return '$5 a link · $15 for two'
        case ActionBox.OfferStock:
            return 'Auction one share'
        case ActionBox.DevelopSettlements:
            return map.definition.leaveTown
                ? '2nd $3 · or Leave Town'
                : `2nd $3 · ${freeDevelopmentName(map)} free`
        case ActionBox.PayDividends:
            return finalPayoffNext ? 'Final payoff' : 'Income ÷ 5 a share'
    }
}

// One line per box for the strip's tooltips and the phone's rules guide.
export function boxRules(map: SarMap, box: ActionBox, finalPayoffNext: boolean): string {
    switch (box) {
        case ActionBox.ConstructTrack:
            return 'A railroad you control lays a link for $5, two for $15, or a connection'
        case ActionBox.OfferStock:
            return 'Auction a railroad’s unsold share, or one of your own'
        case ActionBox.DevelopSettlements:
            return map.definition.leaveTown
                ? 'Raise a served settlement’s income, a second for $3; or Leave Town with a cube that pays $3 a dividend'
                : `Raise a served settlement’s income; a second costs $3, ${freeDevelopmentName(map)} is free`
        case ActionBox.PayDividends:
            return finalPayoffNext
                ? 'Pay the final payoff and end the game'
                : 'Every share pays its railroad’s income ÷ 5, rounded up'
    }
}

export function linkName(map: SarMap, linkId: string): string {
    return map
        .link(linkId)
        .ends.map((id) => map.settlement(id).name)
        .join('–')
}

export function saleDescription(sale: ShareSale): Description {
    const railroad = { railroadId: sale.railroadId }
    if (sale.buyerId === undefined) {
        return ['nobody bought the ', railroad, ' share']
    }
    if (sale.price === 0 && sale.kind !== AuctionKind.OfferStock) {
        return [{ playerId: sale.buyerId }, ' took the ', railroad, ' share free']
    }
    return [{ playerId: sale.buyerId }, ' bought the ', railroad, ` share for $${sale.price}`]
}

// "You" is plural in form, so a lone winner who is the viewer takes "win".
export function winVerb(winnerIds: readonly string[], myPlayerId: string | undefined): string {
    if (winnerIds.length > 1) {
        return 'share the win'
    }
    return winnerIds[0] === myPlayerId ? 'win' : 'wins'
}

export function describeAction(map: SarMap, action: GameAction): Description {
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
        const links = action.linkIds.map((linkId) => linkName(map, linkId)).join(' and ')
        const price = cost === 0 ? ' free' : ` for $${cost}`
        const opened = action.metadata?.opensRailroad
        const opening: Description = opened
            ? [
                  ` · ${map.settlement(map.home(opened)).name} reached: the `,
                  { railroadId: opened },
                  ' opens'
              ]
            : []
        return [`built ${links} for the `, { railroadId: action.railroadId }, price, ...opening]
    }
    if (isBuildConnection(action)) {
        const connection = map.externalConnection(action.connectionId)
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
        const name = map.settlement(action.settlementId).name
        const cost = action.metadata?.cost ? ` for $${action.metadata.cost}` : ''
        const income = action.metadata ? ` (now $${action.metadata.income})` : ''
        return [`developed ${name}${cost}${income}`]
    }
    if (isFinishDevelopment(action)) {
        const automatic = action.metadata?.automatic
        return automatic
            ? [
                  `declined a second development · ${map.settlement(automatic.settlementId).name} developed (now $${automatic.income})`
              ]
            : ['declined a second development']
    }
    if (isLeaveTown(action)) {
        const name = map.settlement(action.settlementId).name
        const automatic = action.metadata?.automatic
        const developed = automatic
            ? ` · ${map.settlement(automatic.settlementId).name} developed (now $${automatic.income})`
            : ''
        return [
            `left ${name}, taking a cube that pays $${LEAVE_TOWN_PAYOUT} a dividend${developed}`
        ]
    }
    if (isFoundSpecialConnection(action)) {
        const special = map.definition.specialConnection
        assertExists(special, 'This map has no special connection')
        const rates = action.metadata?.rates
            .map((rate) => `${map.railroad(rate.railroadId).shortName} $${rate.perShare}`)
            .join(', ')
        return [
            `founded the ${special.name} joining the `,
            { railroadId: action.railroadId },
            ' and the ',
            { railroadId: action.partnerId },
            rates ? ` · special dividend per share: ${rates}` : ''
        ]
    }
    if (isOfferShare(action)) {
        const minimum = action.metadata ? ` · minimum $${action.metadata.minimum}` : ''
        return action.ownShare
            ? ['offered a ', { railroadId: action.railroadId }, ` share for resale${minimum}`]
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
            .map((rate) => `${map.railroad(rate.railroadId).shortName} $${rate.perShare}`)
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
