<script lang="ts">
    import type { AxialCoordinates } from '@tabletop/common'
    import { HexKind, type Hex, PieceType, PlanetColor, sameHex } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexGeometry, verticesToPoints } from '$lib/utils/hexDefinition.js'

    let gameSession = getGameSession()

    // Planet colours are the game's own five, not player colours - a planet belongs to nobody.
    const PLANET_FILL: Record<PlanetColor, string> = {
        [PlanetColor.Azure]: '#3d8bd4',
        [PlanetColor.Crimson]: '#d1453f',
        [PlanetColor.Verdant]: '#4aa568',
        [PlanetColor.Gold]: '#dfa72c',
        [PlanetColor.Violet]: '#8b5cc4'
    }

    const PADDING = 60

    type Placed = {
        hex: Hex
        center: { x: number; y: number }
        points: string
        box: { x: number; y: number; width: number; height: number }
    }

    let placed: Placed[] = $derived(
        Object.values(gameSession.gameState.board.hexes).map((hex) => {
            const geometry = hexGeometry(hex.coords)
            return {
                hex,
                center: geometry.center,
                points: verticesToPoints(geometry),
                box: geometry.boundingBox
            }
        })
    )

    // The board is generated, so its extent isn't known ahead of time - the view has to be
    // measured from the hexes that actually exist.
    let viewBox = $derived.by(() => {
        if (placed.length === 0) return '0 0 100 100'
        const minX = Math.min(...placed.map((entry) => entry.box.x)) - PADDING
        const minY = Math.min(...placed.map((entry) => entry.box.y)) - PADDING
        const maxX = Math.max(...placed.map((entry) => entry.box.x + entry.box.width)) + PADDING
        const maxY = Math.max(...placed.map((entry) => entry.box.y + entry.box.height)) + PADDING
        return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
    })

    let hovered: AxialCoordinates | undefined = $state(undefined)

    // Where the fighter being placed could shoot if it landed on the hovered hex. Shown before
    // the placement so the shot can be aimed rather than discovered afterwards.
    let previewTargets: AxialCoordinates[] = $derived(
        hovered ? gameSession.previewTargetsFor(hovered) : []
    )

    function isPreviewTarget(coords: AxialCoordinates): boolean {
        return previewTargets.some((target) => sameHex(target, coords))
    }

    function isExploringPlanet(coords: AxialCoordinates): boolean {
        const planet = gameSession.gameState.pendingExploration?.exploringPlanet
        return planet !== undefined && sameHex(planet, coords)
    }
</script>

<svg {viewBox} class="w-[1200px] max-w-full select-none" role="presentation">
    <!-- Deep space behind everything, so the board reads as a map rather than a grid. -->
    <rect x="-10000" y="-10000" width="20000" height="20000" fill="#0a0f1c" />

    {#each placed as entry (entry.hex.tileId + entry.hex.coords.q + ',' + entry.hex.coords.r)}
        {@const hex = entry.hex}
        {@const highlighted = gameSession.isHighlighted(hex.coords)}
        {@const targeted = isPreviewTarget(hex.coords)}
        {@const planetColor = hex.color ? PLANET_FILL[hex.color] : '#1b2436'}

        <g
            role="button"
            tabindex="-1"
            onclick={() => gameSession.onBoardClick(hex.coords)}
            onkeydown={(event) => event.key === 'Enter' && gameSession.onBoardClick(hex.coords)}
            onmouseenter={() => (hovered = hex.coords)}
            onmouseleave={() => (hovered = undefined)}
            class={highlighted ? 'cursor-pointer' : ''}
        >
            <polygon
                points={entry.points}
                fill={hex.kind === HexKind.Planet ? planetColor : '#141c2e'}
                fill-opacity={hex.kind === HexKind.Planet ? 0.28 : 1}
                stroke="#2b3752"
                stroke-width="2"
            />

            {#if hex.kind === HexKind.Planet}
                <!-- The planet body. Unexplored planets are ringed and marked; explored ones
                     are solid and carry the technology they hold. -->
                <circle
                    cx={entry.center.x}
                    cy={entry.center.y}
                    r="27"
                    fill={planetColor}
                    fill-opacity={hex.explored ? 1 : 0.45}
                    stroke={planetColor}
                    stroke-width="3"
                    stroke-dasharray={hex.explored ? '' : '5 4'}
                />
                {#if hex.technologyId}
                    <text
                        x={entry.center.x}
                        y={entry.center.y + 5}
                        text-anchor="middle"
                        class="fill-white text-[15px] font-bold"
                    >
                        {hex.technologyId.replace('tech-', 'T')}
                    </text>
                {:else if !hex.explored}
                    <text
                        x={entry.center.x}
                        y={entry.center.y + 7}
                        text-anchor="middle"
                        class="fill-white/70 text-[20px] font-bold"
                    >
                        ?
                    </text>
                {/if}
            {:else if hex.piece}
                {@const color = gameSession.colors.getPlayerUiColor(hex.piece.playerId)}
                {#if hex.piece.type === PieceType.Probe}
                    <!-- Probe: small and open. No power, so it never looks like a claim. -->
                    <circle
                        cx={entry.center.x}
                        cy={entry.center.y}
                        r="16"
                        fill="none"
                        stroke={color}
                        stroke-width="6"
                    />
                {:else if hex.piece.type === PieceType.Station}
                    <rect
                        x={entry.center.x - 19}
                        y={entry.center.y - 19}
                        width="38"
                        height="38"
                        rx="7"
                        fill={color}
                    />
                {:else}
                    <polygon
                        points="{entry.center.x},{entry.center.y - 24} {entry.center.x +
                            23},{entry.center.y + 16} {entry.center.x - 23},{entry.center.y + 16}"
                        fill={color}
                    />
                {/if}
                {#if hex.piece.level}
                    <text
                        x={entry.center.x}
                        y={entry.center.y +
                            (hex.piece.type === PieceType.Fighter
                                ? 14
                                : hex.piece.type === PieceType.Probe
                                  ? 6
                                  : 7)}
                        text-anchor="middle"
                        class="text-[17px] font-bold"
                        fill={hex.piece.type === PieceType.Probe ? color : '#10182a'}
                    >
                        {hex.piece.level}
                    </text>
                {/if}
            {/if}

            {#if targeted}
                <!-- This piece would be in range of the fighter you are holding. -->
                <polygon
                    points={entry.points}
                    fill="none"
                    stroke="#ff6b5e"
                    stroke-width="5"
                    stroke-dasharray="8 6"
                />
            {/if}

            {#if isExploringPlanet(hex.coords)}
                <polygon points={entry.points} fill="none" stroke="#ffffff" stroke-width="4" />
            {/if}

            {#if highlighted}
                <polygon
                    points={entry.points}
                    fill="#ffffff"
                    fill-opacity="0.07"
                    stroke="#e8f0ff"
                    stroke-width="4"
                    class="pulse"
                />
            {/if}
        </g>
    {/each}
</svg>

<style>
    @keyframes glow {
        0%,
        100% {
            stroke-opacity: 0.35;
        }
        50% {
            stroke-opacity: 1;
        }
    }

    .pulse {
        animation: glow 2.2s ease-in-out infinite;
    }
</style>
