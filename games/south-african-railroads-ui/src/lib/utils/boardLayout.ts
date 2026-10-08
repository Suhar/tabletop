import { ActionBox } from '@tabletop/south-african-railroads'

export const BOARD_WIDTH = 1584
export const BOARD_HEIGHT = 1224

export type Rect = { x: number; y: number; width: number; height: number }

export const ACTION_BOX_RECTS: Record<ActionBox, Rect> = {
    [ActionBox.PayDividends]: { x: 616, y: 18, width: 214, height: 128 },
    [ActionBox.DevelopSettlements]: { x: 842, y: 18, width: 226, height: 128 },
    [ActionBox.OfferStock]: { x: 1080, y: 18, width: 214, height: 128 },
    [ActionBox.ConstructTrack]: { x: 1306, y: 18, width: 260, height: 128 }
}

export const ACTION_TRACK_ORIGIN = { x: 1062, y: 176 }
export const ACTION_TRACK_CELL = 24

export const DIVIDEND_TRACK_ORIGIN = { x: 214, y: 166 }
export const DIVIDEND_TRACK_CELL = 52

export const RAILROAD_CARD_Y = 1108
export const RAILROAD_CARD_HEIGHT = 104
export const RAILROAD_CARD_WIDTH = 240
export const RAILROAD_CARD_GAP = 16
export const RAILROAD_CARD_X = 28

// Johannesburg's and Bloemfontein's development boxes, row by row, lowest income first.
export const METRO_GRIDS: Record<string, { columns: number; origin: { x: number; y: number } }> = {
    johannesburg: { columns: 3, origin: { x: 869.5, y: 506.5 } },
    bloemfontein: { columns: 2, origin: { x: 322.5, y: 723.5 } }
}
export const METRO_CELL = 27
