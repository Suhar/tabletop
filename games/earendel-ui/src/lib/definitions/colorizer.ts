import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { colorScheme } from '$lib/model/colorScheme.svelte.js'
import { boldPlayerFill } from '$lib/utils/planetColors.js'

// Class names are spelled out because Tailwind only generates classes written in the source.
export class EarendelGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        const bold = colorScheme.current === 'bold' ? boldPlayerFill(color) : undefined
        if (bold) return bold
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
        if (colorScheme.current === 'bold') {
            switch (color) {
                case Color.Red:
                    return 'bg-[#d62839]'
                case Color.Orange:
                    return 'bg-[#e2711d]'
                case Color.Yellow:
                    return 'bg-[#2a9d4b]'
                case Color.Pink:
                    return 'bg-[#9b4de0]'
                case Color.White:
                    return 'bg-[#2f6fed]'
            }
        }
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
        if (colorScheme.current === 'bold') {
            switch (color) {
                case Color.Red:
                    return 'border-[#d62839]'
                case Color.Orange:
                    return 'border-[#e2711d]'
                case Color.Yellow:
                    return 'border-[#2a9d4b]'
                case Color.Pink:
                    return 'border-[#9b4de0]'
                case Color.White:
                    return 'border-[#2f6fed]'
            }
        }
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
        if (colorScheme.current === 'bold') {
            // Every bold fill is deep enough for white words.
            if (!asPlayerColor) return 'text-white'
            switch (color) {
                case Color.Red:
                    return 'text-[#d62839]'
                case Color.Orange:
                    return 'text-[#e2711d]'
                case Color.Yellow:
                    return 'text-[#2a9d4b]'
                case Color.Pink:
                    return 'text-[#9b4de0]'
                case Color.White:
                    return 'text-[#2f6fed]'
            }
        }
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
        if (colorScheme.current === 'bold') return 'border-white'
        return color === Color.Red ? 'border-white' : 'border-black'
    }
}
