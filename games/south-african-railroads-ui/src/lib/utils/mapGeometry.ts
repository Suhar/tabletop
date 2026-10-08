import { link, settlement } from '@tabletop/south-african-railroads'

// A link runs from one settlement through its building box to the other, as printed.
export function linkPath(linkId: string): string {
    const trackLink = link(linkId)
    const [a, b] = trackLink.ends.map((id) => settlement(id))
    return `M${a.x} ${a.y} L${trackLink.box.x} ${trackLink.box.y} L${b.x} ${b.y}`
}
