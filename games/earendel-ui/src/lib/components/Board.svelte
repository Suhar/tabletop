<script lang="ts">
    import { onMount } from 'svelte'
    import { type AxialCoordinates, sameCoordinates } from '@tabletop/common'
    import {
        HexKind,
        type Hex,
        PieceLevel,
        PieceType,
        PlanetColor,
        TECHNOLOGY_CATEGORY,
        TECHNOLOGY_CATEGORY_INFO,
        categoryOfColor,
        hexKey,
        planetPairKey,
        powerOf,
        technologyAbility,
        technologyCard,
        technologyName,
        tileFootprint
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexGeometry, verticesToPoints } from '$lib/utils/hexDefinition.js'
    import { trussEnds } from '$lib/utils/stationGeometry.js'
    import StationShape from './StationShape.svelte'
    import TrussGirder from './TrussGirder.svelte'
    import FighterShape from './FighterShape.svelte'
    import TerraformerShape from './TerraformerShape.svelte'
    import RelayShape from './RelayShape.svelte'
    import PlanetTile from './PlanetTile.svelte'
    import { TerraformAnimator } from '$lib/animators/terraformAnimator.svelte.js'
    import ProbeShape from './ProbeShape.svelte'
    import {
        CLIP_OVERREACH,
        TrussGrowthAnimator
    } from '$lib/animators/trussGrowthAnimator.svelte.js'
    import { animatePiece, PieceMoveAnimator } from '$lib/animators/pieceMoveAnimator.svelte.js'
    import {
        ORBIT_PERIOD,
        ORBITER_SCALE,
        beamKey,
        OrbitAnimator,
        orbitSlot
    } from '$lib/animators/orbitAnimator.svelte.js'
    import { ScoreFloatAnimator } from '$lib/animators/scoreFloatAnimator.svelte.js'
    import { BlastAnimator } from '$lib/animators/blastAnimator.svelte.js'
    import { registerElement } from '$lib/animators/elementRegistry.js'
    import { linkedStationNeighbors, stationTubeKey } from '$lib/utils/stationLinks.js'
    import { PLANET_FILL } from '$lib/utils/planetColors.js'

    let gameSession = getGameSession()

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

    let ghosts = $derived(
        gameSession.tileOrigins.map((origin) => ({
            origin,
            hexes: tileFootprint(origin, gameSession.tileRotation).map((coords) => {
                const geometry = hexGeometry(coords)
                return {
                    coords,
                    points: verticesToPoints(geometry),
                    center: geometry.center,
                    box: geometry.boundingBox
                }
            })
        }))
    )

    // Kept as numbers too: an overlay must stay inside the viewBox or the SVG clips it.
    let view = $derived.by(() => {
        const boxes = [
            ...placed.map((entry) => entry.box),
            ...ghosts.flatMap((ghost) => ghost.hexes.map((hex) => hex.box))
        ]
        if (boxes.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 }

        return {
            minX: Math.min(...boxes.map((box) => box.x)) - PADDING,
            minY: Math.min(...boxes.map((box) => box.y)) - PADDING,
            maxX: Math.max(...boxes.map((box) => box.x + box.width)) + PADDING,
            maxY: Math.max(...boxes.map((box) => box.y + box.height)) + PADDING
        }
    })

    let viewBox = $derived(
        `${view.minX} ${view.minY} ${view.maxX - view.minX} ${view.maxY - view.minY}`
    )

    let hovered: AxialCoordinates | undefined = $state(undefined)
    let hoveredTileOrigin: AxialCoordinates | undefined = $state(undefined)

    // Touch has no hover, so a tap on a hex the session does not act on inspects it.
    let inspected: AxialCoordinates | undefined = $derived.by(() => {
        void gameSession.gameState
        return undefined
    })
    let lastPointerType = 'mouse'

    let placementFocus: AxialCoordinates | undefined = $derived(hovered ?? gameSession.previewHex)
    let focused: AxialCoordinates | undefined = $derived(placementFocus ?? inspected)

    let tilePreviewOrigin: AxialCoordinates | undefined = $derived(
        hoveredTileOrigin ?? (gameSession.isPlacingTile ? gameSession.previewHex : undefined)
    )

    function onHexPointerEnter(event: PointerEvent, coords: AxialCoordinates) {
        if (event.pointerType !== 'touch') hovered = coords
    }

    function onHexPointerLeave(event: PointerEvent) {
        if (event.pointerType !== 'touch') hovered = undefined
    }

    async function onHexClick(coords: AxialCoordinates) {
        const touch = lastPointerType === 'touch'
        if (touch) {
            inspected = inspected && sameCoordinates(inspected, coords) ? undefined : coords
        }
        await gameSession.onBoardClick(coords, touch)
    }

    let ghostPiece = $derived(
        gameSession.previewingPlacement ? gameSession.pieceToPlace : undefined
    )
    let showGhost = $derived(ghostPiece !== undefined)

    let ghostEntry = $derived.by(() => {
        const at = placementFocus
        if (!showGhost || !at || !gameSession.isHighlighted(at)) return undefined
        return placed.find((entry) => sameCoordinates(entry.hex.coords, at))
    })

    let previewTargets: AxialCoordinates[] = $derived(
        placementFocus ? gameSession.previewTargetsFor(placementFocus) : []
    )

    let previewProbeDestinations: AxialCoordinates[] = $derived(
        placementFocus ? gameSession.previewProbeDestinationsFor(placementFocus) : []
    )

    let shownControlEdges = $derived(focused ? gameSession.controlEdgesFor(focused) : [])
    let shownRelayLines = $derived(focused ? gameSession.relayLinesFor(focused) : [])

    // From the edge of the station's core to the edge of the probe's hub.
    function relayRun(station: AxialCoordinates, probe: AxialCoordinates) {
        const from = hexGeometry(station).center
        const to = hexGeometry(probe).center
        const dx = to.x - from.x
        const dy = to.y - from.y
        const distance = Math.hypot(dx, dy)
        const ux = dx / distance
        const uy = dy / distance
        return {
            x1: from.x + ux * 20,
            y1: from.y + uy * 20,
            x2: to.x - ux * 11,
            y2: to.y - uy * 11
        }
    }

    // Sampled rather than drawn with arcs so the wavelength stays constant at any length or angle.
    function wavePath(from: AxialCoordinates, to: AxialCoordinates): string {
        return waveBetween(hexGeometry(from).center, hexGeometry(to).center)
    }

    const SHOW_CONTROL_WAVE = false
    const SHOW_CONTROL_DOTS = true

    const CONTROL_DOTS = 9
    const CONTROL_DOT_CYCLE = 1.5

    function controlDots(from: AxialCoordinates, planet: AxialCoordinates) {
        const start = hexGeometry(from).center
        const end = hexGeometry(planet).center
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        if (length === 0) return []

        const ux = dx / length
        const uy = dy / length

        return Array.from({ length: CONTROL_DOTS }, (_unused, i) => {
            const along = (length * i) / (CONTROL_DOTS - 1)
            return {
                x: start.x + ux * along,
                y: start.y + uy * along,
                delay: (i * CONTROL_DOT_CYCLE) / CONTROL_DOTS
            }
        })
    }

    // One pip per player with a route to a planet, in a row centred along the bottom of its hex.
    const ROUTE_PIP_DROP = 37
    const ROUTE_PIP_SPACING = 13
    const ROUTE_RING_RADIUS = 36

    type TradeRoute = (typeof gameSession.gameState.tradeRoutes)[number]

    function routeKey(route: TradeRoute): string {
        return planetPairKey(...route.planets)
    }

    function touches(route: TradeRoute, planet: AxialCoordinates): boolean {
        return route.planets.some((end) => sameCoordinates(end, planet))
    }

    // Each joined planet's pips, in turn order so a player's pip sits in the same place everywhere.
    let routePips = $derived.by(() => {
        const routes = gameSession.gameState.tradeRoutes
        const planets = new Map<string, AxialCoordinates>()
        for (const route of routes) {
            for (const end of route.planets) planets.set(`${end.q},${end.r}`, end)
        }
        return [...planets.entries()].flatMap(([key, planet]) => {
            const players = gameSession.gameState.turnManager.turnOrder.filter((playerId) =>
                routes.some((route) => route.playerId === playerId && touches(route, planet))
            )
            const center = hexGeometry(planet).center
            return players.map((playerId, index) => ({
                key: `${key}:${playerId}`,
                planet,
                playerId,
                x: center.x + (index - (players.length - 1) / 2) * ROUTE_PIP_SPACING,
                y: center.y + ROUTE_PIP_DROP
            }))
        })
    })

    // The pip under the pointer: a player's routes to one planet. Hovering a planet instead shows
    // all of its routes.
    let hoveredPip: { playerId: string; planet: AxialCoordinates } | undefined = $state(undefined)

    let shownRoutes: TradeRoute[] = $derived.by(() => {
        const routes = gameSession.gameState.tradeRoutes
        const pip = hoveredPip
        if (pip) {
            return routes.filter(
                (route) => route.playerId === pip.playerId && touches(route, pip.planet)
            )
        }
        const planet = focused
        if (!planet) return []
        return routes.filter((route) => touches(route, planet))
    })

    function onRoutePipEnter(event: PointerEvent, playerId: string, planet: AxialCoordinates) {
        if (event.pointerType === 'touch') return
        hoveredPip = { playerId, planet }
    }

    function onRoutePipLeave(event: PointerEvent) {
        if (event.pointerType === 'touch') return
        hoveredPip = undefined
    }

    // Between the rings drawn around the two planets.
    function routeRun(a: AxialCoordinates, b: AxialCoordinates) {
        const from = hexGeometry(a).center
        const to = hexGeometry(b).center
        const dx = to.x - from.x
        const dy = to.y - from.y
        const distance = Math.hypot(dx, dy)
        const inset = ROUTE_RING_RADIUS
        return {
            x1: from.x + (dx / distance) * inset,
            y1: from.y + (dy / distance) * inset,
            x2: to.x - (dx / distance) * inset,
            y2: to.y - (dy / distance) * inset,
            length: distance - 2 * inset
        }
    }

    // From within the planet's disc, where the light diffuses, to the edge of the probe's hub.
    function uplinkBeam(planet: AxialCoordinates, probe: AxialCoordinates) {
        const from = hexGeometry(planet).center
        const to = hexGeometry(probe).center
        const dx = to.x - from.x
        const dy = to.y - from.y
        const distance = Math.hypot(dx, dy)
        const startInset = 14
        const endInset = 8
        return {
            x: from.x + (dx / distance) * startInset,
            y: from.y + (dy / distance) * startInset,
            length: distance - startInset - endInset,
            degrees: (Math.atan2(dy, dx) * 180) / Math.PI
        }
    }

    // Sides of a station joined to a neighbour, which lose their docking stubs.
    function linkedAngles(coords: AxialCoordinates, playerId: string): number[] {
        const board = trussGrowth.dockingBoard ?? gameSession.gameState.board
        const from = hexGeometry(coords).center
        return linkedStationNeighbors(board, coords, playerId).map((neighbor) => {
            const to = hexGeometry(neighbor).center
            return Math.atan2(to.y - from.y, to.x - from.x)
        })
    }

    function insetPoints(coords: AxialCoordinates, inset: number): string {
        const { center, vertices } = hexGeometry(coords)
        return vertices
            .map((vertex) => {
                const dx = vertex.x - center.x
                const dy = vertex.y - center.y
                const scale = (Math.hypot(dx, dy) - inset) / Math.hypot(dx, dy)
                return `${center.x + dx * scale},${center.y + dy * scale}`
            })
            .join(' ')
    }

    function sharedEdge(a: AxialCoordinates, b: AxialCoordinates) {
        const va = hexGeometry(a).vertices
        const vb = hexGeometry(b).vertices
        const shared = va.filter((pa) =>
            vb.some((pb) => Math.abs(pa.x - pb.x) < 0.6 && Math.abs(pa.y - pb.y) < 0.6)
        )
        return shared.length === 2 ? { start: shared[0], end: shared[1] } : undefined
    }

    function waveBetween(
        start: { x: number; y: number },
        end: { x: number; y: number },
        amplitude = 9,
        wavelength = 46
    ): string {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        if (length === 0) return ''

        const ux = dx / length
        const uy = dy / length
        const px = -uy
        const py = ux

        const samples = Math.max(24, Math.round(length / 3))
        const waves = Math.max(2, Math.round(length / wavelength))

        let path = ''
        for (let i = 0; i <= samples; i++) {
            const t = i / samples
            const offset = Math.sin(t * waves * 2 * Math.PI) * amplitude
            const x = start.x + ux * length * t + px * offset
            const y = start.y + uy * length * t + py * offset
            path += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `
        }
        return path.trim()
    }

    const trussGrowth = new TrussGrowthAnimator()
    const pieceMoves = new PieceMoveAnimator()
    const scoreFloats = new ScoreFloatAnimator()
    const blasts = new BlastAnimator()
    const orbits = new OrbitAnimator((pieceId) => pieceMoves.nodeOf(pieceId))
    const terraforms = new TerraformAnimator()

    onMount(() => {
        const animators = [pieceMoves, trussGrowth, blasts, scoreFloats, orbits, terraforms]
        const listeners = animators.map((animator) => animator.onGameStateChange.bind(animator))
        for (const listener of listeners) gameSession.addGameStateChangeListener(listener)
        return () => {
            for (const listener of listeners) gameSession.removeGameStateChangeListener(listener)
        }
    })

    let shownTechnology = $derived.by(() => {
        const coords = gameSession.pinnedPlanet ?? focused
        if (!coords) return undefined

        const entry = placed.find((candidate) => sameCoordinates(candidate.hex.coords, coords))
        if (!entry?.hex.technologyId) return undefined

        return {
            key: `${coords.q},${coords.r}`,
            card: technologyCard(entry.hex.technologyId),
            center: entry.center
        }
    })

    // A planet with no technology yet says what kind of planet it is: its colour's category.
    let shownPlanetKind = $derived.by(() => {
        const coords = focused
        if (!coords || shownTechnology) return undefined

        const entry = placed.find((candidate) => sameCoordinates(candidate.hex.coords, coords))
        const color = entry?.hex.kind === HexKind.Planet ? entry.hex.color : undefined
        if (!entry || !color) return undefined

        return {
            key: `${coords.q},${coords.r}`,
            category: TECHNOLOGY_CATEGORY_INFO[categoryOfColor(color)],
            center: entry.center
        }
    })

    // The SVG clips anything outside its viewBox.
    function popupPosition(
        center: { x: number; y: number },
        width: number,
        height: number
    ): { x: number; y: number } {
        const gap = 40

        let x = center.x + gap
        if (x + width > view.maxX) x = center.x - gap - width

        return {
            x: Math.min(Math.max(x, view.minX), Math.max(view.minX, view.maxX - width)),
            y: Math.min(
                Math.max(center.y - height / 2, view.minY),
                Math.max(view.minY, view.maxY - height)
            )
        }
    }

    const ATTACK_RED = '#ff2f2f'
    const SURVEY_BLUE = '#8fb6ff'

    // Two chevrons on the shared edge, pointing from a ship at a hex it reaches: a fighter's
    // target in red, a probe's planet in a calm blue.
    function chevronsBetween(from: AxialCoordinates, to: AxialCoordinates) {
        const start = hexGeometry(from).center
        const end = hexGeometry(to).center
        return {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
            degrees: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
        }
    }

    // SVG has no text wrapping, so the ability is broken into lines here.
    function wrap(text: string, limit: number): string[] {
        const lines: string[] = []
        let line = ''

        for (const word of text.split(' ')) {
            if (line.length > 0 && (line + ' ' + word).length > limit) {
                lines.push(line)
                line = word
            } else {
                line = line.length > 0 ? `${line} ${word}` : word
            }
        }
        if (line.length > 0) lines.push(line)

        return lines
    }

    function isExploringPlanet(coords: AxialCoordinates): boolean {
        const planet = gameSession.gameState.pendingExploration?.exploringPlanet
        return planet !== undefined && sameCoordinates(planet, coords)
    }
</script>

{#snippet chevronPulse(
    at: { x: number; y: number; degrees: number },
    color: string,
    strength: number
)}
    <g
        transform="translate({at.x} {at.y}) rotate({at.degrees})"
        opacity={strength}
        pointer-events="none"
    >
        <g class="chevron-pulse">
            {#each [-6, 4] as offset (offset)}
                <polygon
                    points="{offset - 5},-7 {offset + 4},0 {offset - 5},7 {offset - 2},0"
                    fill={color}
                />
            {/each}
        </g>
    </g>
{/snippet}

<svg {viewBox} class="w-[1200px] max-w-full select-none" role="presentation">
    {#each placed as entry (entry.hex.tileId + entry.hex.coords.q + ',' + entry.hex.coords.r)}
        {@const hex = entry.hex}
        {@const highlighted = gameSession.isHighlighted(hex.coords)}

        <g
            role="button"
            tabindex="-1"
            onpointerdown={(event) => (lastPointerType = event.pointerType)}
            onclick={() => onHexClick(hex.coords)}
            onkeydown={(event) => event.key === 'Enter' && gameSession.onBoardClick(hex.coords)}
            onpointerenter={(event) => onHexPointerEnter(event, hex.coords)}
            onpointerleave={onHexPointerLeave}
            class={highlighted ? 'cursor-pointer' : ''}
        >
            {#if hex.kind === HexKind.Planet}
                <PlanetTile
                    {hex}
                    center={entry.center}
                    points={entry.points}
                    inset={insetPoints(hex.coords, 2.5)}
                    marked
                />
            {:else}
                <polygon
                    points={entry.points}
                    fill="#141c2e"
                    fill-opacity="0.5"
                    stroke="#2b3752"
                    stroke-width="2"
                />
            {/if}

            {#if gameSession.spreading && gameSession.isSpreadTarget(hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#ff8a3d"
                    fill-opacity="0.18"
                    stroke="#ffab6b"
                    stroke-width="4"
                />
            {/if}

            {#if gameSession.railgunArmed && gameSession.railgunWouldMatter(hex.coords)}
                <polygon
                    points={entry.points}
                    fill="none"
                    stroke="#ff2f2f"
                    stroke-width="6"
                    class="pulse"
                />
            {/if}

            {#if gameSession.movingFrom && sameCoordinates(gameSession.movingFrom, hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#ffd479"
                    fill-opacity="0.16"
                    stroke="#ffd479"
                    stroke-width="5"
                />
            {/if}

            {#if gameSession.feintFrom && sameCoordinates(gameSession.feintFrom, hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#c4a2ff"
                    fill-opacity="0.16"
                    stroke="#c4a2ff"
                    stroke-width="5"
                />
            {/if}

            {#if gameSession.wormholeFrom && sameCoordinates(gameSession.wormholeFrom, hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#7fe3d4"
                    fill-opacity="0.16"
                    stroke="#7fe3d4"
                    stroke-width="5"
                />
            {/if}

            {#if gameSession.downloadFrom && sameCoordinates(gameSession.downloadFrom, hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#7ff0c0"
                    fill-opacity="0.16"
                    stroke="#7ff0c0"
                    stroke-width="5"
                />
            {/if}

            {#if isExploringPlanet(hex.coords)}
                <polygon points={entry.points} fill="none" stroke="#ffffff" stroke-width="4" />
            {/if}

            {#if gameSession.isClosedToMe(hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#ff6b5e"
                    fill-opacity="0.1"
                    stroke="#ff6b5e"
                    stroke-width="2"
                    stroke-dasharray="4 5"
                />
            {/if}

            {#if highlighted}
                {#if showGhost}
                    <polygon
                        points={entry.points}
                        fill="#ffffff"
                        fill-opacity="0.02"
                        stroke="#e8f0ff"
                        stroke-opacity="0.18"
                        stroke-width="2"
                    />
                {:else}
                    <polygon
                        points={entry.points}
                        fill="#ffffff"
                        fill-opacity="0.07"
                        stroke="#e8f0ff"
                        stroke-width="4"
                        class="pulse"
                    />
                {/if}
            {/if}
        </g>
    {/each}

    <!-- A recoloured planet wipes in from the left behind a white scan line (rules.md, Terraformer). -->
    {#each terraforms.wipes as wipe (wipe.key)}
        {@const geometry = hexGeometry(wipe.hex.coords)}
        {@const box = geometry.boundingBox}
        {@const outline = verticesToPoints(geometry)}
        <clipPath id="terraform-wipe-{wipe.key}">
            <rect
                use:registerElement={{ registry: terraforms.clips, key: wipe.key }}
                x={box.x}
                y={box.y}
                width="0"
                height={box.height}
                data-width={box.width}
            />
        </clipPath>
        <clipPath id="terraform-hex-{wipe.key}">
            <polygon points={outline} />
        </clipPath>
        <g clip-path="url(#terraform-wipe-{wipe.key})" pointer-events="none">
            <PlanetTile
                hex={wipe.hex}
                center={geometry.center}
                points={outline}
                inset={insetPoints(wipe.hex.coords, 2.5)}
                copy="-wipe"
            />
        </g>
        <g clip-path="url(#terraform-hex-{wipe.key})" pointer-events="none">
            <g use:registerElement={{ registry: terraforms.lines, key: wipe.key }}>
                <line
                    x1={box.x}
                    y1={box.y}
                    x2={box.x}
                    y2={box.y + box.height}
                    stroke="#ffffff"
                    stroke-opacity="0.3"
                    stroke-width="10"
                />
                <line
                    x1={box.x}
                    y1={box.y}
                    x2={box.x}
                    y2={box.y + box.height}
                    stroke="#ffffff"
                    stroke-width="2.5"
                />
            </g>
        </g>
    {/each}

    <!-- A pending probe claim: a beam from the claimed planet into each of the claimant's probes
         beside it, gained on their next turn if their probes still lead (rules.md, Gaining a
         technology). -->
    <!-- Joined pairs of planets: a crate in each joiner's colour along the bottom of the planet's hex
         (rules.md, Chains). Hovering a pip, or a joined planet, draws the routes. -->
    {#each routePips as pip (pip.key)}
        <rect
            x={pip.x - 5}
            y={pip.y - 5}
            width="10"
            height="10"
            rx="1.5"
            fill={gameSession.colors.getPlayerUiColor(pip.playerId)}
            stroke="#070b16"
            stroke-width="1.5"
            role="presentation"
            onpointerenter={(event) => onRoutePipEnter(event, pip.playerId, pip.planet)}
            onpointerleave={onRoutePipLeave}
            onclick={() => onHexClick(pip.planet)}
        />
    {/each}

    <!-- Probes spent researching a planet, circling it (rules.md, Gaining a technology). -->
    {#each placed as entry (entry.hex.coords.q + ',' + entry.hex.coords.r)}
        {@const orbiters = entry.hex.orbiters ?? []}
        {#if orbiters.length > 0}
            <g
                class="orbit"
                style="transform-origin: {entry.center.x}px {entry.center.y}px; animation-duration: {ORBIT_PERIOD}s;"
                use:registerElement={{ registry: orbits.orbits, key: String(hexKey(entry.hex.coords)) }}
                pointer-events="none"
            >
                {#each orbiters as probe, index (probe.id)}
                    {@const slot = orbitSlot(entry.hex.coords, index, orbiters.length)}
                    <g transform="translate({slot.x} {slot.y}) scale({ORBITER_SCALE})">
                        <ProbeShape
                            center={{ x: 0, y: 0 }}
                            color={gameSession.colors.getPlayerUiColor(probe.playerId)}
                            level={probe.level ?? PieceLevel.Two}
                        />
                    </g>
                {/each}
            </g>
        {/if}
    {/each}

    {#each gameSession.claimUplinks as uplink (uplink.planet.q + ',' + uplink.planet.r + '>' + uplink.probe.q + ',' + uplink.probe.r)}
        {@const beam = uplinkBeam(uplink.planet, uplink.probe)}
        {@const color = gameSession.colors.getPlayerUiColor(uplink.playerId)}
        {@const gradientId = `uplink-${uplink.planet.q}_${uplink.planet.r}-${uplink.probe.q}_${uplink.probe.r}`}
        <g
            transform="translate({beam.x} {beam.y}) rotate({beam.degrees})"
            class="uplink-beam"
            pointer-events="none"
        >
            <!-- Strongest at the probe, fading out over the planet. -->
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color={color} stop-opacity="0" />
                <stop offset="0.5" stop-color={color} stop-opacity="0.28" />
                <stop offset="1" stop-color={color} stop-opacity="0.5" />
            </linearGradient>
            <polygon
                points="0,-16 {beam.length},-5 {beam.length},5 0,16"
                fill="url(#{gradientId})"
                use:registerElement={{ registry: orbits.beams, key: beamKey(uplink.probe, uplink.planet) }}
            />
        </g>
    {/each}

    <!-- Above every hex so a piece can slide across; keyed by piece and hex so a moved piece remounts. -->
    {#each placed as entry (entry.hex.coords.q + ',' + entry.hex.coords.r)}
        {@const piece = entry.hex.piece}
        {#if piece}
            {#key piece.id + '@' + hexKey(entry.hex.coords)}
                {@const color = gameSession.colors.getPlayerUiColor(piece.playerId)}
                <g
                    use:animatePiece={{
                        animator: pieceMoves,
                        pieceId: piece.id,
                        coords: entry.hex.coords
                    }}
                    pointer-events="none"
                >
                    {#if piece.type === PieceType.Probe}
                        <ProbeShape
                            center={entry.center}
                            {color}
                            level={piece.level ?? PieceLevel.Two}
                        />
                    {:else if piece.type === PieceType.Station}
                        <StationShape
                            center={entry.center}
                            {color}
                            hub={piece.hub}
                            linkedAngles={pieceMoves.undocked.includes(piece.id)
                                ? []
                                : linkedAngles(entry.hex.coords, piece.playerId)}
                        />
                    {:else if piece.type === PieceType.Terraformer}
                        <TerraformerShape center={entry.center} {color} />
                    {:else if piece.type === PieceType.Relay}
                        <RelayShape center={entry.center} {color} />
                    {:else}
                        <FighterShape center={entry.center} {color} level={powerOf(piece)} />
                    {/if}
                </g>
            {/key}
        {/if}
    {/each}

    {#if ghostEntry && ghostPiece}
        {@const ghostColor = gameSession.colors.getPlayerUiColor(ghostPiece.playerId)}
        <g class="place-ghost" style="pointer-events: none;">
            {#if ghostPiece.type === PieceType.Probe}
                <ProbeShape
                    center={ghostEntry.center}
                    color={ghostColor}
                    level={ghostPiece.level ?? PieceLevel.Two}
                />
            {:else if ghostPiece.type === PieceType.Station}
                <StationShape
                    center={ghostEntry.center}
                    color={ghostColor}
                    hub={ghostPiece.hub}
                />
            {:else if ghostPiece.type === PieceType.Terraformer}
                <TerraformerShape center={ghostEntry.center} color={ghostColor} />
            {:else if ghostPiece.type === PieceType.Relay}
                <RelayShape center={ghostEntry.center} color={ghostColor} />
            {:else}
                <FighterShape
                    center={ghostEntry.center}
                    color={ghostColor}
                    level={powerOf(ghostPiece)}
                />
            {/if}
        </g>
    {/if}

    {#each ghosts as ghost (ghost.origin.q + ',' + ghost.origin.r)}
        {@const previewing =
            tilePreviewOrigin && sameCoordinates(tilePreviewOrigin, ghost.origin)}
        <g
            role="button"
            tabindex="-1"
            class="cursor-pointer"
            onpointerdown={(event) => (lastPointerType = event.pointerType)}
            onclick={() =>
                gameSession.onTileOriginClick(ghost.origin, lastPointerType === 'touch')}
            onkeydown={(event) =>
                event.key === 'Enter' && gameSession.onTileOriginClick(ghost.origin)}
            onpointerenter={(event) => {
                if (event.pointerType !== 'touch') hoveredTileOrigin = ghost.origin
            }}
            onpointerleave={(event) => {
                if (event.pointerType !== 'touch') hoveredTileOrigin = undefined
            }}
        >
            {#each ghost.hexes as hex, index (hex.coords.q + ',' + hex.coords.r)}
                {@const isPlanet = index === gameSession.pendingTile?.planetOffset}
                <polygon
                    points={hex.points}
                    fill={previewing
                        ? isPlanet && gameSession.pendingTile
                            ? PLANET_FILL[gameSession.pendingTile.color]
                            : '#1d2942'
                        : '#ffffff'}
                    fill-opacity={previewing ? (isPlanet ? 0.5 : 0.9) : index === 0 ? 0.14 : 0.03}
                    stroke="#8fb6ff"
                    stroke-opacity={previewing ? 0.9 : index === 0 ? 0.7 : 0.15}
                    stroke-width={previewing ? 4 : 2}
                    stroke-dasharray={previewing ? '' : '6 5'}
                />
            {/each}
        </g>
    {/each}


    {#each shownRoutes as route (routeKey(route))}
        {@const run = routeRun(route.planets[0], route.planets[1])}
        {@const color = gameSession.colors.getPlayerUiColor(route.playerId)}
        <g pointer-events="none">
            <line
                x1={run.x1}
                y1={run.y1}
                x2={run.x2}
                y2={run.y2}
                stroke={color}
                stroke-width="3"
                stroke-linecap="round"
                stroke-dasharray="9 8"
                class="route-line"
            />
            {#each route.planets as end (end.q + ',' + end.r)}
                {@const at = hexGeometry(end).center}
                <circle cx={at.x} cy={at.y} r={ROUTE_RING_RADIUS} fill="none" stroke={color} stroke-width="2.5" />
            {/each}
        </g>
    {/each}


    <!-- A probe in clear sight of its own station is safe from fighters (rules.md, Relay). -->
    {#each shownRelayLines as relay (relay.station.q + ',' + relay.station.r + '>' + relay.probe.q + ',' + relay.probe.r)}
        {@const run = relayRun(relay.station, relay.probe)}
        <line
            x1={run.x1}
            y1={run.y1}
            x2={run.x2}
            y2={run.y2}
            stroke={gameSession.colors.getPlayerUiColor(relay.playerId)}
            stroke-width="2.5"
            stroke-opacity="0.85"
            stroke-dasharray="6 7"
            stroke-linecap="round"
            class="relay-line"
            pointer-events="none"
        />
    {/each}

    {#each shownControlEdges as edge (edge.planet.q + ',' + edge.planet.r + '>' + edge.from.q + ',' + edge.from.r)}
        {@const edgeColor = gameSession.colors.getPlayerUiColor(edge.playerId)}

        {#if SHOW_CONTROL_WAVE}
            {@const edgeLine = sharedEdge(edge.planet, edge.from)}
            {#if edgeLine}
                <path
                    d={waveBetween(edgeLine.start, edgeLine.end, 4.5, 15)}
                    fill="none"
                    stroke={edgeColor}
                    stroke-width="3.5"
                    stroke-linecap="round"
                    stroke-opacity="0.95"
                    pointer-events="none"
                />
            {/if}
        {/if}

        {#if SHOW_CONTROL_DOTS}
            {#each controlDots(edge.from, edge.planet) as dot, i (i)}
                <circle
                    cx={dot.x}
                    cy={dot.y}
                    r="3"
                    fill={edgeColor}
                    class="control-dot"
                    style="animation-delay: {dot.delay}s; animation-duration: {CONTROL_DOT_CYCLE}s;"
                    pointer-events="none"
                />
            {/each}
        {/if}
    {/each}

    {#if ghostEntry}
        {#each previewTargets as target (target.q + ',' + target.r)}
            {@const chevrons = chevronsBetween(ghostEntry.hex.coords, target)}
            {@render chevronPulse(chevrons, ATTACK_RED, 0.55)}
        {/each}

        {#each previewProbeDestinations as target (target.q + ',' + target.r)}
            {@const chevrons = chevronsBetween(ghostEntry.hex.coords, target)}
            {@render chevronPulse(chevrons, SURVEY_BLUE, 0.7)}
        {/each}
    {/if}

    {#each gameSession.explorationChoice?.to ?? [] as target (target.q + ',' + target.r)}
        {@const chevrons = chevronsBetween(gameSession.explorationChoice!.from, target)}
        {@render chevronPulse(chevrons, SURVEY_BLUE, 1)}
    {/each}

    <!-- No per-target delay: every target's chevrons pulse together. -->
    {#each gameSession.attackChoice?.to ?? [] as target (target.q + ',' + target.r)}
        {@const chevrons = chevronsBetween(gameSession.attackChoice!.from, target)}
        {@render chevronPulse(chevrons, ATTACK_RED, 1)}
    {/each}

    <!-- Drawn about the origin so BlastAnimator scales each part about the blast. -->
    {#each blasts.blasts as entry (entry.key)}
        <g transform="translate({entry.at.x} {entry.at.y})" pointer-events="none">
            <g use:registerElement={{ registry: blasts.elements, key: entry.key }}>
                <circle
                    data-blast="flash"
                    r="16"
                    fill={entry.destroyed ? '#ffd166' : '#ffe9a8'}
                    opacity="0"
                />
                <circle
                    data-blast="ring"
                    r="24"
                    fill="none"
                    stroke="#ff2f2f"
                    stroke-width="5"
                    opacity="0"
                />
                {#if entry.destroyed}
                    <g data-blast="sparks" opacity="0">
                        {#each [0, 45, 90, 135, 180, 225, 270, 315] as angle (angle)}
                            <line
                                x1="14"
                                y1="0"
                                x2="30"
                                y2="0"
                                stroke="#ffd166"
                                stroke-width="4"
                                stroke-linecap="round"
                                transform="rotate({angle})"
                            />
                        {/each}
                    </g>
                {/if}
            </g>
        </g>
    {/each}

    {#each scoreFloats.floats as entry (entry.key)}
        <g transform="translate({entry.at.x} {entry.at.y})" pointer-events="none">
            <g use:registerElement={{ registry: scoreFloats.elements, key: entry.key }} opacity="0">
                <text
                    text-anchor="middle"
                    class="text-[34px] font-bold"
                    fill={gameSession.colors.getPlayerUiColor(entry.playerId)}
                    stroke="#0a0f1c"
                    stroke-width="6"
                    paint-order="stroke"
                >
                    +{entry.points}
                </text>
                <text y="20" text-anchor="middle" class="text-[15px] font-semibold fill-white/80">
                    {entry.caption}
                </text>
            </g>
        </g>
    {/each}

    <!-- Drawn here rather than with each station: a neighbouring hex fill would cover half a girder. -->
    {#each gameSession.stationTubes as tube (stationTubeKey(tube))}
        {@const color = gameSession.colors.getPlayerUiColor(tube.playerId)}
        {@const ends = trussEnds(
            hexGeometry(tube.from).center,
            hexGeometry(tube.to).center,
            tube.fromHub,
            tube.toHub
        )}
        <g use:registerElement={{ registry: trussGrowth.girders, key: stationTubeKey(tube) }}>
            <TrussGirder start={ends.start} end={ends.end} {color} />
        </g>
    {/each}

    <!-- The visible board still holds the state before the action, so these are drawn here. -->
    {#each trussGrowth.arriving as station (station.coords.q + ',' + station.coords.r)}
        <StationShape
            center={hexGeometry(station.coords).center}
            color={gameSession.colors.getPlayerUiColor(station.playerId)}
            hub={station.hub}
            linkedAngles={linkedAngles(station.coords, station.playerId)}
        />
    {/each}
    {#each trussGrowth.growing as truss (truss.key)}
        {@const color = gameSession.colors.getPlayerUiColor(truss.playerId)}
        <clipPath id="truss-grow-{truss.key}">
            <rect
                use:registerElement={{ registry: trussGrowth.clips, key: truss.key }}
                x={-CLIP_OVERREACH}
                y="-8"
                width="0"
                height="16"
                transform="translate({truss.start.x} {truss.start.y}) rotate({truss.degrees})"
            />
        </clipPath>
        <g clip-path="url(#truss-grow-{truss.key})">
            <TrussGirder start={truss.girder.start} end={truss.girder.end} {color} />
        </g>
    {/each}

    {#each gameSession.sightLines as line, index (line.playerId + index)}
        {@const color = gameSession.colors.getPlayerUiColor(line.playerId)}
        <path
            d={wavePath(line.from, line.to)}
            fill="none"
            stroke={color}
            stroke-opacity="0.35"
            stroke-width="9"
            stroke-linecap="round"
        />
        <path
            class="beam"
            d={wavePath(line.from, line.to)}
            fill="none"
            stroke={color}
            stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray="14 12"
        />
    {/each}

    <!-- Popups last, so nothing on the board is drawn over them. -->
    {#each shownTechnology ? [shownTechnology] : [] as shown (shown.key)}
        {@const width = 300}
        {@const lines = wrap(technologyAbility(shown.card), 34)}
        {@const category = TECHNOLOGY_CATEGORY_INFO[TECHNOLOGY_CATEGORY[shown.card.effect]]}
        {@const height = 66 + lines.length * 20}
        {@const box = popupPosition(shown.center, width, height)}
        {@const x = box.x}
        {@const y = box.y}
        <g pointer-events="none">
            <rect
                {x}
                {y}
                {width}
                {height}
                rx="10"
                fill="#0d1424"
                fill-opacity="0.9"
                stroke="#8fb6ff"
                stroke-width="2"
            />
            <text
                x={x + 16}
                y={y + 22}
                fill={PLANET_FILL[category.color]}
                class="text-[11px] font-semibold uppercase tracking-[0.12em]"
            >
                {category.name}
            </text>
            <text x={x + 16} y={y + 44} class="fill-white text-[19px] font-bold">
                {technologyName(shown.card)}
            </text>
            {#each lines as line, index (index)}
                <text x={x + 16} y={y + 70 + index * 20} class="fill-white/80 text-[15px]">
                    {line}
                </text>
            {/each}
        </g>
    {/each}

    {#each shownPlanetKind ? [shownPlanetKind] : [] as shown (shown.key)}
        {@const width = 300}
        {@const height = 64}
        {@const box = popupPosition(shown.center, width, height)}
        <g pointer-events="none">
            <rect
                x={box.x}
                y={box.y}
                {width}
                {height}
                rx="10"
                fill="#0d1424"
                fill-opacity="0.9"
                stroke="#8fb6ff"
                stroke-width="2"
            />
            <text
                x={box.x + 16}
                y={box.y + 27}
                fill={PLANET_FILL[shown.category.color]}
                class="text-[19px] font-bold"
            >
                {shown.category.name}
            </text>
            <text x={box.x + 16} y={box.y + 50} class="fill-white/80 text-[15px]">
                {shown.category.description}
            </text>
        </g>
    {/each}

    {#if hoveredPip}
        {@const at = hexGeometry(hoveredPip.planet).center}
        {@const label = `${shownRoutes.length > 1 ? `${shownRoutes.length} trade routes` : 'Trade route'} · joined by ${gameSession.getPlayerName(hoveredPip.playerId)}`}
        {@const width = label.length * 8.6 + 24}
        {@const box = popupPosition(at, width, 32)}
        <g pointer-events="none">
            <rect x={box.x} y={box.y} {width} height="32" rx="8" fill="#0d1424" fill-opacity="0.9" stroke="#8fb6ff" stroke-width="2" />
            <text x={box.x + 12} y={box.y + 21} class="fill-white text-[15px]">{label}</text>
        </g>
    {/if}
</svg>

<style>
    /* Hexes are tabindex="-1" buttons, so a focus ring only leaves a stray box after a click. */
    svg :global([role='button']:focus) {
        outline: none;
    }

    /* A pending claim's beam of light breathes gently. */
    @keyframes uplink-beam-frames {
        from {
            opacity: 0.65;
        }
        to {
            opacity: 1;
        }
    }

    .uplink-beam {
        animation: uplink-beam-frames 2.2s ease-in-out infinite alternate;
    }

    @media (prefers-reduced-motion: reduce) {
        .uplink-beam {
            animation: none;
        }
    }

    /* A hovered route's dashes drift slowly along it. */
    @keyframes route-line-frames {
        to {
            stroke-dashoffset: -17;
        }
    }

    .route-line {
        animation: route-line-frames 2.5s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
        .route-line {
            animation: none;
        }
    }

    @keyframes orbit-spin {
        to {
            transform: rotate(360deg);
        }
    }

    .orbit {
        transform-box: view-box;
        animation: orbit-spin 40s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
        .orbit {
            animation: none;
        }
    }

    /* The dashes run from the station to the probe it relays. */
    @keyframes relay-line-frames {
        to {
            stroke-dashoffset: -26;
        }
    }

    .relay-line {
        animation: relay-line-frames 1.2s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
        .relay-line {
            animation: none;
        }
    }

    /* Use the `animation` shorthand: Svelte rewrites scoped @keyframes names only there. */
    @keyframes control-dot-frames {
        0% {
            opacity: 0.18;
        }
        10% {
            opacity: 1;
        }
        38% {
            opacity: 0.18;
        }
        100% {
            opacity: 0.18;
        }
    }

    /* `backwards` holds each dot at its dim first keyframe through its staggered delay. */
    .control-dot {
        animation: control-dot-frames 1.5s ease-out infinite backwards;
    }

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

    @keyframes flow {
        to {
            stroke-dashoffset: -52;
        }
    }

    .beam {
        animation: flow 1.6s linear infinite;
    }

    /* Chevrons push toward the target, fade, and start again. */
    @keyframes chevron-pulse-frames {
        0% {
            transform: translateX(-5px);
            opacity: 0.25;
        }
        55% {
            opacity: 1;
        }
        100% {
            transform: translateX(6px);
            opacity: 0;
        }
    }

    .chevron-pulse {
        animation: chevron-pulse-frames 1.1s ease-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
        .chevron-pulse {
            animation: none;
        }
    }
</style>
