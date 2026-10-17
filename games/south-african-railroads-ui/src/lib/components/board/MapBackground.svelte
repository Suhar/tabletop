<script lang="ts">
    import type { Component } from 'svelte'
    import { MapId } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import SouthAfricaTerrain from './terrain/SouthAfricaTerrain.svelte'
    import TexasSpecialTerrain from './terrain/TexasSpecialTerrain.svelte'

    const TERRAIN: Record<MapId, Component> = {
        [MapId.SouthAfrica]: SouthAfricaTerrain,
        [MapId.TexasSpecial]: TexasSpecialTerrain
    }

    const gameSession = getGameSession()

    const mapId = $derived(gameSession.gameState.mapId)
    const layout = $derived(boardLayout(mapId))
    const Terrain = $derived(TERRAIN[mapId])
</script>

<defs>
    <radialGradient id="sar-paper" cx="50%" cy="46%" r="75%">
        <stop offset="0%" stop-color="#f6eed7" />
        <stop offset="70%" stop-color="#eadcb8" />
        <stop offset="100%" stop-color="#d6c296" />
    </radialGradient>
    <clipPath id="sar-inner">
        <rect
            x="15"
            y={layout.top + 15}
            width={layout.width - 30}
            height={layout.height - 30}
            rx="10"
        />
    </clipPath>
</defs>

<rect y={layout.top} width={layout.width} height={layout.height} rx="18" fill="url(#sar-paper)" />
<g clip-path="url(#sar-inner)">
    <Terrain />
</g>
<rect
    x="8"
    y={layout.top + 8}
    width={layout.width - 16}
    height={layout.height - 16}
    rx="14"
    fill="none"
    stroke="#7a5a32"
    stroke-width="3"
/>
<rect
    x="15"
    y={layout.top + 15}
    width={layout.width - 30}
    height={layout.height - 30}
    rx="10"
    fill="none"
    stroke="#a8875a"
    stroke-width="1"
/>

{#each layout.spec.regions as region (region.lines.join(' '))}
    <text
        class="region"
        x={region.x}
        y={region.y}
        transform={region.rotate ? `rotate(${region.rotate} ${region.x} ${region.y})` : undefined}
    >
        {#each region.lines as line, index (line)}
            <tspan x={region.x} dy={index === 0 ? 0 : 19}>{line}</tspan>
        {/each}
    </text>
{/each}

<style>
    .region {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        letter-spacing: 0.32em;
        fill: #9a8461;
        text-anchor: middle;
        pointer-events: none;
    }
</style>
