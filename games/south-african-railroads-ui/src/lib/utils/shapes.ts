import type { Point } from '@tabletop/common'

export function polygonPoints(sides: number, radius: number, rotation = -90, center?: Point) {
    const cx = center?.x ?? 0
    const cy = center?.y ?? 0
    return Array.from({ length: sides }, (_, index) => {
        const angle = ((rotation + (360 / sides) * index) * Math.PI) / 180
        return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`
    }).join(' ')
}

export function starPoints(points: number, outer: number, inner: number) {
    return Array.from({ length: points * 2 }, (_, index) => {
        const radius = index % 2 === 0 ? outer : inner
        const angle = ((-90 + (180 / points) * index) * Math.PI) / 180
        return `${(radius * Math.cos(angle)).toFixed(1)},${(radius * Math.sin(angle)).toFixed(1)}`
    }).join(' ')
}
