<script lang="ts">
    import { onMount, tick } from 'svelte'
    import { gsap } from 'gsap'
    import { type AxialCoordinates, sameCoordinates } from '@tabletop/common'
    import {
        SALVAGE_RANGE,
        JAMMER_RANGE,
        HexKind,
        type Hex,
        PieceLevel,
        PieceType,
        PlanetColor,
        TECHNOLOGY_CATEGORY,
        TECHNOLOGY_CATEGORY_INFO,
        categoryOfColor,
        hexKey,
        isPlacePiece,
        isStowShip,
        planetPairKey,
        powerOf,
        technologyAbility,
        technologyCard,
        technologyName,
        tileFootprint
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexGeometry, insetPoints, verticesToPoints } from '$lib/utils/hexDefinition.js'
    import { regionEdges } from '$lib/utils/regionEdges.js'
    import { timingNote } from '$lib/utils/technologyTiming.js'
    import { trussEnds } from '$lib/utils/stationGeometry.js'
    import StationShape from './StationShape.svelte'
    import TrussGirder from './TrussGirder.svelte'
    import FighterShape from './FighterShape.svelte'
    import { fighterSilhouetteFor } from '$lib/utils/fighterShapes.js'
    import TerraformerShape from './TerraformerShape.svelte'
    import RelayShape from './RelayShape.svelte'
    import SpecialShape from './SpecialShape.svelte'
    import { specialPieceInfo } from '$lib/utils/specialPieces.js'
    import PlanetTile from './PlanetTile.svelte'
    import { TerraformAnimator } from '$lib/animators/terraformAnimator.svelte.js'
    import { ArrivalAnimator } from '$lib/animators/arrivalAnimator.svelte.js'
    import ProbeShape from './ProbeShape.svelte'
    import {
        CLIP_OVERREACH,
        TrussGrowthAnimator
    } from '$lib/animators/trussGrowthAnimator.svelte.js'
    import { animatePiece, PieceMoveAnimator } from '$lib/animators/pieceMoveAnimator.svelte.js'
    import {
        ORBIT_PERIOD,
        ORBIT_DOT_RADIUS,
        beamKey,
        OrbitAnimator,
        orbitingPlayers,
        orbitSlot
    } from '$lib/animators/orbitAnimator.svelte.js'
    import { ScoreFloatAnimator } from '$lib/animators/scoreFloatAnimator.svelte.js'
    import { BlastAnimator } from '$lib/animators/blastAnimator.svelte.js'
    import { TorpedoAnimator } from '$lib/animators/torpedoAnimator.svelte.js'
    import { registerElement } from '$lib/animators/elementRegistry.js'
    import { frameBoard, FrameAnimator } from '$lib/animators/frameAnimator.svelte.js'
    import { boardFrame, viewBoxOf } from '$lib/utils/boardFrame.js'
    import { linkedStationNeighbors, stationTubeKey } from '$lib/utils/stationLinks.js'
    import { PLANET_FILL } from '$lib/utils/planetColors.js'
    import { sightSignal } from '$lib/utils/sightSignal.js'
    import { onSharedClock } from '$lib/utils/sharedClock.js'
    import { nanobotTrails } from '$lib/utils/nanobots.js'

    let gameSession = getGameSession()

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
    let view = $derived(
        boardFrame([
            ...placed.map((entry) => entry.hex.coords),
            ...ghosts.flatMap((ghost) => ghost.hexes.map((hex) => hex.coords))
        ])
    )

    // The frame follows the board's extent; the frame animator slides it there.
    let viewBox = $derived(viewBoxOf(view))
    const frame = new FrameAnimator()

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
    // Every sight link, between stations or through relays, is a faint line carrying a signal.
    let sightSignals = $derived(sightSignal(gameSession.gameState.board, gameSession.sightLines))

    // A straight run between two hex centers, stopped short of each piece.
    function insetRun(from: AxialCoordinates, to: AxialCoordinates, inset: number) {
        const a = hexGeometry(from).center
        const b = hexGeometry(to).center
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const ux = (b.x - a.x) / length
        const uy = (b.y - a.y) / length
        return {
            x1: a.x + ux * inset,
            y1: a.y + uy * inset,
            x2: b.x - ux * inset,
            y2: b.y - uy * inset
        }
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

    // One pip per player with a route to a planet, in a row centered along the bottom of its hex.
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

    // Sides of a station joined to a neighbor, which lose their docking stubs.
    function linkedAngles(coords: AxialCoordinates, playerId: string): number[] {
        const board = trussGrowth.dockingBoard ?? gameSession.gameState.board
        const from = hexGeometry(coords).center
        return linkedStationNeighbors(board, coords, playerId).map((neighbor) => {
            const to = hexGeometry(neighbor).center
            return Math.atan2(to.y - from.y, to.x - from.x)
        })
    }

    let interdictedEdges = $derived(regionEdges(gameSession.interdictedRegion))

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

    const shownBoard = () => gameSession.gameState.board
    const trussGrowth = new TrussGrowthAnimator(shownBoard)
    const pieceMoves = new PieceMoveAnimator()
    const scoreFloats = new ScoreFloatAnimator()
    const blasts = new BlastAnimator()
    const orbits = new OrbitAnimator((pieceId) => pieceMoves.nodeOf(pieceId))
    const torpedoes = new TorpedoAnimator((pieceId) => pieceMoves.nodeOf(pieceId))
    const terraforms = new TerraformAnimator(shownBoard)
    const arrivals = new ArrivalAnimator(shownBoard)

    // The board's assembly: the tiles drop into place one by one in the order setup grew them
    // (tile ids count up from the first tile), each shrinking down onto the table, and then
    // whatever earlier players have put on the table fades in together. Local presentation,
    // owned here: it explains no transition and nothing in the game waits on it; the title stands
    // over it and offers Play once it is done. Each player sees it once,
    // on first opening a game they have not yet acted in; a spectator sees it only for a game
    // nobody has acted in.
    const ASSEMBLY_DROP = 0.55
    const ASSEMBLY_GAP = 0.22
    const TABLE_FADE = 0.6
    let tableTop: SVGGElement | undefined = $state()
    const tileHexes = new Map<string, { node: SVGGElement; center: { x: number; y: number } }[]>()
    let assembling = $state(false)
    let assembly: gsap.core.Timeline | undefined

    function tileHex(
        node: SVGGElement,
        params: { tileId: string; center: { x: number; y: number } }
    ) {
        const entry = { node, center: params.center }
        tileHexes.set(params.tileId, [...(tileHexes.get(params.tileId) ?? []), entry])
        return {
            destroy() {
                const rest = (tileHexes.get(params.tileId) ?? []).filter((hex) => hex !== entry)
                if (rest.length > 0) tileHexes.set(params.tileId, rest)
                else tileHexes.delete(params.tileId)
            }
        }
    }

    async function assembleBoard() {
        assembling = true
        await tick()
        const tiles = [...tileHexes.entries()].sort(
            ([a], [b]) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, ''))
        )
        assembly = gsap.timeline({
            // Built: the title offers Play, which is what ends the opening.
            onComplete: () => {
                assembling = false
                gameSession.titleStage = 'ready'
            }
        })
        tiles.forEach(([, hexes], index) => {
            const nodes = hexes.map((hex) => hex.node)
            const cx = hexes.reduce((sum, hex) => sum + hex.center.x, 0) / hexes.length
            const cy = hexes.reduce((sum, hex) => sum + hex.center.y, 0) / hexes.length
            gsap.set(nodes, { svgOrigin: `${cx} ${cy}`, scale: 1.7, opacity: 0 })
            assembly?.to(
                nodes,
                { scale: 1, opacity: 1, duration: ASSEMBLY_DROP, ease: 'back.out(1.1)' },
                index * ASSEMBLY_GAP
            )
        })
        if (tableTop) {
            const landed = Math.max(0, tiles.length - 1) * ASSEMBLY_GAP + ASSEMBLY_DROP * 0.7
            assembly.fromTo(tableTop, { opacity: 0 }, { opacity: 1, duration: TABLE_FADE }, landed)
        }
    }

    // Whether this is the viewer's first sight of the game, remembered so it is so only once.
    function firstOpening(): boolean {
        const viewer = gameSession.myPlayer?.id
        const key = `earendel:assembled:${gameSession.gameState.gameId}:${viewer ?? 'spectator'}`
        try {
            if (localStorage.getItem(key)) return false
        } catch {
            // Storage may be unavailable; then the opening simply plays each time.
        }
        // The opening does not count: a player who has stowed a ship or placed their free
        // station but not yet drawn is still opening the game.
        const wanted = viewer
            ? !gameSession.actions.some(
                  (action) =>
                      action.playerId === viewer &&
                      !isStowShip(action) &&
                      !(isPlacePiece(action) && action.metadata?.founding)
              )
            : gameSession.gameState.actionCount === 0
        if (wanted) {
            try {
                localStorage.setItem(key, '1')
            } catch {
                // See above.
            }
        }
        return wanted
    }

    onMount(() => {
        // A first opening shows the title: over the assembly, or under reduced motion over the
        // board as it stands, with its buttons at once.
        if (firstOpening()) {
            gameSession.boardAssembling = true
            gameSession.announceStowReveal()
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                gameSession.titleStage = 'ready'
            } else {
                gameSession.titleStage = 'building'
                void assembleBoard()
            }
        }
        const animators = [
            frame,
            arrivals,
            pieceMoves,
            trussGrowth,
            blasts,
            torpedoes,
            scoreFloats,
            orbits,
            terraforms
        ]
        const listeners = animators.map((animator) => animator.onGameStateChange.bind(animator))
        for (const listener of listeners) gameSession.addGameStateChangeListener(listener)
        return () => {
            for (const listener of listeners) gameSession.removeGameStateChangeListener(listener)
            assembly?.kill()
            gameSession.beginPlay()
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

    // A special piece on the board says how it works, as its card did when it was granted.
    let shownPiece = $derived.by(() => {
        const coords = focused
        if (!coords) return undefined

        const entry = placed.find((candidate) => sameCoordinates(candidate.hex.coords, coords))
        const piece = entry?.hex.piece
        const info = piece ? specialPieceInfo(piece) : undefined
        if (!entry || !piece || !info?.rules) return undefined

        return {
            key: `${coords.q},${coords.r}`,
            name: info.name,
            owner: gameSession.getPlayerName(piece.playerId),
            lines: wrap(info.rules, 34),
            center: entry.center
        }
    })

    // A planet with no technology yet says what kind of planet it is: its color's category.
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

    // How far a jammer's wave runs: out over the whole of every hex in its reach.
    const HEX_STEP = Math.hypot(
        hexGeometry({ q: 1, r: 0 }).center.x - hexGeometry({ q: 0, r: 0 }).center.x,
        hexGeometry({ q: 1, r: 0 }).center.y - hexGeometry({ q: 0, r: 0 }).center.y
    )
    const JAMMER_REACH = (JAMMER_RANGE + 0.5) * HEX_STEP

    // A salvage drone's nanobots search out as far as the hexes two away, and no further.
    const NANOBOTS = nanobotTrails(SALVAGE_RANGE * HEX_STEP)
    const NANOBOT_CYCLE = '11s'

    const ATTACK_RED = '#ff2f2f'
    const SURVEY_BLUE = '#8fb6ff'
    const MARK_RING_RADIUS = 46
    const MARK_RING_TEETH = 8
    const MARK_RING_YELLOW = '#ffe14d'
    const MARK_RING_GREY = '#aeb6c6'

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

    // The near end already chosen for a two-ended power or a technology move.
    function isChosenOrigin(coords: AxialCoordinates): boolean {
        return [
            gameSession.shiftFrom,
            gameSession.warpFrom,
            gameSession.riftFrom,
            gameSession.spoofFrom,
            gameSession.feintFrom,
            gameSession.wormholeFrom,
            gameSession.downloadFrom,
            gameSession.movingFrom,
            gameSession.stormFrom
        ].some((origin) => origin !== undefined && sameCoordinates(origin, coords))
    }

    // How a hex is marked as one the player may act on, or not at all. A chosen near end keeps
    // its ring in gray so the yellow rings are only the hexes still to choose.
    // More hexes than this to choose among and the turning rings become a clutter: each open hex
    // then carries a still dot in the player's color, and a hex holding a planet or a piece a
    // still, plain ring.
    const CROWDED_MARKS = 6
    let marksCrowded = $derived(
        !gameSession.ordinaryPlacement && gameSession.highlightedHexes.length > CROWDED_MARKS
    )

    function markFor(
        coords: AxialCoordinates
    ): { color: string; strength: number; calm?: boolean } | undefined {
        if (isChosenOrigin(coords)) return { color: MARK_RING_GREY, strength: 1 }
        if (gameSession.railgunArmed && gameSession.railgunWouldMatter(coords)) {
            return { color: MARK_RING_YELLOW, strength: 1 }
        }
        if (isExploringPlanet(coords)) return { color: MARK_RING_YELLOW, strength: 1 }
        // An ordinary placement marks nothing: the ghost answers where a ship would land.
        if (gameSession.ordinaryPlacement) return undefined
        if (gameSession.isHighlighted(coords)) {
            return { color: MARK_RING_YELLOW, strength: 0.85, calm: marksCrowded }
        }
        return undefined
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
                ></polygon>
            {/each}
        </g>
    </g>
{/snippet}

<!-- The calm marks used when many hexes are on offer: a dot on an open hex, a still ring
     around a planet or a piece. -->
{#snippet markDot(center: { x: number; y: number }, color: string)}
    <g transform="translate({center.x} {center.y})" pointer-events="none">
        <circle r="15" fill="none" stroke={color} stroke-width="1.5" stroke-opacity="0.4"></circle>
        <circle r="9" fill={color} stroke="#0b1222" stroke-width="1.5"></circle>
    </g>
{/snippet}

{#snippet markStill(center: { x: number; y: number }, color: string, strength: number)}
    <circle
        cx={center.x}
        cy={center.y}
        r={MARK_RING_RADIUS}
        fill="none"
        stroke={color}
        stroke-width="2.5"
        stroke-opacity={0.9 * strength}
        pointer-events="none"
    ></circle>
{/snippet}

{#snippet markRing(center: { x: number; y: number }, color: string, strength: number)}
    <g transform="translate({center.x} {center.y})" opacity={strength} pointer-events="none">
        <g class="mark-ring">
            <circle
                r={MARK_RING_RADIUS}
                fill="none"
                stroke={color}
                stroke-width="3"
                stroke-opacity="0.9"
            ></circle>
            {#each Array.from({ length: MARK_RING_TEETH }, (_, tooth) => tooth) as tooth (tooth)}
                <polygon
                    points="{MARK_RING_RADIUS},-7 {MARK_RING_RADIUS},7 {MARK_RING_RADIUS - 14},0"
                    fill={color}
                    transform="rotate({(tooth * 360) / MARK_RING_TEETH})"
                ></polygon>
            {/each}
        </g>
    </g>
{/snippet}

<svg
    use:frameBoard={{ animator: frame, viewBox }}
    class="w-[1200px] max-w-full select-none"
    role="presentation"
>
    {#each placed as entry (entry.hex.tileId + entry.hex.coords.q + ',' + entry.hex.coords.r)}
        {@const hex = entry.hex}
        {@const highlighted = gameSession.isHighlighted(hex.coords)}

        <g
            use:tileHex={{ tileId: hex.tileId, center: entry.center }}
            opacity={assembling ? 0 : undefined}
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
                {@const wipe = terraforms.wipeFor(hex.coords)}
                <g clip-path={wipe ? `url(#terraform-rest-${wipe.key})` : undefined}>
                    <PlanetTile
                        {hex}
                        center={entry.center}
                        points={entry.points}
                        inset={insetPoints(hex.coords, 2.5)}
                        marked
                    />
                </g>
            {:else if hex.kind === HexKind.Nebula}
                <!-- Nebula: laid by a seeder, nothing crosses or sees through it. -->
                <polygon
                    points={entry.points}
                    fill="#3b2a66"
                    fill-opacity="0.85"
                    stroke="#6b4fb0"
                    stroke-width="2"
                ></polygon>
                <circle
                    cx={entry.center.x - 10}
                    cy={entry.center.y - 6}
                    r="12"
                    fill="#7b5fcb"
                    fill-opacity="0.35"
                ></circle>
                <circle
                    cx={entry.center.x + 9}
                    cy={entry.center.y + 5}
                    r="14"
                    fill="#9d84e6"
                    fill-opacity="0.25"
                ></circle>
                <circle
                    cx={entry.center.x + 2}
                    cy={entry.center.y - 14}
                    r="7"
                    fill="#c3b3f5"
                    fill-opacity="0.25"
                ></circle>
            {:else}
                <polygon
                    points={entry.points}
                    fill="#141c2e"
                    fill-opacity="0.5"
                    stroke="#2b3752"
                    stroke-width="2"
                ></polygon>
            {/if}

            {#if hex.kind === HexKind.Open && gameSession.isInterdictedGround(hex.coords)}
                <!-- Beside an interdictor: a standing reddish tint, for everyone, whoever owns it.
                     Its lines are drawn above the tiles, further down. -->
                <polygon
                    points={entry.points}
                    fill="#ff6b5e"
                    fill-opacity="0.13"
                    pointer-events="none"
                ></polygon>
            {/if}

            {#if gameSession.spreading && gameSession.isSpreadTarget(hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#ff8a3d"
                    fill-opacity="0.18"
                    stroke="#ffab6b"
                    stroke-width="4"
                ></polygon>
            {/if}

            {#if highlighted && !showGhost}
                <polygon points={entry.points} fill="#ffffff" fill-opacity="0.07"></polygon>
            {/if}
        </g>
    {/each}

    <!-- Everything on the table: it fades in together once the assembly has landed. -->
    <g bind:this={tableTop} opacity={assembling ? 0 : undefined}>
        <!-- An interdictor's ground: the lines between its hexes faint, the outside of the whole
             region bright, above every tile so no neighbor covers an edge. -->
        {#if interdictedEdges.inner}
            <path
                d={interdictedEdges.inner}
                fill="none"
                stroke="#ff6b5e"
                stroke-opacity="0.35"
                stroke-width="2"
                stroke-linecap="round"
                pointer-events="none"
            ></path>
        {/if}
        {#if interdictedEdges.outer}
            <path
                d={interdictedEdges.outer}
                fill="none"
                stroke="#ff6b5e"
                stroke-opacity="0.5"
                stroke-width="2.5"
                stroke-linecap="round"
                pointer-events="none"
            ></path>
        {/if}

        <!-- Hexes closed to the probe in hand, above every tile so no neighbor covers an edge. -->
        {#each placed as entry (entry.hex.tileId + entry.hex.coords.q + ',' + entry.hex.coords.r)}
            <!-- An interdictor's ground already reads as closed, and keeps its one look. -->
            {#if gameSession.isClosedToMe(entry.hex.coords) && !gameSession.isInterdictedGround(entry.hex.coords)}
                <polygon
                    points={entry.points}
                    fill="#ff6b5e"
                    fill-opacity="0.1"
                    stroke="#ff6b5e"
                    stroke-width="2"
                    stroke-dasharray="4 5"
                    pointer-events="none"
                ></polygon>
            {/if}
        {/each}

        <!-- A recolored planet wipes in from the left behind a white scan line (rules.md, Terraformer). -->
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
                ></rect>
            </clipPath>
            <clipPath id="terraform-rest-{wipe.key}">
                <rect
                    use:registerElement={{ registry: terraforms.remainders, key: wipe.key }}
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                ></rect>
            </clipPath>
            <clipPath id="terraform-hex-{wipe.key}">
                <polygon points={outline}></polygon>
            </clipPath>
            <g clip-path="url(#terraform-wipe-{wipe.key})" pointer-events="none">
                <PlanetTile
                    hex={wipe.hex}
                    center={geometry.center}
                    points={outline}
                    inset={insetPoints(wipe.hex.coords, 2.5)}
                    copy="-wipe"
                    still
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
                    ></line>
                    <line
                        x1={box.x}
                        y1={box.y}
                        x2={box.x}
                        y2={box.y + box.height}
                        stroke="#ffffff"
                        stroke-width="2.5"
                    ></line>
                </g>
            </g>
        {/each}

        <!-- A pending probe claim: a beam from the claimed planet into each of the claimant's probes
         beside it, gained on their next turn if their probes still lead (rules.md, Gaining a
         technology). -->
        <!-- Joined pairs of planets: a crate in each joiner's color along the bottom of the planet's hex
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
            ></rect>
        {/each}

        <!-- Every so often a jammer sends a wave out to the edge of its reach, two hexes: a
             reminder of how far its jamming runs. A looping cue, nothing in the game waits on it. -->
        {#each placed as entry (entry.hex.coords.q + ',' + entry.hex.coords.r)}
            {#if entry.hex.piece?.type === PieceType.Jammer}
                {@const color = gameSession.colors.getPlayerUiColor(entry.hex.piece.playerId)}
                {#each [0, 0.5] as delay (delay)}
                    <circle
                        class="jammer-wave"
                        style="animation-delay: {delay}s"
                        cx={entry.center.x}
                        cy={entry.center.y}
                        r={JAMMER_REACH}
                        fill="none"
                        stroke={color}
                        stroke-width="3"
                        stroke-dasharray="14 9 5 9"
                        vector-effect="non-scaling-stroke"
                        pointer-events="none"
                    ></circle>
                {/each}
            {/if}
        {/each}

        <!-- Every so often a salvage drone's nanobots wander out to the edge of its reach, two
             hexes, each on its own jagged track, and come back along it to the ship, fainter as
             they go and gone as they arrive: a reminder of how far it salvages.
             A looping cue, nothing in the game waits on it. -->
        {#each placed as entry (entry.hex.coords.q + ',' + entry.hex.coords.r)}
            {#if entry.hex.piece?.type === PieceType.SalvageDrone}
                {@const color = gameSession.colors.getPlayerUiColor(entry.hex.piece.playerId)}
                <g
                    class="nanobots"
                    transform="translate({entry.center.x} {entry.center.y})"
                    pointer-events="none"
                >
                    {#each NANOBOTS as bot, index (index)}
                        <circle r={bot.size} fill={color} opacity="0">
                            <animateMotion
                                dur={NANOBOT_CYCLE}
                                repeatCount="indefinite"
                                calcMode="linear"
                                keyPoints="0;0;1;0;0"
                                keyTimes="0;{bot.start};{bot.turn};{bot.end};1"
                                path={bot.path}
                            ></animateMotion>
                            <animate
                                attributeName="opacity"
                                dur={NANOBOT_CYCLE}
                                repeatCount="indefinite"
                                values="0;0;0.9;0.55;0;0"
                                keyTimes="0;{bot.start};{bot.start + 0.02};{bot.turn};{bot.end};1"
                            ></animate>
                        </circle>
                    {/each}
                </g>
            {/if}
        {/each}

        <!-- A planet settled by a Colony Ship carries a small station in its owner's color. -->
        {#each placed as entry (entry.hex.coords.q + ',' + entry.hex.coords.r)}
            {#if entry.hex.colony}
                <g
                    transform="translate({entry.center.x} {entry.center.y}) scale(0.55)"
                    pointer-events="none"
                >
                    <StationShape
                        center={{ x: 0, y: 0 }}
                        color={gameSession.colors.getPlayerUiColor(entry.hex.colony)}
                    />
                </g>
            {/if}
        {/each}

        <!-- Probes spent researching a planet circle it as one dot for each player who has any
             there (rules.md, Gaining a technology). -->
        {#each placed as entry (entry.hex.coords.q + ',' + entry.hex.coords.r)}
            {@const players = orbitingPlayers(entry.hex.orbiters ?? [])}
            {#if players.length > 0}
                <g
                    class="orbit"
                    style="transform-origin: {entry.center.x}px {entry.center
                        .y}px; animation-duration: {ORBIT_PERIOD}s;"
                    use:registerElement={{
                        registry: orbits.orbits,
                        key: String(hexKey(entry.hex.coords))
                    }}
                    pointer-events="none"
                >
                    {#each players as playerId, index (playerId)}
                        {@const slot = orbitSlot(entry.hex.coords, index, players.length)}
                        <circle
                            cx={slot.x}
                            cy={slot.y}
                            r={ORBIT_DOT_RADIUS}
                            fill={gameSession.colors.getPlayerUiColor(playerId)}
                            stroke="#0b1222"
                            stroke-width="1"
                        ></circle>
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
                    <stop offset="0" stop-color={color} stop-opacity="0"></stop>
                    <stop offset="0.5" stop-color={color} stop-opacity="0.28"></stop>
                    <stop offset="1" stop-color={color} stop-opacity="0.5"></stop>
                </linearGradient>
                <polygon
                    points="0,-16 {beam.length},-5 {beam.length},5 0,16"
                    fill="url(#{gradientId})"
                    use:registerElement={{
                        registry: orbits.beams,
                        key: beamKey(uplink.probe, uplink.planet)
                    }}
                ></polygon>
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
                                founding={piece.founding}
                                linkedAngles={pieceMoves.undocked.includes(piece.id)
                                    ? []
                                    : linkedAngles(entry.hex.coords, piece.playerId)}
                            />
                        {:else if piece.type === PieceType.Terraformer}
                            <TerraformerShape center={entry.center} {color} />
                        {:else if piece.type === PieceType.Relay}
                            <RelayShape center={entry.center} {color} />
                        {:else if piece.type !== PieceType.Fighter}
                            <SpecialShape center={entry.center} {color} type={piece.type} />
                        {:else}
                            <FighterShape
                                center={entry.center}
                                {color}
                                level={powerOf(piece)}
                                torpedo={piece.torpedo}
                                silhouette={fighterSilhouetteFor(
                                    gameSession.colors.getPlayerColor(piece.playerId)
                                )}
                            />
                        {/if}
                    </g>
                {/key}
            {/if}
        {/each}

        <!-- A torpedo striking from a board that does not yet draw it (see TorpedoAnimator). -->
        {#each torpedoes.flying as flying (flying.key)}
            {@const center = hexGeometry(flying.coords).center}
            <g
                use:registerElement={{ registry: torpedoes.elements, key: flying.key }}
                pointer-events="none"
            >
                <FighterShape
                    {center}
                    color={gameSession.colors.getPlayerUiColor(flying.piece.playerId)}
                    level={powerOf(flying.piece)}
                    torpedo
                    silhouette={fighterSilhouetteFor(
                        gameSession.colors.getPlayerColor(flying.piece.playerId)
                    )}
                />
            </g>
        {/each}

        <!-- The visible board holds the state from before an action until its animations end, so the
         pieces it placed are drawn here until then. -->
        {#each arrivals.arriving as arrival (arrival.key)}
            {@const center = hexGeometry(arrival.coords).center}
            {@const color = gameSession.colors.getPlayerUiColor(arrival.piece.playerId)}
            {#if arrival.piece.founding}
                <!-- The opening station's flourish: two orbits that spread and fade as it lands,
                     scaled about the hex by ArrivalAnimator. -->
                <g transform="translate({center.x} {center.y})" pointer-events="none">
                    <g use:registerElement={{ registry: arrivals.flourishes, key: arrival.key }}>
                        <circle
                            data-flourish="outer"
                            r="27"
                            fill="none"
                            stroke={color}
                            stroke-width="1.5"
                            stroke-dasharray="1.5 4.5"
                            opacity="0"
                        ></circle>
                        <circle
                            data-flourish="inner"
                            r="27"
                            fill="none"
                            stroke={color}
                            stroke-width="1.5"
                            stroke-dasharray="1.5 4.5"
                            opacity="0"
                        ></circle>
                    </g>
                </g>
            {/if}
            <g pointer-events="none">
                {#if arrival.piece.type === PieceType.Probe}
                    <ProbeShape {center} {color} level={arrival.piece.level ?? PieceLevel.Two} />
                {:else if arrival.piece.type === PieceType.Station}
                    <StationShape
                        {center}
                        {color}
                        hub={arrival.piece.hub}
                        founding={arrival.piece.founding}
                        linkedAngles={linkedAngles(arrival.coords, arrival.piece.playerId)}
                    />
                {:else if arrival.piece.type === PieceType.Terraformer}
                    <TerraformerShape {center} {color} />
                {:else if arrival.piece.type === PieceType.Relay}
                    <RelayShape {center} {color} />
                {:else if arrival.piece.type !== PieceType.Fighter}
                    <SpecialShape {center} {color} type={arrival.piece.type} />
                {:else}
                    <FighterShape
                        {center}
                        {color}
                        level={powerOf(arrival.piece)}
                        torpedo={arrival.piece.torpedo}
                        silhouette={fighterSilhouetteFor(
                            gameSession.colors.getPlayerColor(arrival.piece.playerId)
                        )}
                    />
                {/if}
            </g>
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
                        founding={ghostPiece.founding}
                    />
                {:else if ghostPiece.type === PieceType.Terraformer}
                    <TerraformerShape center={ghostEntry.center} color={ghostColor} />
                {:else if ghostPiece.type === PieceType.Relay}
                    <RelayShape center={ghostEntry.center} color={ghostColor} />
                {:else if ghostPiece.type !== PieceType.Fighter}
                    <SpecialShape
                        center={ghostEntry.center}
                        color={ghostColor}
                        type={ghostPiece.type}
                    />
                {:else}
                    <FighterShape
                        center={ghostEntry.center}
                        color={ghostColor}
                        level={powerOf(ghostPiece)}
                        torpedo={gameSession.torpedoArmed}
                        silhouette={fighterSilhouetteFor(
                            gameSession.colors.getPlayerColor(ghostPiece.playerId)
                        )}
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
                        fill-opacity={previewing
                            ? isPlanet
                                ? 0.5
                                : 0.9
                            : index === 0
                              ? 0.14
                              : 0.03}
                        stroke="#8fb6ff"
                        stroke-opacity={previewing ? 0.9 : index === 0 ? 0.7 : 0.15}
                        stroke-width={previewing ? 4 : 2}
                        stroke-dasharray={previewing ? '' : '6 5'}
                    ></polygon>
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
                ></line>
                {#each route.planets as end (end.q + ',' + end.r)}
                    {@const at = hexGeometry(end).center}
                    <circle
                        cx={at.x}
                        cy={at.y}
                        r={ROUTE_RING_RADIUS}
                        fill="none"
                        stroke={color}
                        stroke-width="2.5"
                    ></circle>
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
            ></line>
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
                    ></path>
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
                    ></circle>
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
                    ></circle>
                    <circle
                        data-blast="ring"
                        r="24"
                        fill="none"
                        stroke="#ff2f2f"
                        stroke-width="5"
                        opacity="0"
                    ></circle>
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
                                ></line>
                            {/each}
                        </g>
                    {/if}
                </g>
            </g>
        {/each}

        {#each scoreFloats.floats as entry (entry.key)}
            <g transform="translate({entry.at.x} {entry.at.y})" pointer-events="none">
                <g
                    use:registerElement={{ registry: scoreFloats.elements, key: entry.key }}
                    opacity="0"
                >
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
                </g>
            </g>
        {/each}

        <!-- Drawn here rather than with each station: a neighboring hex fill would cover half a girder. -->
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
                ></rect>
            </clipPath>
            <g clip-path="url(#truss-grow-{truss.key})">
                <TrussGirder start={truss.girder.start} end={truss.girder.end} {color} />
            </g>
        {/each}

        <!-- Sight links: a faint hairline, and a signal that bursts from a station and runs along each
         link in turn, bursting again wherever it is passed on (rules.md, Station groups, Relay). -->
        {#each gameSession.sightLines as line, index (line.playerId + index)}
            {@const run = insetRun(line.from, line.to, 18)}
            <line
                {...run}
                stroke={gameSession.colors.getPlayerUiColor(line.playerId)}
                stroke-opacity="0.22"
                stroke-width="1.5"
                stroke-dasharray="2 6"
                stroke-linecap="round"
                pointer-events="none"
            ></line>
        {/each}
        {#each sightSignals.pulses as pulse (pulse.key)}
            {@const run = insetRun(pulse.from, pulse.to, 18)}
            <line
                {...run}
                pathLength="100"
                stroke={gameSession.colors.getPlayerUiColor(pulse.playerId)}
                stroke-width="3"
                stroke-linecap="round"
                stroke-dasharray="6 200"
                class="relay-pulse"
                style="animation-delay: {pulse.delay}s"
                use:onSharedClock
                pointer-events="none"
            ></line>
        {/each}
        {#each sightSignals.bursts as burst (burst.key)}
            {@const at = hexGeometry(burst.at).center}
            <circle
                cx={at.x}
                cy={at.y}
                r="16"
                fill="none"
                stroke={gameSession.colors.getPlayerUiColor(burst.playerId)}
                stroke-width="2"
                class="relay-burst"
                style="animation-delay: {burst.delay}s; transform-origin: {at.x}px {at.y}px"
                use:onSharedClock
                pointer-events="none"
            ></circle>
        {/each}

        <!-- Marks above everything but the popups, so no piece, beam or girder covers a ring. -->
        {#each placed as entry (entry.hex.coords.q + ',' + entry.hex.coords.r)}
            {@const mark = markFor(entry.hex.coords)}
            {#if mark?.calm && entry.hex.kind !== HexKind.Planet && !entry.hex.piece}
                {@render markDot(
                    entry.center,
                    gameSession.colors.getPlayerUiColor(gameSession.myPlayer?.id)
                )}
            {:else if mark?.calm}
                {@render markStill(entry.center, mark.color, mark.strength)}
            {:else if mark}
                {@render markRing(entry.center, mark.color, mark.strength)}
            {/if}
        {/each}

        <!-- Popups last, so nothing on the board is drawn over them. -->
        {#each shownTechnology ? [shownTechnology] : [] as shown (shown.key)}
            {@const width = 300}
            {@const lines = wrap(technologyAbility(shown.card), 34)}
            {@const category = TECHNOLOGY_CATEGORY_INFO[TECHNOLOGY_CATEGORY[shown.card.effect]]}
            {@const timing = timingNote(shown.card.effect)}
            {@const timingLines = timing ? wrap(`${timing.label}: ${timing.text}`, 40) : []}
            {@const height =
                66 + lines.length * 20 + (timingLines.length > 0 ? 8 + timingLines.length * 17 : 0)}
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
                    fill-opacity="0.75"
                    stroke="#8fb6ff"
                    stroke-width="2"
                ></rect>
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
                <!-- Whether it is a one-shot or on a timer. -->
                {#each timingLines as line, index (index)}
                    <text
                        x={x + 16}
                        y={y + 76 + lines.length * 20 + index * 17}
                        class="fill-white/60 text-[13px]"
                    >
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
                    fill-opacity="0.75"
                    stroke="#8fb6ff"
                    stroke-width="2"
                ></rect>
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

        {#each shownPiece ? [shownPiece] : [] as shown (shown.key)}
            {@const width = 300}
            {@const height = 66 + shown.lines.length * 20}
            {@const box = popupPosition(shown.center, width, height)}
            <g pointer-events="none">
                <rect
                    x={box.x}
                    y={box.y}
                    {width}
                    {height}
                    rx="10"
                    fill="#0d1424"
                    fill-opacity="0.75"
                    stroke="#8fb6ff"
                    stroke-width="2"
                ></rect>
                <text
                    x={box.x + 16}
                    y={box.y + 22}
                    class="fill-white/60 text-[11px] font-semibold uppercase tracking-[0.12em]"
                >
                    Special piece · {shown.owner}
                </text>
                <text x={box.x + 16} y={box.y + 44} class="fill-white text-[19px] font-bold">
                    {shown.name}
                </text>
                {#each shown.lines as line, index (index)}
                    <text
                        x={box.x + 16}
                        y={box.y + 70 + index * 20}
                        class="fill-white/80 text-[15px]"
                    >
                        {line}
                    </text>
                {/each}
            </g>
        {/each}

        {#if hoveredPip}
            {@const at = hexGeometry(hoveredPip.planet).center}
            {@const label = `${shownRoutes.length > 1 ? `${shownRoutes.length} trade routes` : 'Trade route'} · joined by ${gameSession.getPlayerName(hoveredPip.playerId)}`}
            {@const width = label.length * 8.6 + 24}
            {@const box = popupPosition(at, width, 32)}
            <g pointer-events="none">
                <rect
                    x={box.x}
                    y={box.y}
                    {width}
                    height="32"
                    rx="8"
                    fill="#0d1424"
                    fill-opacity="0.75"
                    stroke="#8fb6ff"
                    stroke-width="2"
                ></rect>
                <text x={box.x + 12} y={box.y + 21} class="fill-white text-[15px]">{label}</text>
            </g>
        {/if}
    </g>
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

    /* A jammer's wave: out from the jammer to its reach in the first part of a long cycle,
       then nothing until the next. Use the `animation` shorthand, as below. */
    .jammer-wave {
        transform-box: fill-box;
        transform-origin: center;
        opacity: 0;
        animation: jammer-wave-frames 9s ease-out infinite;
    }

    @keyframes jammer-wave-frames {
        0% {
            transform: scale(0.08);
            opacity: 0;
        }
        3% {
            opacity: 0.75;
        }
        22% {
            transform: scale(1);
            opacity: 0;
        }
        100% {
            transform: scale(1);
            opacity: 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .jammer-wave {
            animation: none;
        }
    }

    /* The nanobots are nothing but their motion. */
    @media (prefers-reduced-motion: reduce) {
        .nanobots {
            display: none;
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

    /* A relay signal: one short dash runs the link, then waits out the cycle. */
    @keyframes relay-pulse-frames {
        0% {
            stroke-dashoffset: 6;
            opacity: 0;
        }
        2% {
            opacity: 1;
        }
        15% {
            stroke-dashoffset: -100;
            opacity: 1;
        }
        16%,
        100% {
            stroke-dashoffset: -100;
            opacity: 0;
        }
    }

    .relay-pulse {
        animation: relay-pulse-frames 4s linear infinite backwards;
    }

    /* Where the signal starts or is passed on, a ring bursts outward and fades. */
    @keyframes relay-burst-frames {
        0% {
            transform: scale(0.5);
            opacity: 0.85;
        }
        15% {
            transform: scale(1.7);
            opacity: 0;
        }
        100% {
            transform: scale(1.7);
            opacity: 0;
        }
    }

    .relay-burst {
        transform-box: view-box;
        animation: relay-burst-frames 4s ease-out infinite backwards;
    }

    @media (prefers-reduced-motion: reduce) {
        .relay-pulse,
        .relay-burst {
            animation: none;
            opacity: 0;
        }
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

    @keyframes mark-ring-frames {
        to {
            transform: rotate(360deg);
        }
    }

    .mark-ring {
        animation: mark-ring-frames 16s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
        .chevron-pulse,
        .mark-ring {
            animation: none;
        }
    }
</style>
