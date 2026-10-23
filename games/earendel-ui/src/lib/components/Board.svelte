<script lang="ts">
    import { onMount } from 'svelte'
    import type { AxialCoordinates } from '@tabletop/common'
    import {
        HexKind,
        type Hex,
        PieceLevel,
        PieceType,
        PlanetColor,
        hexKey,
        powerOf,
        sameHex,
        technologyAbility,
        technologyName,
        tileFootprint
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexGeometry, verticesToPoints } from '$lib/utils/hexDefinition.js'
    import { trussEnds } from '$lib/utils/stationGeometry.js'
    import StationShape from './StationShape.svelte'
    import TrussGirder from './TrussGirder.svelte'
    import FighterShape from './FighterShape.svelte'
    import ProbeShape from './ProbeShape.svelte'
    import { TrussGrowthAnimator } from '$lib/animators/trussGrowthAnimator.svelte.js'
    import { animatePiece, PieceMoveAnimator } from '$lib/animators/pieceMoveAnimator.svelte.js'
    import { ScoreFloatAnimator } from '$lib/animators/scoreFloatAnimator.svelte.js'
    import { BlastAnimator } from '$lib/animators/blastAnimator.svelte.js'
    import { registerElement } from '$lib/animators/elementRegistry.js'
    import { stationTubeKey } from '$lib/utils/stationLinks.js'

    let gameSession = getGameSession()

    // Cool colours only: every player colour is warm (see EarendelColors).
    const PLANET_FILL: Record<PlanetColor, string> = {
        [PlanetColor.Periwinkle]: '#859bfd',
        [PlanetColor.Aqua]: '#22d6fd',
        [PlanetColor.Mint]: '#9aff93',
        [PlanetColor.Teal]: '#1e948d',
        [PlanetColor.Violet]: '#9e58da'
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
            inspected = inspected && sameHex(inspected, coords) ? undefined : coords
        }
        await gameSession.onBoardClick(coords, touch)
    }

    let ghostPiece = $derived(gameSession.isPlacing ? gameSession.pieceToPlace : undefined)
    let showGhost = $derived(ghostPiece !== undefined)

    let ghostEntry = $derived.by(() => {
        const at = placementFocus
        if (!showGhost || !at || !gameSession.isHighlighted(at)) return undefined
        return placed.find((entry) => sameHex(entry.hex.coords, at))
    })

    let previewTargets: AxialCoordinates[] = $derived(
        placementFocus ? gameSession.previewTargetsFor(placementFocus) : []
    )

    let previewProbeDestinations: AxialCoordinates[] = $derived(
        placementFocus ? gameSession.previewProbeDestinationsFor(placementFocus) : []
    )

    let shownControlEdges = $derived(focused ? gameSession.controlEdgesFor(focused) : [])

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

    function linkedAngles(coords: AxialCoordinates, playerId: string): number[] {
        return anglesTo(coords, gameSession.linkedStationNeighbors(coords, playerId))
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

    function anglesTo(coords: AxialCoordinates, neighbors: AxialCoordinates[]): number[] {
        const from = hexGeometry(coords).center
        return neighbors.map((neighbor) => {
            const to = hexGeometry(neighbor).center
            return Math.atan2(to.y - from.y, to.x - from.x)
        })
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

    onMount(() => {
        const animators = [pieceMoves, trussGrowth, blasts, scoreFloats]
        const listeners = animators.map((animator) => animator.onGameStateChange.bind(animator))
        for (const listener of listeners) gameSession.addGameStateChangeListener(listener)
        return () => {
            for (const listener of listeners) gameSession.removeGameStateChangeListener(listener)
        }
    })

    let shownTechnology = $derived.by(() => {
        const coords = gameSession.pinnedPlanet ?? focused
        if (!coords) return undefined

        const entry = placed.find((candidate) => sameHex(candidate.hex.coords, coords))
        if (!entry?.hex.technology) return undefined

        return {
            key: `${coords.q},${coords.r}`,
            card: entry.hex.technology,
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

    // pathLength 100 lets one dash animation fly every arc at the same rate.
    const ARC_BOW = 34

    function attackArc(from: AxialCoordinates, to: AxialCoordinates) {
        const start = hexGeometry(from).center
        const end = hexGeometry(to).center

        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy) || 1

        let nx = -dy / length
        let ny = dx / length
        if (ny > 0) {
            nx = -nx
            ny = -ny
        }

        const control = {
            x: (start.x + end.x) / 2 + nx * ARC_BOW,
            y: (start.y + end.y) / 2 + ny * ARC_BOW
        }

        return `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`
    }

    function reachPointer(from: AxialCoordinates, to: AxialCoordinates) {
        const start = hexGeometry(from).center
        const end = hexGeometry(to).center

        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy) || 1
        const ux = dx / length
        const uy = dy / length

        const at = { x: start.x + ux * length * 0.58, y: start.y + uy * length * 0.58 }
        const size = 15

        const tip = { x: at.x + ux * size, y: at.y + uy * size }
        const base = { x: at.x - ux * size * 0.6, y: at.y - uy * size * 0.6 }
        const wing = { x: -uy * size * 0.7, y: ux * size * 0.7 }

        return {
            points: [
                `${tip.x},${tip.y}`,
                `${base.x + wing.x},${base.y + wing.y}`,
                `${base.x - wing.x},${base.y - wing.y}`
            ].join(' '),
            nudge: { x: ux * 9, y: uy * 9 }
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
        return planet !== undefined && sameHex(planet, coords)
    }
</script>

<svg {viewBox} class="w-[1200px] max-w-full select-none" role="presentation">
    {#each placed as entry (entry.hex.tileId + entry.hex.coords.q + ',' + entry.hex.coords.r)}
        {@const hex = entry.hex}
        {@const highlighted = gameSession.isHighlighted(hex.coords)}
        {@const planetColor = hex.color ? PLANET_FILL[hex.color] : '#1b2436'}

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
            <polygon
                points={entry.points}
                fill={hex.kind === HexKind.Planet ? planetColor : '#141c2e'}
                fill-opacity={hex.kind === HexKind.Planet ? 0.42 : 0.5}
                stroke="#2b3752"
                stroke-width="2"
            />
            {#if hex.kind === HexKind.Planet}
                <!-- Inset so a neighbour drawn later cannot paint over half of the line. -->
                <polygon
                    points={insetPoints(hex.coords, 2.5)}
                    fill="none"
                    stroke={planetColor}
                    stroke-width="3"
                    stroke-opacity="0.85"
                    stroke-linejoin="round"
                />
            {/if}

            {#if hex.kind === HexKind.Planet}
                {@const bodyOpacity = hex.explored ? 1 : 0.45}
                {@const dash = hex.explored ? '' : '5 4'}
                {@const spin = `transform-box: view-box; transform-origin: ${entry.center.x}px ${entry.center.y}px;`}

                {#if hex.color === PlanetColor.Mint}
                    <!-- Drawn behind the body here and again in front at partial opacity. -->
                    <ellipse
                        cx={entry.center.x}
                        cy={entry.center.y}
                        rx="43"
                        ry="13"
                        fill="none"
                        stroke={planetColor}
                        stroke-width="5"
                        stroke-opacity={hex.explored ? 0.9 : 0.4}
                        transform="rotate(-20 {entry.center.x} {entry.center.y})"
                    />
                {/if}

                {#if hex.color === PlanetColor.Aqua}
                    <g class="planet-binary" style={spin}>
                        <circle
                            cx={entry.center.x - 15}
                            cy={entry.center.y}
                            r="16"
                            fill={planetColor}
                            fill-opacity={bodyOpacity}
                            stroke={planetColor}
                            stroke-width="3"
                            stroke-dasharray={dash}
                        />
                        <circle
                            cx={entry.center.x + 15}
                            cy={entry.center.y}
                            r="16"
                            fill={planetColor}
                            fill-opacity={bodyOpacity}
                            stroke={planetColor}
                            stroke-width="3"
                            stroke-dasharray={dash}
                        />
                    </g>
                {:else}
                    <circle
                        cx={entry.center.x}
                        cy={entry.center.y}
                        r="27"
                        fill={planetColor}
                        fill-opacity={bodyOpacity}
                        stroke={planetColor}
                        stroke-width="3"
                        stroke-dasharray={dash}
                    />
                {/if}

                {#if hex.color === PlanetColor.Teal}
                    <circle
                        cx={entry.center.x}
                        cy={entry.center.y}
                        r="27"
                        fill="none"
                        stroke={planetColor}
                        stroke-width="6"
                        class="planet-aura"
                        style={spin}
                    />
                    <circle
                        cx={entry.center.x}
                        cy={entry.center.y}
                        r="27"
                        fill="none"
                        stroke={planetColor}
                        stroke-width="3"
                        class="planet-aura planet-aura-late"
                        style={spin}
                    />
                {/if}

                {#if hex.color === PlanetColor.Periwinkle}
                    <g class="planet-moon" style={spin}>
                        <circle
                            cx={entry.center.x + 40}
                            cy={entry.center.y}
                            r="7"
                            fill={planetColor}
                            fill-opacity={hex.explored ? 1 : 0.5}
                        />
                    </g>
                {/if}

                {#if hex.color === PlanetColor.Violet}
                    <clipPath id="planet-clip-{hex.coords.q},{hex.coords.r}">
                        <circle cx={entry.center.x} cy={entry.center.y} r="27" />
                    </clipPath>
                    <g clip-path="url(#planet-clip-{hex.coords.q},{hex.coords.r})">
                        <g class="planet-phase" style={spin}>
                            <circle
                                cx={entry.center.x + 19}
                                cy={entry.center.y}
                                r="26"
                                fill="#0d1424"
                                fill-opacity={hex.explored ? 0.72 : 0.4}
                            />
                        </g>
                    </g>
                {/if}
                {@const claimant = gameSession.claimOn(hex.coords)}
                {#if claimant}
                    {@const hx = entry.center.x - 30}
                    {@const hy = entry.center.y + 20}
                    {@const claimColor = gameSession.colors.getPlayerUiColor(claimant)}
                    <g class="claim-glass" pointer-events="none">
                        <path
                            d="M {hx - 6} {hy - 9} L {hx + 6} {hy - 9} L {hx} {hy} Z"
                            fill={claimColor}
                            fill-opacity="0.9"
                        />
                        <path
                            d="M {hx - 6} {hy + 9} L {hx + 6} {hy + 9} L {hx} {hy} Z"
                            fill={claimColor}
                            fill-opacity="0.45"
                        />
                        <line
                            x1={hx - 7}
                            y1={hy - 10}
                            x2={hx + 7}
                            y2={hy - 10}
                            stroke={claimColor}
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                        <line
                            x1={hx - 7}
                            y1={hy + 10}
                            x2={hx + 7}
                            y2={hy + 10}
                            stroke={claimColor}
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                    </g>
                {/if}

                {#if hex.technology}
                    <circle
                        cx={entry.center.x}
                        cy={entry.center.y}
                        r="9"
                        fill="#ffffff"
                        fill-opacity="0.9"
                    />
                    <circle
                        cx={entry.center.x}
                        cy={entry.center.y}
                        r="15"
                        fill="none"
                        stroke="#ffffff"
                        stroke-opacity="0.55"
                        stroke-width="2"
                    />
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

            {#if gameSession.movingFrom && sameHex(gameSession.movingFrom, hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#ffd479"
                    fill-opacity="0.16"
                    stroke="#ffd479"
                    stroke-width="5"
                />
            {/if}

            {#if gameSession.feintFrom && sameHex(gameSession.feintFrom, hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#c4a2ff"
                    fill-opacity="0.16"
                    stroke="#c4a2ff"
                    stroke-width="5"
                />
            {/if}

            {#if gameSession.wormholeFrom && sameHex(gameSession.wormholeFrom, hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#7fe3d4"
                    fill-opacity="0.16"
                    stroke="#7fe3d4"
                    stroke-width="5"
                />
            {/if}

            {#if gameSession.downloadFrom && sameHex(gameSession.downloadFrom, hex.coords)}
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
                            linkedAngles={linkedAngles(entry.hex.coords, piece.playerId)}
                        />
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
                    linkedAngles={linkedAngles(ghostEntry.hex.coords, ghostPiece.playerId)}
                />
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
            tilePreviewOrigin && sameHex(tilePreviewOrigin, ghost.origin)}
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

    {#each shownTechnology ? [shownTechnology] : [] as shown (shown.key)}
        {@const width = 300}
        {@const lines = wrap(technologyAbility(shown.card), 34)}
        {@const height = 52 + lines.length * 20}
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
                fill-opacity="0.97"
                stroke="#8fb6ff"
                stroke-width="2"
            />
            <text x={x + 16} y={y + 30} class="fill-white text-[19px] font-bold">
                {technologyName(shown.card)}
            </text>
            {#each lines as line, index (index)}
                <text x={x + 16} y={y + 56 + index * 20} class="fill-white/80 text-[15px]">
                    {line}
                </text>
            {/each}
        </g>
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
        {#each previewTargets as target, index (target.q + ',' + target.r)}
            {@const path = attackArc(ghostEntry.hex.coords, target)}
            <path
                d={path}
                fill="none"
                stroke="#ff2f2f"
                stroke-opacity="0.53"
                stroke-width="3.75"
                stroke-linecap="round"
                stroke-dasharray="7 6"
                pointer-events="none"
            />
        {/each}

        {#each previewProbeDestinations as target, index (target.q + ',' + target.r)}
            {@const pointer = reachPointer(ghostEntry.hex.coords, target)}
            <polygon
                points={pointer.points}
                fill="#e8f0ff"
                fill-opacity="0.45"
                class="reach-pointer"
                style="--nudge-x: {pointer.nudge.x}px; --nudge-y: {pointer.nudge.y}px; animation-delay: {index *
                    180}ms"
                pointer-events="none"
            />
        {/each}
    {/if}

    {#each gameSession.explorationChoice?.to ?? [] as target, index (target.q + ',' + target.r)}
        {@const pointer = reachPointer(gameSession.explorationChoice!.from, target)}
        <polygon
            points={pointer.points}
            fill="#e8f0ff"
            class="reach-pointer"
            style="--nudge-x: {pointer.nudge.x}px; --nudge-y: {pointer.nudge.y}px; animation-delay: {index *
                180}ms"
            pointer-events="none"
        />
    {/each}

    {#each gameSession.attackChoice?.to ?? [] as target, index (target.q + ',' + target.r)}
        {@const path = attackArc(gameSession.attackChoice!.from, target)}
        {@const delay = `${index * 200}ms`}
        <g pointer-events="none">
            <path
                d={path}
                pathLength="100"
                fill="none"
                stroke="#ff2f2f"
                stroke-opacity="0.45"
                stroke-width="5"
                stroke-linecap="round"
                stroke-dasharray="100"
                class="missile-trail"
                style="animation-delay: {delay}"
            />
            <path
                d={path}
                pathLength="100"
                fill="none"
                stroke="#ff2f2f"
                stroke-width="11"
                stroke-linecap="round"
                stroke-dasharray="13 200"
                class="missile"
                style="animation-delay: {delay}"
            />
        </g>
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

    {#if focused}
        {@const focusedHex = focused}
        {@const focusedColor = placed.find((entry) => sameHex(entry.hex.coords, focusedHex))?.hex
            .color}
        {@const pairColor = focusedColor ? PLANET_FILL[focusedColor] : '#dce6ff'}
        {#each gameSession.planetPairsFrom(focusedHex) as pair, index (index)}
            {@const from = hexGeometry(focusedHex).center}
            {@const to = hexGeometry(pair.to).center}
            {@const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }}
            <g pointer-events="none">
                <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={pair.spent ? '#dce6ff' : pairColor}
                    stroke-opacity={pair.spent ? 0.16 : 0.55}
                    stroke-width={pair.spent ? 2 : 3}
                    stroke-linecap="round"
                    stroke-dasharray={pair.spent ? '3 9' : '2 7'}
                />
                {#if pair.spent}
                    <g
                        stroke="#dce6ff"
                        stroke-opacity="0.5"
                        stroke-width="2.5"
                        stroke-linecap="round"
                    >
                        <line x1={mid.x - 7} y1={mid.y - 7} x2={mid.x + 7} y2={mid.y + 7}></line>
                        <line x1={mid.x + 7} y1={mid.y - 7} x2={mid.x - 7} y2={mid.y + 7}></line>
                    </g>
                {/if}
            </g>
        {/each}
    {/if}

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
            linkedAngles={anglesTo(station.coords, station.linked)}
        />
    {/each}
    {#each trussGrowth.growing as truss (truss.key)}
        {@const color = gameSession.colors.getPlayerUiColor(truss.playerId)}
        <clipPath id="truss-grow-{truss.key}">
            <rect
                use:registerElement={{ registry: trussGrowth.clips, key: truss.key }}
                x="0"
                y="-8"
                width="0"
                height="16"
                transform="translate({truss.start.x} {truss.start.y}) rotate({truss.degrees})"
            />
        </clipPath>
        <g clip-path="url(#truss-grow-{truss.key})">
            <TrussGirder start={truss.start} end={truss.end} {color} />
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
</svg>

<style>
    /* Hexes are tabindex="-1" buttons, so a focus ring only leaves a stray box after a click. */
    svg :global([role='button']:focus) {
        outline: none;
    }

    @keyframes claim-glass-frames {
        0%,
        44% {
            transform: rotate(0deg);
        }
        50%,
        94% {
            transform: rotate(180deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .claim-glass {
        transform-box: fill-box;
        transform-origin: center;
        animation: claim-glass-frames 6s ease-in-out infinite;
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

    @keyframes planet-revolve {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .planet-binary {
        animation: planet-revolve 28s linear infinite;
    }

    .planet-moon {
        animation: planet-revolve 14s linear infinite;
    }

    .planet-phase {
        animation: planet-revolve 44s linear infinite;
    }

    @keyframes planet-breathe {
        0%,
        100% {
            transform: scale(1);
            stroke-opacity: 0.5;
        }
        50% {
            transform: scale(1.42);
            stroke-opacity: 0;
        }
    }

    .planet-aura {
        animation: planet-breathe 4.2s ease-out infinite;
    }

    .planet-aura-late {
        animation-delay: 2.1s;
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

    @keyframes fly-trail {
        0% {
            stroke-dashoffset: 100;
            opacity: 1;
        }
        70% {
            stroke-dashoffset: 0;
            opacity: 1;
        }
        88%,
        100% {
            stroke-dashoffset: 0;
            opacity: 0;
        }
    }

    @keyframes fly-missile {
        0% {
            stroke-dashoffset: 13;
            opacity: 1;
        }
        70% {
            stroke-dashoffset: -87;
            opacity: 1;
        }
        75%,
        100% {
            stroke-dashoffset: -87;
            opacity: 0;
        }
    }

    .missile-trail {
        animation: fly-trail 1.6s linear infinite;
    }

    .missile {
        animation: fly-missile 1.6s linear infinite;
    }

    @keyframes point {
        0%,
        100% {
            transform: translate(0, 0);
            opacity: 0.5;
        }
        50% {
            transform: translate(var(--nudge-x), var(--nudge-y));
            opacity: 1;
        }
    }

    .reach-pointer {
        animation: point 1.4s ease-in-out infinite;
    }
</style>
