<script lang="ts">
    import { sameCoordinates, type OffsetCoordinates } from '@tabletop/common'
    import {
        CentralCell,
        neighborCell,
        Side,
        stationTile,
        type PlacedStation
    } from '@tabletop/conduit'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        boardSize,
        CellSize,
        cellElementId,
        cellKey,
        cellOrigin
    } from '$lib/utils/boardLayout.js'
    import { emblemRing, RingStroke } from '$lib/utils/emblem.js'
    import { centredShift, OcrFace, textWidth } from '$lib/utils/textMetrics.js'
    import { BoardGroundId, CautionStripesId } from '$lib/utils/tileArt.js'
    import CentralStation from './CentralStation.svelte'
    import CubePile from './CubePile.svelte'
    import RouteFlow from './RouteFlow.svelte'
    import RouteShows from './RouteShows.svelte'
    import TileImage from './TileImage.svelte'

    const gameSession = getGameSession()
    const bounds = $derived(gameSession.bounds)
    const size = $derived(boardSize(bounds))
    const stations = $derived(gameSession.tableState.board.stations)
    const centre = $derived(cellOrigin(CentralCell, bounds))
    const half = CellSize / 2
    const flipped = $derived(gameSession.tableAnimator.flipped)

    function centreOf(cell: OffsetCoordinates) {
        const origin = cellOrigin(cell, bounds)
        return { x: origin.x + half, y: origin.y + half }
    }

    // The Central Station draws its own blocked ends.
    const sticks = $derived(
        gameSession.closedConnections.filter(
            (closed) =>
                !sameCoordinates(closed.cell, CentralCell) &&
                !sameCoordinates(neighborCell(closed.cell, closed.side), CentralCell)
        )
    )

    const choice = $derived(gameSession.isViewingHistory ? undefined : gameSession.shownRouteChoice)
    const focusedBonuses = $derived.by(() => {
        const option =
            choice && gameSession.focusedOption !== undefined
                ? choice.options[gameSession.focusedOption]
                : undefined
        if (!choice || !option) return []
        return option.cells.slice(1).flatMap((cell) => {
            const passed = gameSession.grid.stationAt(cell)
            return passed?.ownerId !== undefined &&
                passed.ownerId !== choice.playerId &&
                passed.faceUp &&
                passed.cubes > 0
                ? [{ cell, color: gameSession.colors.getPlayerBgColorValue(passed.ownerId) }]
                : []
        })
    })

    // One route, or the equally good routes from one station: everything else dims.
    const focusRoutes = $derived(
        gameSession.shownRoutes.length === 1 ||
            gameSession.shownRoutes.every((route) => route.branch)
            ? gameSession.shownRoutes
            : []
    )
    const offRoute = $derived(
        focusRoutes.length > 0
            ? stations.filter(
                  (station) =>
                      !focusRoutes.some((route) =>
                          route.cells.some((cell) => sameCoordinates(cell, station.cell))
                      )
              )
            : []
    )

    // Equally good routes are drawn as alternatives: each starts clear of the station, so two never
    // read as one route passing through it, and each ends at its own ringed destination.
    const branches = $derived(gameSession.shownRoutes.filter((route) => route.branch))
    // Moving dashes cost phone memory, so only a few alternatives flow; they are short and close.
    const MaxFlowingBranches = 3
    const BadgeFont = 15
    const BranchStartGap = 34

    function routeLine(cells: OffsetCoordinates[], branch: boolean) {
        const line = cells.map(centreOf)
        if (!branch) return line
        const [start, next] = line
        const length = Math.hypot(next.x - start.x, next.y - start.y)
        const gap = Math.min(BranchStartGap, length / 2)
        return [
            {
                x: start.x + ((next.x - start.x) * gap) / length,
                y: start.y + ((next.y - start.y) * gap) / length
            },
            ...line.slice(1)
        ]
    }

    function ringAt(cell: OffsetCoordinates) {
        const station = gameSession.grid.stationAt(cell)
        if (!station) return undefined
        return {
            centre: centreOf(cell),
            path: emblemRing(stationTile(station.tileId).letter),
            rotation: station.rotation * 90
        }
    }

    function stickOf(cell: OffsetCoordinates, side: Side) {
        const origin = cellOrigin(cell, bounds)
        return side === Side.East
            ? { x: origin.x + CellSize - 5, y: origin.y + half - 22, width: 10, height: 44 }
            : { x: origin.x + half - 22, y: origin.y + CellSize - 5, width: 44, height: 10 }
    }

    function isChosen(cell: OffsetCoordinates): boolean {
        return gameSession.chosenCell !== undefined && sameCoordinates(cell, gameSession.chosenCell)
    }

    function activate(event: KeyboardEvent, act: () => void) {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        act()
    }

    function inspect(station: PlacedStation) {
        gameSession.inspectStation(station.cell)
    }

    function hover(event: PointerEvent, station: PlacedStation | undefined) {
        if (event.pointerType !== 'mouse') return
        gameSession.hoverStation(station?.cell)
    }
