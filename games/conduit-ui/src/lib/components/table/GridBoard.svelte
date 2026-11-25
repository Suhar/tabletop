<script lang="ts">
    import { sameCoordinates, type OffsetCoordinates } from '@tabletop/common'
    import { CentralCell, neighborCell, Side, type PlacedStation } from '@tabletop/conduit'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        boardSize,
        CellSize,
        cellElementId,
        cellKey,
        cellOrigin
    } from '$lib/utils/boardLayout.js'
    import { centredTextShift } from '$lib/utils/tableLayout.js'
    import { TileBackUrl, tileFaceUrl } from '$lib/utils/tileArt.js'
    import CentralStation from './CentralStation.svelte'
    import CubePile from './CubePile.svelte'
    import RouteFlow from './RouteFlow.svelte'
    import RouteShows from './RouteShows.svelte'

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

    // A route being chosen, and who the option in focus would pay: each other player's station on
    // it with a cube, the destination included.
    const choice = $derived(gameSession.isViewingHistory ? undefined : gameSession.shownRouteChoice)
    const focusedTolls = $derived.by(() => {
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

    // A single highlighted route dims the stations it doesn't pass.
    const focusRoute = $derived(
        gameSession.shownRoutes.length === 1 ? gameSession.shownRoutes[0] : undefined
    )
    const offRoute = $derived(
        focusRoute
            ? stations.filter(
                  (station) => !focusRoute.cells.some((cell) => sameCoordinates(cell, station.cell))
              )
            : []
    )

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

    // The preview tile turns the way the player turned it, the short way round otherwise (Undo),
    // so its quarter turns keep counting past a full circle rather than unwinding.
    let turnsSoFar = 0
    const previewTurns = $derived.by(() => {
        const rotation = gameSession.chosenRotation
        if (rotation === undefined) return turnsSoFar
        const current = ((turnsSoFar % 4) + 4) % 4
        const turned = gameSession.turnedTo
        let step = (((rotation - current) % 4) + 4) % 4
        if (turned?.rotation === rotation && turned.direction === -1) {
            step = step === 0 ? 0 : step - 4
        } else if (turned?.rotation !== rotation && step > 2) {
            step -= 4
        }
        turnsSoFar += step
        return turnsSoFar
    })
</script>

<rect class="ground" x="0" y="0" width={size.width} height={size.height} rx="12"></rect>

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
                <image
                    href={tileFaceUrl(station.tileId)}
                    width={CellSize}
                    height={CellSize}
                    transform="rotate({station.rotation * 90} {half} {half})"
                ></image>
            {:else}
                <image href={TileBackUrl} width={CellSize} height={CellSize}></image>
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
            <rect class="badge" x={CellSize - 38} y={CellSize - 26} width="34" height="22" rx="11"
            ></rect>
            <text
                class="badge-text"
                x={CellSize - 21}
                y={CellSize - 15}
                dy={centredTextShift(14)}
                text-anchor="middle">${badge}</text
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
    <!-- The other tied routes, faint, beneath the one in focus. -->
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
        line={route.cells.map(centreOf)}
        color={route.color}
        flowing={gameSession.shownRoutes.length === 1}
    />
{/each}

<!-- The tolls the route in focus would pay, on the stations they go to. -->
{#each focusedTolls as toll (cellKey(toll.cell))}
    {@const point = centreOf(toll.cell)}
    <g class="toll-chip" transform="translate({point.x} {point.y - 30})">
        <rect x="-24" y="-14" width="48" height="28" rx="14" style:fill={toll.color}></rect>
        <text text-anchor="middle" dy={centredTextShift(16)}>+$1</text>
    </g>
{/each}

{#each sticks as closed (`${cellKey(closed.cell)}-${closed.side}`)}
    {@const stick = stickOf(closed.cell, closed.side)}
    <rect class="stick" x={stick.x} y={stick.y} width={stick.width} height={stick.height} rx="3"
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
                <g class="preview" style:transform="rotate({previewTurns * 90}deg)">
                    <image
                        href={tileFaceUrl(gameSession.placement.tileId)}
                        x={-half}
                        y={-half}
                        width={CellSize}
                        height={CellSize}
                    ></image>
                </g>
            </g>
        {/if}
        <!-- The placement popup anchors here: the frame keeps its size while the preview turns. -->
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
        fill: #141c26;
        stroke: #263243;
        stroke-width: 1;
    }

    .edge {
        fill: none;
        stroke: rgb(0 0 0 / 0.35);
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

    .badge {
        fill: #10161f;
        stroke: #f5c542;
        stroke-width: 1.5;
    }

    .badge-text {
        font-size: 14px;
        font-weight: 800;
        fill: #f5c542;
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

    .toll-chip {
        pointer-events: none;
    }

    .toll-chip rect {
        stroke: #1b1505;
        stroke-width: 1.5;
    }

    .toll-chip text {
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

    .stick {
        fill: #e3342f;
        stroke: #5c0f0c;
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
