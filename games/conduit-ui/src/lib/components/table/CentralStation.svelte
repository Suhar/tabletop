<script lang="ts">
    import { CellSize } from '$lib/utils/boardLayout.js'
    import { CautionStripesId } from '$lib/utils/tileArt.js'

    let { x, y }: { x: number; y: number } = $props()
    const middle = CellSize / 2
</script>

<g transform="translate({x} {y})">
    <rect class="body" x="4" y="4" width={CellSize - 8} height={CellSize - 8} rx="10"></rect>
    {#each [0, 90, 180, 270] as angle (angle)}
        <g transform="rotate({angle} {middle} {middle})">
            <rect class="conduit" x={middle - 6} y="4" width="12" height="20"></rect>
            <rect
                class="block"
                x={middle - 14}
                y="4"
                width="28"
                height="6"
                rx="2"
                fill="url(#{CautionStripesId})"
            ></rect>
        </g>
    {/each}
    <circle class="core" cx={middle} cy={middle} r="22"></circle>
    <path
        class="power"
        d="M {middle - 7.8} {middle - 6.2} A 10 10 0 1 0 {middle + 7.8} {middle -
            6.2} M {middle} {middle - 13} V {middle + 1}"
    ></path>
</g>

<style>
    .body {
        fill: #0b1d38;
        stroke: #49d6ff;
        stroke-width: 2;
    }

    .conduit {
        fill: #8c96a3;
    }

    .core {
        fill: #10161f;
        stroke: #8c96a3;
        stroke-width: 2;
    }

    .power {
        fill: none;
        stroke: #f5c542;
        stroke-width: 3;
        stroke-linecap: round;
    }
</style>
