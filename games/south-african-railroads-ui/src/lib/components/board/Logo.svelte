<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LOGO_SIZE, boardLayout } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const layout = $derived(boardLayout(gameSession.gameState.mapId))
    const origin = $derived(layout.spec.logo)

    // Two rails over ties, as wide as the title, as on a timetable heading.
    const TRACK_WIDTH = LOGO_SIZE.width - 40
    const TRACK_Y = 8
    const TIE_STEP = 6
    const TIES = Array.from(
        { length: Math.floor(TRACK_WIDTH / TIE_STEP) + 1 },
        (_, index) => -TRACK_WIDTH / 2 + index * TIE_STEP
    )
</script>

<g transform="translate({origin.x} {origin.y})" role="img" aria-label="South African Railroads">
    <text y="0" class="title">South African Railroads</text>
    {#each TIES as x (x)}
        <rect {x} y={TRACK_Y - 1} width="2" height="8" class="tie" />
    {/each}
    <line x1={-TRACK_WIDTH / 2} x2={TRACK_WIDTH / 2} y1={TRACK_Y + 1} y2={TRACK_Y + 1} class="rail" />
    <line x1={-TRACK_WIDTH / 2} x2={TRACK_WIDTH / 2} y1={TRACK_Y + 5} y2={TRACK_Y + 5} class="rail" />
    <text y="28" class="credit">{layout.spec.credit}</text>
</g>

<style>
    .title {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 0.02em;
        fill: #3b2410;
        text-anchor: middle;
        paint-order: stroke;
        stroke: #f6eed7;
        stroke-width: 4px;
    }

    .tie {
        fill: #8a6a42;
    }

    .rail {
        stroke: #3b2410;
        stroke-width: 1.6;
    }

    .credit {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 9.5px;
        font-style: italic;
        fill: #7a5a32;
        text-anchor: middle;
    }
</style>
