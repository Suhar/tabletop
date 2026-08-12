<script lang="ts">
    import { onMount } from 'svelte'
    import type { AxialCoordinates, GameAction } from '@tabletop/common'
    import {
        HexKind,
        type Hex,
        PieceType,
        PlanetColor,
        type AttackPiece,
        isAttackPiece,
        isPlacePiece,
        type PlacePiece,
        sameHex,
        technologyAbility,
        technologyName,
        tileFootprint
    } from '@tabletop/earendel'
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

    // Where a tile could be laid. These sit OFF the current board, so they have to be part
    // of the view or they would be drawn outside it.
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

    // The board is generated and can grow mid-game, so its extent isn't known ahead of time -
    // the view has to be measured from the hexes that actually exist, plus anywhere a tile
    // is currently being offered.
    //
    // Kept as numbers as well as a string, because anything drawn on top of the board - a
    // popup, say - has to be kept inside these bounds or the SVG simply clips it away.
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

    // What the fighter being placed could attack if it landed on the hovered hex. Shown before
    // the placement so the shot can be aimed rather than discovered afterwards.
    let previewTargets: AxialCoordinates[] = $derived(
        hovered ? gameSession.previewTargetsFor(hovered) : []
    )

    function isPreviewTarget(coords: AxialCoordinates): boolean {
        return previewTargets.some((target) => sameHex(target, coords))
    }

    // A sine wave along the segment between two stations. Sampled rather than drawn with arcs
    // so the wavelength stays constant however long or however angled the line is.
    function wavePath(from: AxialCoordinates, to: AxialCoordinates): string {
        const start = hexGeometry(from).center
        const end = hexGeometry(to).center

        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        if (length === 0) return ''

        // Unit vectors along the line and across it.
        const ux = dx / length
        const uy = dy / length
        const px = -uy
        const py = ux

        const amplitude = 9
        const samples = Math.max(24, Math.round(length / 4))
        const waves = Math.max(2, Math.round(length / 46))

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

    // Points floating up from where they were earned. Each is removed when its animation has
    // run, so the list only ever holds what is on screen.
    type ScoreFloat = {
        id: number
        x: number
        y: number
        points: number
        caption: string
        color: string
    }

    let floats: ScoreFloat[] = $state([])
    let nextFloatId = 0

    const FLOAT_MS = 1700

    function float(coords: AxialCoordinates, points: number, caption: string, playerId: string) {
        const center = hexGeometry(coords).center
        const id = nextFloatId++

        floats.push({
            id,
            x: center.x,
            // Stacked, so two sources scored by one placement don't land on top of each other.
            y: center.y - floats.length * 30,
            points,
            caption,
            color: gameSession.colors.getPlayerUiColor(playerId)
        })

        setTimeout(() => {
            floats = floats.filter((entry) => entry.id !== id)
        }, FLOAT_MS)
    }

    // A shot landing. Destroyed and damaged look different on purpose: the same action does
    // both, and the board is where the difference should be legible.
    type Blast = { id: number; x: number; y: number; destroyed: boolean }

    let blasts: Blast[] = $state([])
    let nextBlastId = 0

    const BLAST_MS = 900

    function blast(coords: AxialCoordinates, destroyed: boolean) {
        const center = hexGeometry(coords).center
        const id = nextBlastId++

        blasts.push({ id, x: center.x, y: center.y, destroyed })
        setTimeout(() => {
            blasts = blasts.filter((entry) => entry.id !== id)
        }, BLAST_MS)
    }

    function showAttack(action: GameAction) {
        if (!isAttackPiece(action)) return

        const shot = action as AttackPiece
        // Nothing to show for a shot that was passed up.
        if (!shot.coords || shot.metadata?.declined) return

        blast(shot.coords, !shot.metadata?.damaged)
    }

    // Scoring is reported per source rather than as one total: a placement can be paid for its
    // station complex AND for a chain, and rolling those into a single number is exactly what
    // makes the jump hard to account for.
    function showScoring(action?: GameAction) {
        if (!action || !isPlacePiece(action)) return

        const placed = action as PlacePiece
        const playerId = placed.playerId

        if (placed.metadata?.stationGroupPoints) {
            float(placed.coords, placed.metadata.stationGroupPoints, 'complex', playerId)
        }
        for (const chain of placed.metadata?.chains ?? []) {
            float(placed.coords, chain.points, 'chain', playerId)
        }
    }

    onMount(() => {
        const listener = async ({ action }: { action?: GameAction }) => {
            // Not while scrubbing history: all of this happened long ago.
            if (!action || gameSession.isViewingHistory) return
            showScoring(action)
            showAttack(action)
        }

        gameSession.addGameStateChangeListener(listener)
        return () => gameSession.removeGameStateChangeListener(listener)
    })

    // Which planet's technology to show: the pinned one, else whatever is under the cursor.
    let shownTechnology = $derived.by(() => {
        const coords = gameSession.pinnedPlanet ?? hovered
        if (!coords) return undefined

        const entry = placed.find((candidate) => sameHex(candidate.hex.coords, coords))
        if (!entry?.hex.technology) return undefined

        return {
            key: `${coords.q},${coords.r}`,
            card: entry.hex.technology,
            center: entry.center
        }
    })

    // Beside the planet if it fits, otherwise on its other side, and kept inside the view
    // either way. The board is scaled to its viewBox, so anything hanging over the edge is not
    // squeezed in - it is cut off.
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

    // An arc from a fighter to something it could attack: the flight path of a missile.
    //
    // Attacker and target are always adjacent, so every arc spans the same short distance and
    // bows the same amount. The bow is biased towards the top of the screen, which reads as
    // lifting off the board rather than sliding across it.
    //
    // pathLength normalises the path to 100 units, so one dash animation flies any of them at
    // the same rate whichever way they point - and lets the missile and its trail be two dash
    // patterns on the same curve, which is what keeps the head exactly at the front.
    const ARC_BOW = 34

    function attackArc(from: AxialCoordinates, to: AxialCoordinates) {
        const start = hexGeometry(from).center
        const end = hexGeometry(to).center

        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy) || 1

        // Perpendicular, flipped so it always leans upward.
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

        // Right to the middle of the target hex: the missile is aimed at the piece, not at the
        // edge of the space it stands in.
        return `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`
    }

    // A triangle pointing from a probe at a planet it could explore, with the vector to nudge it
    // along as it pulses. Quieter than the missiles on purpose: exploring is an invitation,
    // firing is a threat.
    function reachPointer(from: AxialCoordinates, to: AxialCoordinates) {
        const start = hexGeometry(from).center
        const end = hexGeometry(to).center

        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy) || 1
        const ux = dx / length
        const uy = dy / length

        // Sat between the two, closer to the planet it is pointing at.
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
            // Pulses along its own direction, so the movement says which way it is pointing.
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
                {#if hex.technology}
                    <!-- A mark, not a label: the name and what it does are too much text for a
                         hex, so they go in a popup on hover or click instead. -->
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

            {#if gameSession.movingFrom && sameHex(gameSession.movingFrom, hex.coords)}
                <!-- Picked up, waiting for a destination. Click it again to put it back down. -->
                <polygon
                    points={entry.points}
                    fill="#ffd479"
                    fill-opacity="0.16"
                    stroke="#ffd479"
                    stroke-width="5"
                />
            {/if}

            {#if isExploringPlanet(hex.coords)}
                <polygon points={entry.points} fill="none" stroke="#ffffff" stroke-width="4" />
            {/if}

            {#if gameSession.isClosedToMe(hex.coords)}
                <!-- Shut to the probe in hand. Shown only while holding one, since the
                     blockade doesn't apply to anything else. -->
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

    <!-- Places a new tile could go. Each marker is the tile's origin hex; hovering shows the
         whole four-hex footprint, so it is clear what is about to land and where. -->
    {#each ghosts as ghost (ghost.origin.q + ',' + ghost.origin.r)}
        {@const previewing =
            gameSession.tilePreviewOrigin && sameHex(gameSession.tilePreviewOrigin, ghost.origin)}
        <g
            role="button"
            tabindex="-1"
            class="cursor-pointer"
            onclick={() => gameSession.placeTile(ghost.origin)}
            onkeydown={(event) => event.key === 'Enter' && gameSession.placeTile(ghost.origin)}
            onmouseenter={() => (gameSession.tilePreviewOrigin = ghost.origin)}
            onmouseleave={() => (gameSession.tilePreviewOrigin = undefined)}
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

    <!-- What a planet holds, on hover or once clicked. Drawn near the end so it sits above the
         board; the blockades below are drawn after it only because they are part of the map. -->
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

    <!-- Where a probe could explore: a triangle per planet, pulsing the way it points. -->
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

    <!-- Where a fighter could fire: a missile flying the arc, trail behind it, over and over
         until a target is picked or the shot is passed up. The missile and the trail are two
         dash patterns on the SAME curve, which is what keeps the head exactly at the front of
         what has been drawn - and follows the bend without any rotation maths. -->
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

    <!-- A shot landing. Everything is drawn centred on the origin and moved into place by the
         group's transform, so a CSS scale expands about the blast rather than about the board's
         top-left corner. -->
    {#each blasts as entry (entry.id)}
        <g transform="translate({entry.x} {entry.y})" pointer-events="none">
            <circle
                r="16"
                fill={entry.destroyed ? '#ffd166' : '#ffe9a8'}
                class={entry.destroyed ? 'blast-flash' : 'blast-flash blast-small'}
            />
            <circle
                r="24"
                fill="none"
                stroke="#ff2f2f"
                stroke-width="5"
                class={entry.destroyed ? 'blast-ring' : 'blast-ring blast-small'}
            />
            {#if entry.destroyed}
                <!-- Sparks only for a kill: a fighter that merely lost a level is still there. -->
                <g class="blast-sparks">
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
    {/each}

    <!-- Points drifting up from where they were earned. -->
    {#each floats as entry (entry.id)}
        <g class="score-float" pointer-events="none">
            <text
                x={entry.x}
                y={entry.y}
                text-anchor="middle"
                class="text-[34px] font-bold"
                fill={entry.color}
                stroke="#0a0f1c"
                stroke-width="6"
                paint-order="stroke"
            >
                +{entry.points}
            </text>
            <text
                x={entry.x}
                y={entry.y + 20}
                text-anchor="middle"
                class="text-[15px] font-semibold fill-white/80"
            >
                {entry.caption}
            </text>
        </g>
    {/each}

    <!-- Station blockades, drawn last so they read above the hexes they cross. Two stations
         of one player with clear space between them shut that space to everyone else's
         probes; anything else may be placed there, and doing so breaks the line. -->
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

    /* Light travelling along the wave, so a live blockade reads as active rather than drawn on. */
    .beam {
        animation: flow 1.6s linear infinite;
    }

    @keyframes rise {
        0% {
            transform: translateY(0);
            opacity: 0;
        }
        15% {
            opacity: 1;
        }
        70% {
            opacity: 1;
        }
        100% {
            transform: translateY(-70px);
            opacity: 0;
        }
    }

    .score-float {
        animation: rise 1.7s ease-out forwards;
    }

    /* The trail is drawn as the missile flies, then both clear and it fires again. */
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

    /* A single short dash sliding along the same curve: at 13 it sits just before the start, at
       -87 it has just arrived, so it is always at the head of the trail. */
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

    /* Staggered per target by an inline delay, so several shots don't fire in lockstep. */
    .missile-trail {
        animation: fly-trail 1.6s linear infinite;
    }

    .missile {
        animation: fly-missile 1.6s linear infinite;
    }

    /* One multiplier drives how big a blast gets, so the two sizes share the keyframes rather
       than relying on a static scale composing with an animated transform. */
    @keyframes flash {
        0% {
            transform: scale(calc(0.3 * var(--boom)));
            opacity: 1;
        }
        100% {
            transform: scale(calc(1.7 * var(--boom)));
            opacity: 0;
        }
    }

    @keyframes shock {
        0% {
            transform: scale(calc(0.25 * var(--boom)));
            opacity: 0.95;
        }
        100% {
            transform: scale(calc(2.3 * var(--boom)));
            opacity: 0;
        }
    }

    @keyframes sparks {
        0% {
            transform: scale(0.4);
            opacity: 1;
        }
        100% {
            transform: scale(1.9);
            opacity: 0;
        }
    }

    .blast-flash {
        --boom: 1;
        animation: flash 380ms ease-out forwards;
    }

    .blast-ring {
        --boom: 1;
        animation: shock 780ms ease-out forwards;
    }

    .blast-sparks {
        animation: sparks 620ms ease-out forwards;
    }

    /* A fighter knocked down a level gets a smaller, shorter blast than one destroyed. */
    .blast-small {
        --boom: 0.55;
        animation-duration: 320ms;
    }

    /* Nudged along its own direction, so the movement itself says which way it points. */
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
