<script lang="ts">
    import type { Point } from '@tabletop/common'

    // A probe drawn as a satellite: a round hub with solar wings, one wing per technology card it
    // reveals. A level 2 probe has a straight pair; a level 3 has three spread evenly into a star,
    // one up and two angled down. The two levels are different silhouettes - a bar and a star - so
    // the level reads from the shape alone, without a numeral or any counting.
    let { center, color, level }: { center: Point; color: string; level: number } = $props()

    // Degrees, clockwise from pointing right. The star's wings each point at the middle of a hex
    // side, every other side, so it fills its hex evenly.
    let angles = $derived(level >= 3 ? [-90, 30, 150] : [0, 180])

    // Each wing, drawn along +x and rotated into place: a strut out from the hub, then a panel
    // split into two cells.
    const STRUT_FROM = 7
    const PANEL_FROM = 10
    const PANEL_LENGTH = 15
    const PANEL_WIDTH = 11
</script>

<g transform="translate({center.x} {center.y})">
    {#each angles as angle (angle)}
        <g transform="rotate({angle})">
            <line
                x1={STRUT_FROM}
                y1="0"
                x2={PANEL_FROM + PANEL_LENGTH}
                y2="0"
                stroke={color}
                stroke-width="2"
            />
            <rect
                x={PANEL_FROM}
                y={-PANEL_WIDTH / 2}
                width={PANEL_LENGTH}
                height={PANEL_WIDTH}
                rx="1.5"
                fill={color}
                fill-opacity="0.32"
                stroke={color}
                stroke-width="1.4"
            />
            <line
                x1={PANEL_FROM + PANEL_LENGTH / 2}
                y1={-PANEL_WIDTH / 2}
                x2={PANEL_FROM + PANEL_LENGTH / 2}
                y2={PANEL_WIDTH / 2}
                stroke={color}
                stroke-width="0.9"
            />
        </g>
    {/each}
    <circle r="8.5" fill={color} />
    <circle r="3" fill="#0b1222" fill-opacity="0.55" />
</g>
