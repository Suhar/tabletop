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
    // The bright stars, laid out once at module scope with a fixed hash rather than
    // Math.random: a starfield that re-rolled on every render would shimmer, and one seeded per
    // board would move whenever a tile was laid. Spread over a wide area in BOARD coordinates,
    // so growing the map reveals more sky rather than restretching the same sky.
    const TWINKLING_STARS = Array.from({ length: 46 }, (_unused, i) => {
        // Cheap deterministic hash - three different irrationals so x, y and phase don't
        // correlate and produce a diagonal line of stars.
        const frac = (n: number) => n - Math.floor(n)
        return {
            x: -1400 + frac(i * 0.7548776662) * 3400,
            y: -1100 + frac(i * 0.5698402909) * 2800,
            r: 1.4 + frac(i * 0.3819660113) * 1.3,
            delay: frac(i * 0.6180339887) * 6,
            duration: 3.4 + frac(i * 0.4142135624) * 3.6
        }
    })

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

    // The ship about to be placed, previewed on the hex under the cursor rather than announced
    // by lighting up every hex it could go on. Thirty pulsing hexes told the player where they
    // MAY place; a single ghost tells them what they ARE placing and where it will land, which
    // is the question actually being asked.
    //
    // Only while a ship is being placed: a tile placement, an exploration choice, a shot and a
    // technology step are all choices BETWEEN hexes, where the hexes themselves are the thing
    // to look at and there is no single piece to preview.
    let ghostPiece = $derived(
        gameSession.isPlacing ? gameSession.pieceToPlace : undefined
    )
    let showGhost = $derived(ghostPiece !== undefined)

    // Locked to the hovered hex, and only when that hex would actually accept the piece - a
    // ghost on an illegal hex would promise a placement the engine then refuses.
    let ghostEntry = $derived.by(() => {
        if (!showGhost || !hovered || !gameSession.isHighlighted(hovered)) return undefined
        return placed.find((entry) => sameHex(entry.hex.coords, hovered!))
    })

    // What the fighter being placed could attack if it landed on the hovered hex. Shown before
    // the placement so the shot can be aimed rather than discovered afterwards.
    let previewTargets: AxialCoordinates[] = $derived(
        hovered ? gameSession.previewTargetsFor(hovered) : []
    )

    function isPreviewTarget(coords: AxialCoordinates): boolean {
        return previewTargets.some((target) => sameHex(target, coords))
    }

    // The planets a probe would explore from the hovered hex. The fighter's equivalent is
    // previewTargets just above; between them they let a player see what a placement will DO
    // before committing, instead of finding out once it is too late to choose differently.
    let previewExplorables: AxialCoordinates[] = $derived(
        hovered ? gameSession.previewExplorablesFor(hovered) : []
    )

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
    <defs>
        <!-- The starfield is two tiled patterns rather than a few thousand circles. Tiling is
             what makes it free: the board's extent isn't known ahead of time and grows mid-game,
             so a generated field would either have to cover an enormous area or be regenerated
             (and jump) whenever a tile was laid.
             The two tile sizes are deliberately coprime - 211 and 317, both prime - so the
             combined pattern only truly repeats every 211x317 = 66,887px, which no game will
             ever pan far enough to notice. One tile alone would show its grid immediately. -->
        <pattern
            id="starfield-fine"
            x="0"
            y="0"
            width="211"
            height="211"
            patternUnits="userSpaceOnUse"
        >
            <circle cx="17" cy="43" r="1.1" fill="#dce6ff" fill-opacity="0.55" />
            <circle cx="88" cy="12" r="0.9" fill="#ffffff" fill-opacity="0.45" />
            <circle cx="146" cy="67" r="1.3" fill="#cfe0ff" fill-opacity="0.6" />
            <circle cx="192" cy="128" r="0.8" fill="#ffffff" fill-opacity="0.35" />
            <circle cx="59" cy="154" r="1.2" fill="#e6ecff" fill-opacity="0.5" />
            <circle cx="123" cy="196" r="0.9" fill="#ffffff" fill-opacity="0.4" />
            <circle cx="34" cy="103" r="0.7" fill="#bcd2ff" fill-opacity="0.35" />
            <circle cx="171" cy="27" r="1" fill="#ffffff" fill-opacity="0.45" />
        </pattern>

        <pattern
            id="starfield-coarse"
            x="0"
            y="0"
            width="317"
            height="317"
            patternUnits="userSpaceOnUse"
        >
            <circle cx="41" cy="87" r="1.8" fill="#ffffff" fill-opacity="0.65" />
            <circle cx="238" cy="41" r="1.5" fill="#dbe6ff" fill-opacity="0.55" />
            <circle cx="152" cy="231" r="2" fill="#ffffff" fill-opacity="0.6" />
            <circle cx="291" cy="188" r="1.4" fill="#cddfff" fill-opacity="0.5" />
            <circle cx="96" cy="289" r="1.6" fill="#ffffff" fill-opacity="0.55" />
        </pattern>

        <!-- A faint wash of colour, so deep space has some depth to it rather than being flat
             black behind the stars. Fixed in board coordinates, so it belongs to the map. -->
        <radialGradient id="nebula-a" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="#3d6bd4" stop-opacity="0.14" />
            <stop offset="100%" stop-color="#3d6bd4" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="nebula-b" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="#8b5cc4" stop-opacity="0.11" />
            <stop offset="100%" stop-color="#8b5cc4" stop-opacity="0" />
        </radialGradient>
    </defs>

    <!-- Deep space behind everything, so the board reads as a map rather than a grid. -->
    <rect x="-10000" y="-10000" width="20000" height="20000" fill="#0a0f1c" />
    <ellipse cx="-260" cy="-180" rx="900" ry="620" fill="url(#nebula-a)" />
    <ellipse cx="820" cy="540" rx="760" ry="700" fill="url(#nebula-b)" />
    <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#starfield-fine)" />
    <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#starfield-coarse)" />

    <!-- A handful of brighter stars that actually twinkle. Kept as real elements rather than
         pattern contents, since a pattern's tiles share one animation and would blink in
         unison across the whole sky. Positions are fixed in board coordinates. -->
    {#each TWINKLING_STARS as star, i (i)}
        <circle
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="#ffffff"
            class="twinkle"
            style="animation-delay: {star.delay}s; animation-duration: {star.duration}s;"
        />
    {/each}

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
            <!-- A planet's hex is tinted in its own colour. Raised from 0.28 to 0.42: the tint
                 is doing real work now, saying which colour a hex belongs to from across the
                 board, so it has to be legible against the dark field rather than merely
                 present. -->
            <polygon
                points={entry.points}
                fill={hex.kind === HexKind.Planet ? planetColor : '#141c2e'}
                fill-opacity={hex.kind === HexKind.Planet ? 0.42 : 0.5}
                stroke="#2b3752"
                stroke-width="2"
            />

            {#if hex.kind === HexKind.Planet}
                <!-- Each colour gets its own silhouette, so a board can be read at a glance
                     without matching hues: a ringed world, a binary pair, a haloed one, a moon,
                     a crescent. Shape carries the colour, which is what makes five kinds of
                     planet tell themselves apart at speed - and it survives a player who can't
                     separate the reds from the greens.
                     Unexplored planets stay dimmer and dashed, as before, whatever the shape. -->
                {@const bodyOpacity = hex.explored ? 1 : 0.45}
                {@const dash = hex.explored ? '' : '5 4'}
                {@const spin = `transform-box: view-box; transform-origin: ${entry.center.x}px ${entry.center.y}px;`}

                {#if hex.color === PlanetColor.Verdant}
                    <!-- Ringed, like Saturn: a tilted ellipse cutting across the body. Drawn
                         before the body so the near half of the ring reads as passing behind
                         it, then again after at partial opacity for the front half. -->
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

                {#if hex.color === PlanetColor.Crimson}
                    <!-- Binary: two bodies of equal weight turning about their common centre,
                         so there is no single disc at all. -->
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
                    <!-- The single disc every other kind is built around. -->
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

                {#if hex.color === PlanetColor.Gold}
                    <!-- Aura: two haloes breathing out of phase, so the glow reads as radiating
                         rather than simply blinking. -->
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

                {#if hex.color === PlanetColor.Azure}
                    <!-- A single moon, going round. One satellite rather than two, so it can't
                         be mistaken for the binary. -->
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
                    <!-- Crescent: a shadow drifting across the disc, so the planet shows a phase.
                         Clipped to the body so the shadow can't spill onto the hex. -->
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
                    {#if hex.piece.hub}
                        <!-- A Station Hub: the same square with a thin ring standing off it, so it
                             reads as a station with something added rather than a different piece. -->
                        <rect
                            x={entry.center.x - 26}
                            y={entry.center.y - 26}
                            width="52"
                            height="52"
                            rx="10"
                            fill="none"
                            stroke={color}
                            stroke-width="3"
                        />
                    {/if}
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

            {#if gameSession.railgunArmed && gameSession.railgunWouldMatter(hex.coords)}
                <!-- Where the Railgun changes the outcome. Everything else in reach dies to an
                     ordinary shot, so it is not worth a three-turn power. -->
                <polygon
                    points={entry.points}
                    fill="none"
                    stroke="#ff2f2f"
                    stroke-width="6"
                    class="pulse"
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
                <!-- While a SHIP is being placed the ghost following the cursor says both what
                     is landing and where, so the pulse would be a second answer to a question
                     already answered - and a board of thirty pulsing hexes is what made this
                     hard to read. It stays for every other decision (a tile's origins, a
                     planet to explore, a target to shoot, a piece to step), where there is no
                     ghost and the hexes themselves are the choice. -->
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

    <!-- The ship about to land, shown on the hex under the cursor. Drawn after every hex so it
         is never painted over by a neighbour, and pointer-events: none so it can't eat the click
         it is inviting. -->
    {#if ghostEntry && ghostPiece}
        {@const ghostColor = gameSession.colors.getPlayerUiColor(ghostPiece.playerId)}
        <g class="place-ghost" style="pointer-events: none;">
            {#if ghostPiece.type === PieceType.Probe}
                <circle
                    cx={ghostEntry.center.x}
                    cy={ghostEntry.center.y}
                    r="16"
                    fill="none"
                    stroke={ghostColor}
                    stroke-width="6"
                />
            {:else if ghostPiece.type === PieceType.Station}
                <rect
                    x={ghostEntry.center.x - 19}
                    y={ghostEntry.center.y - 19}
                    width="38"
                    height="38"
                    rx="7"
                    fill={ghostColor}
                />
                {#if ghostPiece.hub}
                    <rect
                        x={ghostEntry.center.x - 26}
                        y={ghostEntry.center.y - 26}
                        width="52"
                        height="52"
                        rx="10"
                        fill="none"
                        stroke={ghostColor}
                        stroke-width="3"
                    />
                {/if}
            {:else}
                <polygon
                    points="{ghostEntry.center.x},{ghostEntry.center.y - 24} {ghostEntry.center
                        .x + 23},{ghostEntry.center.y + 16} {ghostEntry.center.x -
                        23},{ghostEntry.center.y + 16}"
                    fill={ghostColor}
                />
            {/if}
            {#if ghostPiece.level}
                <text
                    x={ghostEntry.center.x}
                    y={ghostEntry.center.y +
                        (ghostPiece.type === PieceType.Fighter
                            ? 14
                            : ghostPiece.type === PieceType.Probe
                              ? 6
                              : 7)}
                    text-anchor="middle"
                    class="text-[17px] font-bold"
                    fill={ghostPiece.type === PieceType.Probe ? ghostColor : '#10182a'}
                >
                    {ghostPiece.level}
                </text>
            {/if}
        </g>
    {/if}

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

    <!-- What the placement being considered WOULD do: the same marks as the live versions
         below, but held rather than played, and dimmed.
         Held is the important part. The live missile flies its arc over and over because it is
         asking for a decision; a ghost that did the same would be a board full of motion for
         something that hasn't happened, and would read as a shot already fired. So the ghost
         arc is drawn once, complete and still - the path a shot would take - while the ghost
         pointers keep a gentle pulse, since a still triangle looks like a marker that has been
         placed rather than an intention. -->
    {#if ghostEntry}
        {#each previewTargets as target, index (target.q + ',' + target.r)}
            {@const path = attackArc(hovered!, target)}
            <path
                d={path}
                fill="none"
                stroke="#ff2f2f"
                stroke-opacity="0.42"
                stroke-width="3"
                stroke-linecap="round"
                stroke-dasharray="7 6"
                pointer-events="none"
            />
        {/each}

        {#each previewExplorables as target, index (target.q + ',' + target.r)}
            {@const pointer = reachPointer(hovered!, target)}
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
    /* Clicking a hex focuses it - they carry role="button" so the board is operable without a
       mouse - and the browser then draws a focus ring, which looked like a box the game had
       drawn around the piece just placed and left behind until the next click. These all have
       tabindex="-1", so they are not reachable by Tab and the ring was telling the player
       nothing they could act on. */
    svg :global([role='button']:focus) {
        outline: none;
    }

    /* Stars don't pulse in unison, so each one gets its own duration and delay inline. The
       range never reaches zero - a star that vanishes entirely reads as a rendering fault
       rather than as atmosphere. */
    @keyframes twinkle-frames {
        0%,
        100% {
            opacity: 0.28;
        }
        50% {
            opacity: 0.95;
        }
    }

    .twinkle {
        animation-name: twinkle-frames;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
    }

    /* Planet motion. All of it is slow on purpose: a board with a dozen planets on it would be
       exhausting if each one were busy, so these read as drift rather than as animation
       competing with the pieces and the score floats for attention.
       transform-box/transform-origin come in inline per planet, since each turns about its own
       hex centre rather than the shared view box. */
    @keyframes planet-revolve {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    /* The binary pair - the slowest of the lot, since both halves are large and a quick spin
       looks like a machine part rather than two worlds falling around each other. */
    .planet-binary {
        animation: planet-revolve 28s linear infinite;
    }

    /* A moon has less mass to shift, so it goes round noticeably faster than the binary. */
    .planet-moon {
        animation: planet-revolve 14s linear infinite;
    }

    /* The crescent's terminator creeping round the disc - slowest of all, because a phase is
       something you notice having changed rather than watch changing. */
    .planet-phase {
        animation: planet-revolve 44s linear infinite;
    }

    /* The aura breathes outward: growing and fading together, so it reads as light leaving the
       planet rather than a ring changing size. */
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

    /* The second halo runs half a cycle behind, which is what turns one pulse into a steady
       radiance rather than a blink with a gap in it. */
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
