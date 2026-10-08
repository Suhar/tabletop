export enum ActionBox {
    ConstructTrack = 'ConstructTrack',
    OfferStock = 'OfferStock',
    DevelopSettlements = 'DevelopSettlements',
    PayDividends = 'PayDividends'
}

export const ACTION_BOXES: readonly ActionBox[] = [
    ActionBox.PayDividends,
    ActionBox.DevelopSettlements,
    ActionBox.OfferStock,
    ActionBox.ConstructTrack
]

export const ACTION_TRACK_ADVANCE: Record<ActionBox, number> = {
    [ActionBox.ConstructTrack]: 3,
    [ActionBox.OfferStock]: 4,
    [ActionBox.DevelopSettlements]: 5,
    [ActionBox.PayDividends]: 0
}

export const ACTION_TRACK_LIMIT = 35

// The redrawn board marks the third Offer Stock slot "4p, 5p"; the rulebook text limits only
// the three-player game. The board is followed so every slot drawn on it is honoured.
const OFFER_STOCK_SLOTS: Record<number, number> = { 3: 2, 4: 3, 5: 3, 6: 2 }

export function boxCapacity(box: ActionBox, playerCount: number): number {
    switch (box) {
        case ActionBox.ConstructTrack:
            return playerCount
        case ActionBox.OfferStock:
            return OFFER_STOCK_SLOTS[playerCount] ?? 3
        case ActionBox.DevelopSettlements:
            return 2
        case ActionBox.PayDividends:
            return 1
    }
}
