<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { trussPaths } from '$lib/utils/stationGeometry.js'

    let { start, end, color }: { start: Point; end: Point; color: string } = $props()

    let paths = $derived(trussPaths(start, end))
</script>

<path d={paths.rails} fill="none" stroke={color} stroke-width="2.5" pointer-events="none" />
<path
    d={paths.lacing}
    fill="none"
    stroke={color}
    stroke-width="1.5"
    stroke-opacity="0.8"
    stroke-linejoin="round"
    pointer-events="none"
/>
