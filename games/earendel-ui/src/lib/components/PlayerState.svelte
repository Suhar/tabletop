<script lang="ts">
    import type { Player } from '@tabletop/common'
    import {
        EarendelPlayerState,
        controllerOf,
        getHex,
        hexKey,
        isElevatedKind,
        categoryOfColor,
        colorSetSize,
        controlledColorCounts,
        controlsEveryColor,
        FIVE_COLOR_POINTS,
        PLANET_COLORS,
        planetCoordinates,
        ROUTE_POWER_INFO,
        TECHNOLOGY_CATEGORY_INFO,
        TECHNOLOGY_EFFECT_INFO,
        technologyCard,
        TechnologyEffectKind,
        TechnologyTiming,
        turnsUntilReady
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TechnologyChip from './TechnologyChip.svelte'
    import ScoreBreakdown from './ScoreBreakdown.svelte'
    import { PLANET_FILL } from '$lib/utils/planetColors.js'
    import { specialPieceInfo, type SpecialPieceInfo } from '$lib/utils/specialPieces.js'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: EarendelPlayerState } = $props()

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let tint = $derived(gameSession.colors.getPlayerUiColor(player.id))
    let ribbonText = $derived(gameSession.colors.getPlayerTextColor(player.id))

    // The planets this player controls, as dots in the planets' colors.
    let controlledColors = $derived(
        planetCoordinates(gameSession.gameState.board).flatMap((planet) => {
            if (controllerOf(gameSession.gameState, planet) !== playerState.playerId) return []
            const color = getHex(gameSession.gameState.board, planet)?.color
            return color ? [{ key: hexKey(planet), fill: PLANET_FILL[color] }] : []
        })
    )

    // The trade route powers this player holds now, and how each is held.
    let routePowers = $derived.by(() => {
        const state = gameSession.gameState
        const controlled = controlledColorCounts(state, playerState.playerId)
        const needed = colorSetSize(state.players.length)
        return (state.board.routePowers?.[playerState.playerId] ?? []).map((color) => {
            const byRoute = state.tradeRoutes.some(
                (route) => route.playerId === playerState.playerId && route.color === color
            )
            const byControl = (controlled.get(color) ?? 0) >= needed
            const held = [
                ...(byRoute ? [`a ${color} trade route`] : []),
                ...(byControl ? [`control of ${needed} ${color} planets`] : [])
            ].join(' and ')
            return {
                color,
                info: ROUTE_POWER_INFO[color],
                heading: {
                    name: `${TECHNOLOGY_CATEGORY_INFO[categoryOfColor(color)].name} power`,
                    color
                },
                detail: `Held through ${held}, and lost when that is.`
            }
        })
    })

    let holdsEveryColor = $derived(controlsEveryColor(gameSession.gameState, playerState.playerId))

    // Hovering or clicking the score opens the breakdown for everyone.
    let points = $derived(playerState.score)
    let scoreHovered = $state(false)
    let scorePinned = $state(false)
    let heldButton: HTMLButtonElement | undefined = $state()
    let heldPinned = $derived(gameSession.heldPlanetsPinnedFor === playerState.playerId)
    let scoreButton: HTMLButtonElement | undefined = $state()
    let card: HTMLDivElement | undefined = $state()
    // Fixed to the viewport, under the card, so the side column cannot clip it; kept inside the
    // window on the right.
    let breakdownWidth = $state(0)
    let viewportWidth = $state(0)
    // Where the card stood when the breakdown was asked for, or the window last changed size.
    let cardEdge: { left: number; bottom: number } | undefined = $state()
    const MARGIN = 8
    const WIDTH_BEFORE_MEASURED = 320

    function anchorBreakdown() {
        if (!card) return
        const rect = card.getBoundingClientRect()
        cardEdge = { left: rect.left, bottom: rect.bottom }
    }

    let breakdownAt = $derived(
        cardEdge
            ? {
                  left: Math.max(
                      MARGIN,
                      Math.min(
                          cardEdge.left,
                          viewportWidth - (breakdownWidth || WIDTH_BEFORE_MEASURED) - MARGIN
                      )
                  ),
                  top: cardEdge.bottom + 4
              }
            : undefined
    )

    function showBreakdown() {
        anchorBreakdown()
        scoreHovered = true
    }

    function togglePinnedBreakdown() {
        anchorBreakdown()
        scorePinned = !scorePinned
    }

    function unpinScore(event: PointerEvent) {
        if (scorePinned && scoreButton && event.target instanceof Node) {
            if (!scoreButton.contains(event.target)) scorePinned = false
        }
        if (heldPinned && heldButton && event.target instanceof Node) {
            if (!heldButton.contains(event.target)) gameSession.heldPlanetsPinnedFor = undefined
        }
    }

    type TechnologyEntry = {
        kind: TechnologyEffectKind
        count: number
        turnsLeft?: number
        unspent?: boolean
        toPlace?: { info: SpecialPieceInfo; count: number }
    }

    // Technologies this player's probes will research at their next turn if they still lead.
    let pendingTechnologies = $derived(
        gameSession.pendingClaims
            .filter((claim) => claim.playerId === playerState.playerId)
            .map((claim) => ({
                key: hexKey(claim.coords),
                coords: claim.coords,
                kind: technologyCard(claim.technologyId).effect
            }))
    )

    // Special pieces waiting to be placed, counted against the technology that granted them.
    let waiting = $derived.by(() => {
        const byKind = new Map<TechnologyEffectKind, { info: SpecialPieceInfo; count: number }>()
        for (const piece of playerState.specialPieces) {
            const info = specialPieceInfo(piece)
            if (!info) continue
            const entry = byKind.get(info.grantedBy)
            byKind.set(info.grantedBy, { info, count: (entry?.count ?? 0) + 1 })
        }
        return byKind
    })

    // One chip per technology, in the order they were gained.
    let technologyEntries: TechnologyEntry[] = $derived.by(() => {
        const counts = new Map<TechnologyEffectKind, number>()
        const owned = playerState.technologies.filter(
            (technologyId) => !isElevatedKind(technologyCard(technologyId).effect)
        )
        const kinds = [
            ...owned.map((technologyId) => technologyCard(technologyId).effect),
            ...playerState.storedEffects,
            ...waiting.keys()
        ]
        for (const technologyId of owned) {
            const kind = technologyCard(technologyId).effect
            counts.set(kind, (counts.get(kind) ?? 0) + 1)
        }

        // A once-only technology leaves the panel once it is used: the player still holds it for
        // the rules (its planet is not offered to them again), but there is nothing left to do.
        const spent = (kind: TechnologyEffectKind) =>
            TECHNOLOGY_EFFECT_INFO[kind].timing === TechnologyTiming.Stored &&
            !playerState.storedEffects.includes(kind)

        return [...new Set(kinds)]
            .filter((kind) => !spent(kind))
            .map((kind) => {
                const timing = TECHNOLOGY_EFFECT_INFO[kind].timing
                return {
                    kind,
                    count: counts.get(kind) ?? 1,
                    ...(timing === TechnologyTiming.Cooldown
                        ? {
                              turnsLeft: turnsUntilReady(
                                  gameSession.gameState,
                                  playerState.playerId,
                                  kind
                              )
                          }
                        : {}),
                    ...(timing === TechnologyTiming.Stored
                        ? { unspent: playerState.storedEffects.includes(kind) }
                        : {}),
                    ...(waiting.has(kind) ? { toPlace: waiting.get(kind) } : {})
                }
            })
    })
