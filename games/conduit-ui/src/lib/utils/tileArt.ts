import { assertExists } from '@tabletop/common'
import back from '$lib/images/tiles/back.webp'

const faces = import.meta.glob<string>('../images/tiles/tile-*.webp', {
    eager: true,
    import: 'default'
})

const faceUrls = new Map(
    Object.entries(faces).map(([path, url]) => [Number(/tile-(\d+)\.webp$/.exec(path)?.[1]), url])
)

export const TileBackUrl = back

export function tileFaceUrl(tileId: number): string {
    const url = faceUrls.get(tileId)
    assertExists(url, `No art for tile ${tileId}`)
    return url
}
