<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        SpotWidth,
        spotOrigin,
        SpotHeight,
        TrackCell,
        TileInSpot,
        TileOrigin,
        trackCellOrigin,
        centredTextShift
    } from '$lib/utils/tableLayout.js'
    import { tileFaceUrl } from '$lib/utils/tileArt.js'
    import { cubeShape, TrackCubeSize } from '$lib/utils/cubeShape.js'
    import { AuctionSpots, BasePrice, BidTrackSpaces } from '@tabletop/conduit'
    import Cube from './Cube.svelte'

    const gameSession = getGameSession()
    const market = $derived(gameSession.tableState.market)
    const offerSpot = $derived(gameSession.shownOffer?.spot)
    const placingSpot = $derived(gameSession.shownPlacement?.spot)
    const spots = Array.from({ length: AuctionSpots }, (_, index) => index + 1)
    const offerPrice = $derived(gameSession.shownOffer?.price)
    const cube = cubeShape(TrackCubeSize)
    const cubeInset = { x: TrackCell / 2, y: (TrackCell - cube.height) / 2 }
    const myColor = $derived(
        gameSession.myPlayer
            ? gameSession.colors.getPlayerBgColorValue(gameSession.myPlayer.id)
            : undefined
    )
    const columns = $derived(gameSession.auctionColumns)
    const tracks = Array.from({ length: BidTrackSpaces }, (_, index) => index)
    const tileCentre = { x: TileOrigin.x + TileInSpot / 2, y: TileOrigin.y + TileInSpot / 2 }

    function activate(event: KeyboardEvent, spot: number) {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        void gameSession.bid(spot)
    }
</script>

{#each spots as spot (spot)}
    {@const entry = market.find((candidate) => candidate.spot === spot)}
    {@const biddable = gameSession.biddableSpots.includes(spot)}
    {@const inPlay = entry !== undefined}
    <g
        class="spot"
        class:biddable
        class:unused={!inPlay}
        transform="translate({spotOrigin(spot, columns).x} {spotOrigin(spot, columns).y})"
    >
        <rect
            class="frame"
            class:offer={offerSpot === spot}
            class:placing={placingSpot === spot}
            x="0"
            y="0"
            width={SpotWidth}
            height={SpotHeight}
            rx="8"
        ></rect>
        <g transform="translate(8 8)">
            {#each tracks as index (index)}
                {@const origin = trackCellOrigin(index)}
                {@const bidder = entry?.bids[index]}
                <rect class="track" x={origin.x} y={origin.y} width={TrackCell} height={TrackCell}
                ></rect>
                {#if bidder}
                    {#if index === 0 && offerSpot === spot}
                        <rect
                            class="bottom"
                            x={origin.x + 1.5}
                            y={origin.y + 1.5}
                            width={TrackCell - 3}
                            height={TrackCell - 3}
                            rx="3"
                        ></rect>
                    {/if}
                    <g transform="translate({origin.x + cubeInset.x} {origin.y + cubeInset.y})">
                        <g data-bid="{spot}-{index}">
                            <Cube
                                size={TrackCubeSize}
                                color={gameSession.colors.getPlayerBgColorValue(bidder)}
                            />
                        </g>
                    </g>
                {:else if entry?.tileId !== undefined}
                    <text
                        class="space-price"
                        x={origin.x + TrackCell / 2}
                        y={origin.y + TrackCell / 2}
                        dy={centredTextShift(11)}
                        text-anchor="middle">${BasePrice + index + 1}</text
                    >
                    {#if biddable && index === entry.bids.length && myColor}
                        <g
                            class="ghost"
                            transform="translate({origin.x + cubeInset.x} {origin.y + cubeInset.y})"
                        >
                            <Cube size={TrackCubeSize} color={myColor} />
                        </g>
                    {/if}
                {/if}
            {/each}
            {#if entry?.tileId !== undefined && gameSession.tableAnimator.flyingTile?.spot !== spot}
                <g transform="translate({tileCentre.x} {tileCentre.y})">
                    <g data-market-tile={spot}>
                        <image
                            href={tileFaceUrl(entry.tileId)}
                            x={-TileInSpot / 2}
                            y={-TileInSpot / 2}
                            width={TileInSpot}
                            height={TileInSpot}
                        ></image>
                        {#if entry.buyerId}
                            <g transform="translate(0 {-cube.height / 2})">
                                <Cube
                                    size={TrackCubeSize + 4}
                                    color={gameSession.colors.getPlayerBgColorValue(entry.buyerId)}
                                />
                            </g>
                        {/if}
                    </g>
                </g>
            {/if}
            {#if offerSpot === spot && offerPrice !== undefined}
                <text
                    class="price"
                    x={tileCentre.x}
                    y={TileOrigin.y - 24}
                    dy={centredTextShift(20)}
                    text-anchor="middle">${offerPrice}</text
                >
            {/if}
        </g>
        <text class="number" x={SpotWidth - 10} y="18" dy={centredTextShift(14)} text-anchor="end"
            >{spot}</text
        >
        {#if biddable}
            <rect
                class="hit"
                width={SpotWidth}
                height={SpotHeight}
                rx="8"
                role="button"
                tabindex="0"
                aria-label="Bid on spot {spot}"
                onclick={() => gameSession.bid(spot)}
                onkeydown={(event) => activate(event, spot)}
            ></rect>
        {/if}
    </g>
{/each}

<style>
    .frame {
        fill: #18212d;
        stroke: #33445a;
        stroke-width: 1.5;
    }

    .frame.offer {
        stroke: #f5c542;
        stroke-width: 3;
    }

    .frame.placing {
        stroke: #57d3ff;
        stroke-width: 3;
    }

    .unused {
        opacity: 0.35;
    }

    .track {
        fill: #222e3d;
        stroke: #4a5d75;
        stroke-width: 1;
    }

    .space-price {
        font-size: 11px;
        font-weight: 700;
        fill: #5d6f86;
        pointer-events: none;
    }

    .bottom {
        fill: none;
        stroke: #f5c542;
        stroke-width: 3;
    }

    .ghost {
        opacity: 0;
    }

    .biddable {
        cursor: pointer;
    }

    .biddable .frame {
        stroke: #57d3ff;
        stroke-width: 2.5;
    }

    .hit {
        fill: transparent;
        outline: none;
    }

    .biddable:hover .ghost,
    .biddable:has(.hit:focus-visible) .ghost {
        opacity: 0.55;
    }

    .biddable:hover .frame {
        fill: #222e3d;
    }

    .biddable:has(.hit:focus-visible) .frame {
        stroke: #f5c542;
    }

    .price {
        font-size: 20px;
        font-weight: 800;
        fill: #f5c542;
    }

    .number {
        font-size: 14px;
        font-weight: 700;
        fill: #93a4b8;
    }
</style>