</script>

<rect
    class="ground"
    x="0"
    y="0"
    width={size.width}
    height={size.height}
    rx="12"
    fill="url(#{BoardGroundId})"
></rect>

<CentralStation x={centre.x} y={centre.y} />

{#each stations as station (cellKey(station.cell))}
    {@const key = cellKey(station.cell)}
    {@const origin = cellOrigin(station.cell, bounds)}
    {@const owned = station.ownerId !== undefined}
    {@const faceUp = station.faceUp && !flipped.has(key)}
    {@const badge = gameSession.stationBadges.get(key)}
    <g class="station" class:owned transform="translate({origin.x} {origin.y})">
        <g data-station-tile={key}>
            {#if faceUp}
                <g transform="rotate({station.rotation * 90} {half} {half})">
                    <TileImage tileId={station.tileId} size={CellSize} />
                </g>
            {:else}
                <TileImage size={CellSize} />
            {/if}
            <rect class="edge" x="0.5" y="0.5" width={CellSize - 1} height={CellSize - 1}></rect>
        </g>
        {#if station.ownerId && station.cubes > 0}
            <CubePile
                {key}
                count={station.cubes}
                color={gameSession.colors.getPlayerBgColorValue(station.ownerId)}
            />
        {/if}
        {#if badge !== undefined}
            {@const label = `$${badge}`}
            {@const width = textWidth(OcrFace, label, BadgeFont) + 12}
            <rect
                class="badge"
                x={CellSize - 4 - width}
                y={CellSize - 26}
                {width}
                height="22"
                rx="11"
            ></rect>
            <text
                class="badge-text"
                x={CellSize - 4 - width / 2}
                y={CellSize - 15}
                dy={centredShift(OcrFace, BadgeFont)}
                font-size={BadgeFont}
                text-anchor="middle">{label}</text
            >
        {/if}
        {#if owned}
            <rect
                class="hit"
                width={CellSize}
                height={CellSize}
                role="button"
                tabindex="0"
                aria-label="Show this station’s route"
                onclick={() => inspect(station)}
                onkeydown={(event) => activate(event, () => inspect(station))}
                onpointerenter={(event) => hover(event, station)}
                onpointerleave={(event) => hover(event, undefined)}
            ></rect>
        {/if}
    </g>
{/each}

{#each offRoute as station (cellKey(station.cell))}
    {@const origin = cellOrigin(station.cell, bounds)}
    <rect class="dim" x={origin.x} y={origin.y} width={CellSize} height={CellSize}></rect>
{/each}

{#if choice}
    {#each choice.options as option, index (index)}
        {#if index !== gameSession.focusedOption}
            <polyline
                class="other-option"
                points={option.cells
                    .map(centreOf)
                    .map((point) => `${point.x},${point.y}`)
                    .join(' ')}
                style:--route={gameSession.colors.getPlayerBgColorValue(choice.playerId)}
            ></polyline>
        {/if}
    {/each}
{/if}

{#each gameSession.shownRoutes as route (route.key)}
    <RouteFlow
        id="conduit-route-glow-{route.key}"
        line={routeLine(route.cells, route.branch ?? false)}
        color={route.color}
        flowing={gameSession.shownRoutes.length === 1 ||
            (route.branch === true && branches.length <= MaxFlowingBranches)}
    />
{/each}

{#if branches.length > 0}
    {@const home = ringAt(branches[0].cells[0])}
    {#if home}
        <path
            class="branch-ring"
            d={home.path}
            transform="translate({home.centre.x} {home.centre.y}) rotate({home.rotation})"
            stroke-width={RingStroke}
            style:--route={branches[0].color}
        ></path>
    {/if}
    {#each branches as route (route.key)}
        {@const end = ringAt(route.cells[route.cells.length - 1])}
        {#if end}
            <path
                class="branch-end"
                d={end.path}
                transform="translate({end.centre.x} {end.centre.y}) rotate({end.rotation})"
                stroke-width={RingStroke}
            ></path>
        {/if}
    {/each}
{/if}

{#each focusedBonuses as bonus (cellKey(bonus.cell))}
    {@const point = centreOf(bonus.cell)}
    <g class="bonus-chip" transform="translate({point.x} {point.y - 30})">
        <rect x="-24" y="-14" width="48" height="28" rx="14" style:fill={bonus.color}></rect>
        <text text-anchor="middle" dy={centredShift(OcrFace, 16)}>+$1</text>
    </g>
{/each}

{#each sticks as closed (`${cellKey(closed.cell)}-${closed.side}`)}
    {@const stick = stickOf(closed.cell, closed.side)}
    <rect
        class="stick"
        x={stick.x}
        y={stick.y}
        width={stick.width}
        height={stick.height}
        rx="3"
        fill="url(#{CautionStripesId})"
    ></rect>
{/each}

<RouteShows {bounds} />

{#each gameSession.placementOptions as option (cellKey(option.cell))}
    {@const origin = cellOrigin(option.cell, bounds)}
    {@const chosen = isChosen(option.cell)}
    <g
        class="target"
        class:chosen
        transform="translate({origin.x} {origin.y})"
        role="button"
        tabindex="0"
        aria-label="Place the tile here"
        onclick={() => gameSession.chooseCell(option.cell)}
        onkeydown={(event) => activate(event, () => gameSession.chooseCell(option.cell))}
    >
        {#if chosen && gameSession.placement}
            <g transform="translate({half} {half})">
                <g class="preview" style:transform="rotate({gameSession.previewTurns * 90}deg)">
                    <TileImage
                        tileId={gameSession.placement.tileId}
                        x={-half}
                        y={-half}
                        size={CellSize}
                    />
                </g>
            </g>
        {/if}
        <!-- The popup anchors here: the frame keeps its size while the preview turns. -->
        <rect
            id={cellElementId(option.cell)}
            class="target-frame"
            x="4"
            y="4"
            width={CellSize - 8}
            height={CellSize - 8}
            rx="8"
        ></rect>
    </g>
{/each}

<style>
    .ground {
        stroke: #1d3d6e;
        stroke-width: 1;
    }

    .edge {
        fill: none;
        stroke: rgb(0 0 0 / 0.5);
        stroke-width: 1;
    }

    .station.owned {
        cursor: pointer;
    }

    .hit {
        fill: transparent;
        outline: none;
    }

    .station:has(.hit:focus-visible) .edge {
        stroke: #57d3ff;
        stroke-width: 3;
    }

    /* Cream, so a station's earnings never read as a player's colour. */
    .badge {
        fill: #f3ead2;
        stroke: #10161f;
        stroke-width: 1.5;
    }

    /* OCR-A, the emblem letters' face: electronic, and its even strokes stay clear this small. */
    .badge-text {
        font-family: 'Conduit OCR', ui-monospace, monospace;
        fill: #10161f;
        /* OCR-A has one weight; a hairline of the same ink thickens its strokes. */
        stroke: #10161f;
        stroke-width: 0.6;
        stroke-linejoin: round;
    }

    .other-option {
        fill: none;
        stroke: var(--route);
        stroke-width: 6;
        stroke-dasharray: 4 10;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.55;
        pointer-events: none;
    }

    .bonus-chip {
        pointer-events: none;
    }

    .bonus-chip rect {
        stroke: #1b1505;
        stroke-width: 1.5;
    }

    .bonus-chip text {
        font-size: 16px;
        font-weight: 800;
        fill: #fff;
        stroke: #000;
        stroke-width: 3px;
        paint-order: stroke;
    }

    .dim {
        fill: rgb(8 12 18 / 0.55);
        pointer-events: none;
    }

    .branch-ring,
    .branch-end {
        fill: none;
        stroke-linejoin: round;
        pointer-events: none;
    }

    .branch-ring {
        stroke: var(--route);
    }

    .branch-end {
        stroke: #f5c542;
    }

    .stick {
        stroke: #141414;
        stroke-width: 1.5;
        pointer-events: none;
    }

    .target {
        cursor: pointer;
    }

    .target-frame {
        fill: rgb(87 211 255 / 0.12);
        stroke: #57d3ff;
        stroke-width: 2.5;
        stroke-dasharray: 8 6;
    }

    .target:hover .target-frame,
    .target:focus-visible .target-frame {
        fill: rgb(87 211 255 / 0.28);
    }

    .target:focus-visible {
        outline: none;
    }

    .target.chosen .target-frame {
        fill: none;
        stroke: #f5c542;
        stroke-dasharray: none;
        stroke-width: 3;
    }

    .preview {
        opacity: 0.85;
        transition: transform 0.28s ease-in-out;
    }

    @media (prefers-reduced-motion: reduce) {
        .preview {
            transition: none;
        }
    }
</style>
