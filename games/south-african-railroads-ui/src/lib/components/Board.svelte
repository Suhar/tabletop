<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import ExternalLayer from './board/ExternalLayer.svelte'
    import FinalPayoffPanel from './board/FinalPayoffPanel.svelte'
    import Legend from './board/Legend.svelte'
    import Logo from './board/Logo.svelte'
    import MapBackground from './board/MapBackground.svelte'
    import ScoreTracks from './board/ScoreTracks.svelte'
    import SettlementLayer from './board/SettlementLayer.svelte'
    import TrackLayer from './board/TrackLayer.svelte'

    const gameSession = getGameSession()

    const layout = $derived(boardLayout(gameSession.gameState.mapId))
</script>

<svg
    class="board"
    width={layout.width}
    height={layout.height}
    viewBox="0 {layout.top} {layout.width} {layout.height}"
    role="img"
    aria-label="Map of the {gameSession.gameState.map.definition.name} railroads"
>
    <MapBackground />
    <Logo />
    <Legend />
    <FinalPayoffPanel />
    <ScoreTracks />
    <ExternalLayer />
    <TrackLayer />
    <SettlementLayer />
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
