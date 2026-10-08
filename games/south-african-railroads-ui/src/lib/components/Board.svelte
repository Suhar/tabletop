<script lang="ts">
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/utils/boardLayout.js'
    import ActionBoxes from './board/ActionBoxes.svelte'
    import ExternalLayer from './board/ExternalLayer.svelte'
    import Legend from './board/Legend.svelte'
    import MapBackground from './board/MapBackground.svelte'
    import RailroadCards from './board/RailroadCards.svelte'
    import ScoreTracks from './board/ScoreTracks.svelte'
    import SettlementLayer from './board/SettlementLayer.svelte'
    import TrackLayer from './board/TrackLayer.svelte'
</script>

<svg
    class="board"
    width={BOARD_WIDTH}
    height={BOARD_HEIGHT}
    viewBox="0 0 {BOARD_WIDTH} {BOARD_HEIGHT}"
    role="img"
    aria-label="Map of the South African railroads"
>
    <MapBackground />
    <Legend />
    <ScoreTracks />
    <ActionBoxes />
    <ExternalLayer />
    <TrackLayer />
    <SettlementLayer />
    <RailroadCards />
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