</script>

<svelte:window
    bind:innerWidth={viewportWidth}
    onpointerdown={unpinScore}
    onresize={anchorBreakdown}
/>

<!-- A ribbon in the player's color with the score in a badge breaking out of its corner; the
     body is the table's dark. The player to move glows in their color. -->
<div class="relative">
    <div
        bind:this={card}
        class="relative flex flex-col rounded-[14px] border pb-2 text-left text-white {isTurn
            ? 'bg-[#1a2238]'
            : 'border-white/10 bg-[#141c2e]'}"
        style={isTurn ? `border-color: ${tint}; box-shadow: 0 0 22px ${tint}66` : undefined}
    >
        <div
            class="flex items-center justify-between rounded-t-[13px] py-[6px] pl-3 pr-16 {ribbonText}"
            style="background-color: {tint}"
        >
            <div class="flex items-center gap-2">
                {#if isTurn}
                    <svg
                        aria-hidden="true"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M4 4l16 8-16 8 4-8-4-8z"></path>
                    </svg>
                {/if}
                <h1 class="text-[15px] leading-tight {isTurn ? 'font-bold' : 'font-semibold'}">
                    {player.name}
                </h1>
            </div>
            <span
                class="text-[10px] uppercase tracking-[0.12em] opacity-85"
                title="Pieces left in the bag"
            >
                {playerState.bag.remaining} in bag
            </span>
        </div>

        <button
            bind:this={scoreButton}
            type="button"
            class="absolute right-3 top-1 flex h-11 w-11 flex-col items-center justify-center rounded-full border-[3px] bg-[#0b1222] leading-none text-white hover:brightness-125 {scorePinned
                ? 'brightness-125'
                : ''}"
            style="border-color: {tint}{isTurn ? `; box-shadow: 0 0 12px ${tint}b3` : ''}"
            aria-label="{points} points if the game ended now; opens everyone's breakdown"
            aria-expanded={scoreHovered || scorePinned}
            onmouseenter={showBreakdown}
            onmouseleave={() => (scoreHovered = false)}
            onfocus={showBreakdown}
            onblur={() => (scoreHovered = false)}
            onclick={togglePinnedBreakdown}
        >
            <span class="text-[17px] font-bold">{points}</span>
            <span class="text-[7px] uppercase tracking-[0.12em] opacity-70">pts</span>
        </button>
        {#if (scoreHovered || scorePinned) && breakdownAt}
            <div
                bind:clientWidth={breakdownWidth}
                class="fixed z-50 w-max max-w-[calc(100vw-1rem)] overflow-x-auto rounded-lg border border-white/25 bg-[#0d1424]/75 backdrop-blur-sm p-2 text-left shadow-xl"
                style="left: {breakdownAt.left}px; top: {breakdownAt.top}px"
                role="tooltip"
            >
                <ScoreBreakdown />
            </div>
        {/if}

        <!-- Hovering rings this player's planets on the board; a click keeps them ringed. -->
        <button
            bind:this={heldButton}
            type="button"
            class="mx-1 flex items-center gap-2 rounded-md px-2 pb-1 pt-2 text-[11px] text-white/65 hover:bg-white/10 hover:text-white {heldPinned
                ? 'bg-white/10 text-white'
                : ''}"
            title="Show the planets controlled now"
            aria-pressed={heldPinned}
            onmouseenter={() => (gameSession.heldPlanetsHoveredFor = playerState.playerId)}
            onmouseleave={() => (gameSession.heldPlanetsHoveredFor = undefined)}
            onclick={() =>
                (gameSession.heldPlanetsPinnedFor = heldPinned ? undefined : playerState.playerId)}
        >
            {#if controlledColors.length > 0}
                <span class="inline-flex gap-[3px]" aria-hidden="true">
                    {#each controlledColors as planet (planet.key)}
                        <span
                            class="block h-2 w-2 rounded-full"
                            style="background-color: {planet.fill}"
                        ></span>
                    {/each}
                </span>
            {/if}
            <span>
                {controlledColors.length}
                {controlledColors.length === 1 ? 'planet' : 'planets'} held
            </span>
        </button>

        {#if routePowers.length > 0 || holdsEveryColor}
            <div class="flex flex-wrap gap-1.5 px-3 pt-1">
                {#if holdsEveryColor}
                    <TechnologyChip
                        name="Every color"
                        note="+{FIVE_COLOR_POINTS} each turn"
                        ability="Score {FIVE_COLOR_POINTS} points at the start of each of your turns."
                        heading={{ name: 'Planet bonus', color: PLANET_COLORS[0] }}
                        colors={PLANET_COLORS}
                        detail="Held while you control a planet of each of the five colors, and lost when you do not."
                        {tint}
                    />
                {/if}
                {#each routePowers as power (power.color)}
                    <TechnologyChip
                        name={power.info.name}
                        ability={power.info.ability}
                        heading={power.heading}
                        dot={power.color}
                        detail={power.detail}
                        {tint}
                    />
                {/each}
            </div>
        {/if}

        {#if technologyEntries.length > 0 || pendingTechnologies.length > 0}
            <div class="flex flex-wrap gap-1.5 px-3 pt-1">
                {#each technologyEntries as entry (entry.kind)}
                    <TechnologyChip
                        kind={entry.kind}
                        name={TECHNOLOGY_EFFECT_INFO[entry.kind].name}
                        ability={TECHNOLOGY_EFFECT_INFO[entry.kind].ability}
                        count={entry.count}
                        turnsLeft={entry.turnsLeft}
                        unspent={entry.unspent}
                        toPlace={entry.toPlace
                            ? {
                                  count: entry.toPlace.count,
                                  name: entry.toPlace.info.name
                              }
                            : undefined}
                        {tint}
                        onchoose={player.id === gameSession.myPlayer?.id
                            ? gameSession.powerActivators.get(entry.kind)
                            : undefined}
                    />
                {/each}
                {#each pendingTechnologies as claim (claim.key)}
                    <TechnologyChip
                        kind={claim.kind}
                        name={TECHNOLOGY_EFFECT_INFO[claim.kind].name}
                        ability={TECHNOLOGY_EFFECT_INFO[claim.kind].ability}
                        pending
                        planet={claim.coords}
                        {tint}
                    />
                {/each}
            </div>
        {:else}
            <div class="flex px-3 pt-1">
                <button
                    type="button"
                    disabled
                    class="inline-flex items-center rounded-lg border border-white/15 px-2 py-1 text-[11px] leading-tight text-white/50"
                >
                    No technologies yet
                </button>
            </div>
        {/if}

        {#if gameSession.showDebug}
            <div class="px-3 pt-2 text-xs opacity-60">id: {player.id}</div>
        {/if}
    </div>
</div>
