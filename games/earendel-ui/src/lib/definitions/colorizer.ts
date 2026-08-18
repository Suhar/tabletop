import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class EarendelGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return '#539ad1'
            case Color.Red:
                return '#e55649'
            case Color.Yellow:
                return '#f3c244'
            case Color.Green:
                return '#63b878'
            case Color.Purple:
                return '#804796'
            // A light grey rather than a dark one. The fifth player used to be near-black, which
            // on a starfield read as a hole in the board rather than as somebody's ships - and its
            // control lines and score pills were almost unreadable.
            //
            // Both slots get it: the colour list now hands out Gray, but a game already in
            // progress has Black stored against a player, and that player should not be left
            // invisible for the rest of it.
            case Color.Gray:
                return '#c9d2e2'
            case Color.Black:
                return '#c9d2e2'
            default:
                return '#555555'
        }
    }

    override getBgColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return 'bg-[#539ad1]'
            case Color.Red:
                return 'bg-[#e55649]'
            case Color.Yellow:
                return 'bg-[#f3c244]'
            case Color.Green:
                return 'bg-[#63b878]'
            case Color.Purple:
                return 'bg-[#804796]'
            case Color.Gray:
                return 'bg-[#c9d2e2]'
            case Color.Black:
                return 'bg-[#c9d2e2]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return 'border-[#539ad1]'
            case Color.Red:
                return 'border-[#e55649]'
            case Color.Yellow:
                return 'border-[#f3c244]'
            case Color.Green:
                return 'border-[#63b878]'
            case Color.Purple:
                return 'border-[#804796]'
            case Color.Gray:
                return 'border-[#c9d2e2]'
            case Color.Black:
                return 'border-[#c9d2e2]'
            default:
                return 'border-[#555555]'
        }
    }
}
