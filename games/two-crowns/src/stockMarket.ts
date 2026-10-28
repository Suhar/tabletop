import { createRectangularStockMarketSpaces, StockMarketChart } from '@tabletop/18xx'
import { TwoCrownsMarketRows } from './generated/data.js'

const StartRowColors: Readonly<Record<number, string>> = {
    3: 'yellow',
    4: 'green',
    5: 'blue',
    6: 'red'
}

export const TwoCrownsMarket = new StockMarketChart(
    createRectangularStockMarketSpaces(TwoCrownsMarketRows, (row, column) => {
        if (row === 0 && column === TwoCrownsMarketRows[0].length - 1) return 'orange'
        return column === 1 ? (StartRowColors[row] ?? 'white') : 'white'
    })
)
