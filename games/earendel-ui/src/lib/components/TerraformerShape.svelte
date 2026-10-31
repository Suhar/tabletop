<script lang="ts">
    import type { Point } from '@tabletop/common'

    let { center, color }: { center: Point; color: string } = $props()
</script>

<!-- A ring around a little landscape: two peaks over a rolling line of ground. -->
<g transform="translate({center.x} {center.y})">
    <circle r="17" fill={color} fill-opacity="0.22" stroke={color} stroke-width="2.5" />
    <path d="M-10,4 L-3,-8 L1,-2 L5,-7 L11,4 Z" fill={color} />
    <path
        d="M-11,9 Q-5.5,5.5 0,9 T11,9"
        fill="none"
        stroke={color}
        stroke-width="2.2"
        stroke-linecap="round"
    />
</g>
