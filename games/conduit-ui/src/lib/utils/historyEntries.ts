import type { GameAction } from '@tabletop/common'
import {
    isBuyTile,
    isChooseRoute,
    isFillMarket,
    isLoseInfrastructure,
    isPassBid,
    isPassTile,
    isPayRevenue,
    isPlaceBid,
    isPlaceTile,
    Rounds,
    stationTile,
    type StationRevenue
} from '@tabletop/conduit'

export type HistoryDivider = { kind: 'divider'; key: string; label: string }

export type HistoryEntry = {
    kind: 'entry'
    key: string
    title: string
    playerId?: string
    lines: string[]
    // The last action's index in the game, for jumping to the table as that action left it.
    lastIndex: number
}

export type HistoryItem = HistoryDivider | HistoryEntry

type Name = (playerId: string) => string

const tileName = (tileId: number) => `${stationTile(tileId).letter} tile`
const dollars = (amount: number) => `$${amount}`
const cubes = (count: number) => `${count} cube${count === 1 ? '' : 's'}`

// Describes one action from its input and metadata alone.
export function describeAction(action: GameAction, name: Name): string | undefined {
    const who = action.playerId ? name(action.playerId) : ''
    if (isPlaceBid(action)) {
        return `${who} bid on spot ${action.slot + 1}`
    }
    if (isPassBid(action)) {
        return `${who} passed`
    }
    if (isBuyTile(action) && action.metadata) {
        const paid = action.metadata.payments
            .map((payment) => `${name(payment.playerId)} ${dollars(payment.amount)}`)
            .join(', ')
        return `${who} bought the ${tileName(action.metadata.tileId)} for ${dollars(action.metadata.price)}${paid ? ` (paid ${paid})` : ''}`
    }
    if (isPassTile(action) && action.metadata) {
        return `${who} passed on the ${tileName(action.metadata.tileId)}, taking $1 and ${cubes(action.metadata.cubes)} back`
    }
    if (isPlaceTile(action) && action.metadata) {
        const paid = action.metadata.extraPrice
        return action.metadata.faceUp
            ? `${who} placed it with ${cubes(1 + action.extraCubes)}${paid ? ` (paid ${dollars(paid)})` : ''}`
            : `${who} placed the ${tileName(action.metadata.tileId)} face down`
    }
    if (isChooseRoute(action) && action.metadata) {
        const paid = new Map<string, number>()
        for (const playerId of action.metadata.tolls)
            paid.set(playerId, (paid.get(playerId) ?? 0) + 1)
        const to = [...paid].map(([playerId, amount]) => `${name(playerId)} ${dollars(amount)}`)
        return `${who} chose the route from the ${stationTile(action.tileId).letter} station paying ${to.length > 0 ? to.join(', ') : 'no toll'}`
    }
    if (isFillMarket(action) && action.metadata) {
        return `Market: ${action.metadata.tileIds.map((tileId) => stationTile(tileId).letter).join(' ')}`
    }
    if (isPayRevenue(action) && action.metadata) {
        const totals = new Map<string, number>()
        const add = (playerId: string, amount: number) =>
            totals.set(playerId, (totals.get(playerId) ?? 0) + amount)
        for (const revenue of action.metadata.revenues) {
            add(revenue.playerId, revenue.amount)
            for (const toll of revenue.tolls ?? []) add(toll.playerId, toll.amount)
        }
        return totals.size === 0
            ? 'No stations earned'
            : [...totals.entries()]
                  .map(([playerId, amount]) => `${name(playerId)} ${dollars(amount)}`)
                  .join(' · ')
    }
    if (isLoseInfrastructure(action) && action.metadata) {
        const flipped = action.metadata.flippedTileIds.length
        return flipped === 0
            ? 'No stations went dark'
            : `${flipped} station${flipped === 1 ? '' : 's'} went dark`
    }
    return undefined
}

function revenueLines(revenues: StationRevenue[], name: Name): string[] {
    if (revenues.length === 0) {
        return ['No stations earned']
    }
    return revenues.map((revenue) => {
        const line = `${name(revenue.playerId)}'s ${tileName(revenue.tileId)}: ${revenue.amount > 0 ? dollars(revenue.amount) : 'no route'}`
        const tolls = new Map<string, number>()
        for (const toll of revenue.tolls ?? []) {
            tolls.set(toll.playerId, (tolls.get(toll.playerId) ?? 0) + toll.amount)
        }
        return tolls.size === 0
            ? line
            : `${line}, tolls ${[...tolls].map(([playerId, amount]) => `${name(playerId)} ${dollars(amount)}`).join(', ')}`
    })
}

function tileOf(action: GameAction): number | undefined {
    if ((isBuyTile(action) || isPassTile(action) || isPlaceTile(action)) && action.metadata) {
        return action.metadata.tileId
    }
    return undefined
}

// Groups the actions into history entries: a round's market, its bidding, each tile's offers and
// placement, revenue and infrastructure loss, with a divider at each round and the final payouts.
export function historyItems(actions: readonly GameAction[], name: Name): HistoryItem[] {
    const items: HistoryItem[] = [{ kind: 'divider', key: 'round-1', label: 'Round 1' }]
    let open: HistoryEntry | undefined
    let groupKey: string | undefined
    let round = 1

    const close = () => {
        open = undefined
        groupKey = undefined
    }

    actions.forEach((action, index) => {
        const line = describeAction(action, name)
        if (line === undefined) {
            return
        }
        const lines =
            isPayRevenue(action) && action.metadata
                ? revenueLines(action.metadata.revenues, name)
                : [line]
        if (isFillMarket(action) && action.metadata) {
            close()
            round = action.metadata.round
            items.push({ kind: 'divider', key: `round-${round}`, label: `Round ${round}` })
        }
        const tileId = tileOf(action)
        const isBidding = isPlaceBid(action) || isPassBid(action)
        const key = isBidding
            ? 'bidding'
            : isChooseRoute(action)
              ? 'route-choices'
              : tileId !== undefined
                ? `tile-${tileId}`
                : `${action.type}-${index}`
        const actionIndex = action.index ?? index
        if (open && groupKey === key) {
            open.lines.push(...lines)
            open.lastIndex = actionIndex
            return
        }
        const title = isBidding
            ? 'Bidding'
            : isChooseRoute(action)
              ? 'Route choice'
              : tileId !== undefined
                ? `The ${tileName(tileId)}`
                : isFillMarket(action)
                  ? 'New market'
                  : isPayRevenue(action)
                    ? 'Revenue'
                    : 'Infrastructure loss'
        open = { kind: 'entry', key: action.id, title, lines, lastIndex: actionIndex }
        groupKey = key
        items.push(open)
        if (isLoseInfrastructure(action) && action.metadata?.roundEnded && round === Rounds) {
            close()
            items.push({ kind: 'divider', key: 'final-payouts', label: 'Final payouts' })
        }
    })
    return items
}
