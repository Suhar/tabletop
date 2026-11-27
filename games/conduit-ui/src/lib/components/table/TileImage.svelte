<script lang="ts">
    import { SidesClockwise, stationTile } from '@tabletop/conduit'
    import {
        TerminalOutlineWidth,
        TerminalRadius,
        TerminalStyles,
        TileArtCentre,
        TileArtSize,
        TileBoardId,
        emblemId,
        terminalCentre
    } from '$lib/utils/tileArt.js'

    let {
        tileId,
        x = 0,
        y = 0,
        size
    }: { tileId?: number; x?: number; y?: number; size: number } = $props()

    const tile = $derived(tileId === undefined ? undefined : stationTile(tileId))
</script>

<svg {x} {y} width={size} height={size} viewBox="0 0 {TileArtSize} {TileArtSize}" overflow="hidden">
    <use href="#{TileBoardId}"></use>
    {#if tile}
        {#each SidesClockwise as side (side)}
            {@const centre = terminalCentre(side)}
            {@const style = TerminalStyles[tile.terminals[side]]}
            <circle
                cx={centre.x}
                cy={centre.y}
                r={TerminalRadius}
                fill={style.fill}
                stroke={style.outline}
                stroke-width={style.outline ? TerminalOutlineWidth : undefined}
            ></circle>
        {/each}
        <use href="#{emblemId(tile.letter)}" x={TileArtCentre} y={TileArtCentre}></use>
    {/if}
</svg>
