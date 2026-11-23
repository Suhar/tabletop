import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

// Class names are spelled out because Tailwind only generates classes written in the source.
export class EarendelGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.Red:
                return '#de3b45'
            case Color.Orange:
                return '#e68203'
            case Color.Yellow:
                return '#dfc400'
            case Color.Pink:
                return '#fba0b7'
            case Color.White:
                return '#eef2f8'
            default:
                return '#555555'
        }
    }

    override getBgColor(color?: string): string {
        switch (color) {
            case Color.Red:
                return 'bg-[#de3b45]'
            case Color.Orange:
                return 'bg-[#e68203]'
            case Color.Yellow:
                return 'bg-[#dfc400]'
            case Color.Pink:
                return 'bg-[#fba0b7]'
            case Color.White:
                return 'bg-[#eef2f8]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: string): string {
        switch (color) {
            case Color.Red:
                return 'border-[#de3b45]'
            case Color.Orange:
                return 'border-[#e68203]'
            case Color.Yellow:
                return 'border-[#dfc400]'
            case Color.Pink:
                return 'border-[#fba0b7]'
            case Color.White:
                return 'border-[#eef2f8]'
            default:
                return 'border-[#555555]'
        }
    }

    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (!asPlayerColor) return color === Color.Red ? 'text-white' : 'text-black'
        switch (color) {
            case Color.Red:
                return 'text-[#de3b45]'
            case Color.Orange:
                return 'text-[#e68203]'
            case Color.Yellow:
                return 'text-[#dfc400]'
            case Color.Pink:
                return 'text-[#fba0b7]'
            case Color.White:
                return 'text-[#eef2f8]'
            default:
                return 'text-[#555555]'
        }
    }

    override getBorderContrastColor(color?: Color): string {
        return color === Color.Red ? 'border-white' : 'border-black'
    }
}
