<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CellSize } from '$lib/utils/boardLayout.js'
    import { tableGeometry } from '$lib/utils/tableLayout.js'
    import { cubeShape, pileOffsets, PileCubeSize } from '$lib/utils/cubeShape.js'
    import AuctionBoard from './AuctionBoard.svelte'
    import Cube from './Cube.svelte'
    import GridBoard from './GridBoard.svelte'
    import TileArtDefs from './TileArtDefs.svelte'
    import TileImage from './TileImage.svelte'

    const gameSession = getGameSession()
    const geometry = $derived(
        tableGeometry(
            gameSession.tableState.board,
            gameSession.auctionColumns,
            gameSession.tableBeside
        )
    )
    const flying = $derived(gameSession.tableAnimator.flyingTile)
    const pile = cubeShape(PileCubeSize)
</script>

<svg
    class="board"
    viewBox="0 0 {geometry.width} {geometry.height}"
    width={geometry.width}
    height={geometry.height}
    role="img"
    aria-label="Table"
    {@attach gameSession.tableAnimator.attach}
    {@attach gameSession.routeAnimator.attach}
>
    <TileArtDefs />
    <g
        transform="translate({geometry.auction.x} {geometry.auction
            .y}) scale({geometry.auctionScale})"
    >
        <AuctionBoard />
    </g>
    <g transform="translate({geometry.grid.x} {geometry.grid.y})">
        <GridBoard />
    </g>
    {#if flying}
        <g data-flying-tile>
            <g data-flying-turn>
                <TileImage tileId={flying.faceUp ? flying.tileId : undefined} size={CellSize} />
            </g>
            {#if flying.ownerId}
                {@const color = gameSession.colors.getPlayerBgColorValue(flying.ownerId)}
                <g transform="translate({4 + PileCubeSize / 2} {4 + pile.rise})">
                    {#each pileOffsets(flying.cubes, PileCubeSize) as offset, index (index)}
                        <g transform="translate({offset.x} {offset.y})">
                            <g data-flying-cube={index}>
                                <Cube size={PileCubeSize} {color} />
                            </g>
                        </g>
                    {/each}
                </g>
            {/if}
        </g>
    {/if}
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
