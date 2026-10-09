export const BOARD_WIDTH = 1584
// The redrawn board's top band and bottom card strip are cropped away; the map keeps its
// original coordinates.
export const BOARD_TOP = 128
export const BOARD_HEIGHT = 1124 - BOARD_TOP

export const ACTION_TRACK_ORIGIN = { x: 1062, y: 176 }
export const ACTION_TRACK_CELL = 24

export const DIVIDEND_TRACK_ORIGIN = { x: 214, y: 166 }
export const DIVIDEND_TRACK_CELL = 52

// Johannesburg's and Bloemfontein's development boxes, row by row, lowest income first.
export const METRO_GRIDS: Record<string, { columns: number; origin: { x: number; y: number } }> = {
    johannesburg: { columns: 3, origin: { x: 869.5, y: 506.5 } },
    bloemfontein: { columns: 2, origin: { x: 322.5, y: 723.5 } }
}
export const METRO_CELL = 27
