<script lang="ts">
    import { HexKind, type PlanetColor } from '@tabletop/earendel'
    import { hexGeometry, insetPoints, verticesToPoints } from '$lib/utils/hexDefinition.js'
    import { PLANET_SHAPE } from '$lib/utils/planetColors.js'
    import PlanetTile from './PlanetTile.svelte'

    let {
        color,
        copy,
        height = 30
    }: {
        color: PlanetColor
        // Keeps this badge's clip path id apart from the board's tiles and other badges.
        copy: string
        height?: number
    } = $props()

    const origin = { q: 0, r: 0 }
    const geometry = hexGeometry(origin)
    const box = geometry.boundingBox
    const points = verticesToPoints(geometry)
    const inset = insetPoints(origin, 2.5)
</script>

<svg
    viewBox="{box.x} {box.y} {box.width} {box.height}"
    {height}
    width={(height * box.width) / box.height}
    aria-label={PLANET_SHAPE[color]}
    role="img"
>
    <PlanetTile
        hex={{ coords: origin, tileId: 'badge', kind: HexKind.Planet, color, explored: true }}
        center={geometry.center}
        {points}
        {inset}
        copy="-badge-{copy}"
    />
</svg>
