<script lang="ts">
    import type { AxialCoordinates, Point } from '@tabletop/common'
    import {
        COOLDOWN_TURNS,
        TECHNOLOGY_CATEGORY,
        TECHNOLOGY_CATEGORY_INFO,
        type PlanetColor,
        type TechnologyEffectKind
    } from '@tabletop/earendel'
    import { PLANET_FILL } from '$lib/utils/planetColors.js'
    import PlanetBadge from './PlanetBadge.svelte'
    import { timingNote } from '$lib/utils/technologyTiming.js'

    let {
        kind,
        name,
        ability,
        count = 1,
        turnsLeft,
        unspent,
        pending = false,
        planet,
        colors,
        detail,
        heading,
        dot,
        elevated = false,
        dimmed = false,
        toPlace,
        tint,
        note,
        active = false,
        onchoose
    }: {
        // The technology, which names its category and the category's color in the popup.
        kind?: TechnologyEffectKind
        name: string
        ability: string
        count?: number
        // Set for a technology on a cooldown: lit pips are rounds still to wait.
        turnsLeft?: number
        // Set for a once-only technology: whether it is still to be used.
        unspent?: boolean
        // A probe claim on a planet with this technology, not yet researched.
        pending?: boolean
        // The planet a pending claim is on, which a line links to while the popup is open.
        planet?: AxialCoordinates
        // The planet colors a card matches, shown as small planets in the popup.
        colors?: readonly PlanetColor[]
        // A further line for the popup.
        detail?: string
        // The popup's small heading when the chip is not a technology, in a planet's color.
        heading?: { name: string; color: PlanetColor }
        // A planet-colored dot before the name: a trade route power of that color.
        dot?: PlanetColor
        // An elevated card, picked out in gold.
        elevated?: boolean
        dimmed?: boolean
        // Pieces this technology granted that are still waiting to be placed.
        toPlace?: { count: number; name: string }
        // A player panel chip: tinted and edged in the player's color, squarer than a pill.
        tint?: string
        // A second line on the chip, such as when a power may be played, or what to do next
        // while it is being played; also the popup's last line.
        note?: string
        // Lit: the power is being played now.
        active?: boolean
        // Makes the chip a choice: a click chooses it. On touch the first tap shows the popup and
        // a second tap chooses.
        onchoose?: () => void
    } = $props()

    // The popup's border, which the trace to a pending claim's planet continues.
    const ACCENT = '#8fb6ff'
    const POPUP_WIDTH = 300
    const GAP = 6
    const MARGIN = 8
    const ROOM_ABOVE = 180

    let chip: HTMLButtonElement | undefined = $state()
    let hovered = $state(false)
    let pinned = $state(false)
    let anchor: { left: number; top?: number; bottom?: number } | undefined = $state()
    let target: { center: Point; radius: number } | undefined = $state()
    let viewportHeight = $state(0)
    let popupHeight = $state(0)

    let open = $derived(hovered || pinned)
    let category = $derived(kind ? TECHNOLOGY_CATEGORY_INFO[TECHNOLOGY_CATEGORY[kind]] : heading)
    let timing = $derived(kind ? timingNote(kind) : undefined)
    let lastPointerType = 'mouse'

    let status = $derived.by(() => {
        if (pending) {
            return "Pending: researched at this player's next turn if their probes still lead the planet."
        }
        // A chip in the player's own panel that can be played from there says so.
        const play =
            onchoose && tint && !note
                ? lastPointerType === 'touch'
                    ? ' Tap again to use it.'
                    : ' Click to use it.'
                : ''
        if (turnsLeft !== undefined) {
            if (turnsLeft === 0) return `Ready to use.${play}`
            return `Ready in ${turnsLeft} more ${turnsLeft === 1 ? 'round' : 'rounds'}.`
        }
        if (unspent !== undefined) return unspent ? `Not used yet.${play}` : 'Used.'
        if (toPlace) {
            const pieces =
                toPlace.count === 1 ? `a ${toPlace.name}` : `${toPlace.count} ${toPlace.name}s`
            return `You have ${pieces} to place: play ${toPlace.count === 1 ? 'it' : 'one'} instead of the ships you draw.`
        }
        if (onchoose && lastPointerType === 'touch') return 'Tap again to choose it.'
        return note
    })

    // Fixed to the viewport so a scrolling side panel can't clip it.
    function placePopup() {
        if (!chip) return
        const rect = chip.getBoundingClientRect()
        const left = Math.min(Math.max(rect.left, MARGIN), window.innerWidth - POPUP_WIDTH - MARGIN)
        target = planetTarget()
        viewportHeight = window.innerHeight
        // Open away from the planet so the popup doesn't hide the trace to it.
        const above = target
            ? target.center.y > rect.bottom && rect.top > ROOM_ABOVE
            : rect.bottom > window.innerHeight * 0.6
        anchor = above
            ? { left, bottom: window.innerHeight - rect.top + GAP }
            : { left, top: rect.bottom + GAP }
    }

    // The claimed planet on the board, in viewport coordinates.
    function planetTarget(): { center: Point; radius: number } | undefined {
        if (!planet) return undefined
        // Looked for inside this game's own table, never the rest of the page.
        const hex = chip
            ?.closest('[data-game-ui]')
            ?.querySelector(`[data-planet="${planet.q},${planet.r}"]`)
        if (!hex) return undefined
        const rect = hex.getBoundingClientRect()
        return {
            center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            radius: rect.height / 2
        }
    }

    // A straight line from the popup's edge to the planet's ring, aimed at the planet's center.
    let trace = $derived.by(() => {
        if (!anchor || !target || popupHeight === 0) return undefined
        const top = anchor.top ?? viewportHeight - (anchor.bottom ?? 0) - popupHeight
        const middle = { x: anchor.left + POPUP_WIDTH / 2, y: top + popupHeight / 2 }

        const dx = target.center.x - middle.x
        const dy = target.center.y - middle.y
        const length = Math.hypot(dx, dy) || 1
        // How far along the line from the popup's middle its edge is.
        const exit = Math.min(
            dx === 0 ? Infinity : POPUP_WIDTH / 2 / Math.abs(dx),
            dy === 0 ? Infinity : popupHeight / 2 / Math.abs(dy)
        )
        if (exit * length + target.radius >= length) return undefined

        return {
            start: { x: middle.x + dx * exit, y: middle.y + dy * exit },
            end: {
                x: target.center.x - (dx / length) * target.radius,
                y: target.center.y - (dy / length) * target.radius
            }
        }
    })

    function reposition() {
        if (hovered || pinned) placePopup()
    }

    function show() {
        placePopup()
        hovered = true
    }

    function togglePin() {
        placePopup()
        pinned = !pinned
    }

    function onClick() {
        if (!onchoose) {
            togglePin()
            return
        }
        if (lastPointerType === 'touch' && !pinned) {
            placePopup()
            pinned = true
            return
        }
        pinned = false
        hovered = false
        onchoose()
    }

    function unpinOutside(event: PointerEvent) {
        if (pinned && chip && event.target instanceof Node && !chip.contains(event.target)) {
            pinned = false
        }
    }
</script>

<svelte:window onpointerdown={unpinOutside} onresize={reposition} />

<button
    bind:this={chip}
    type="button"
    class="inline-flex items-center gap-1.5 border leading-tight {tint
        ? 'rounded-lg'
        : 'rounded-full'}
        {onchoose && !tint
        ? `border-2 px-4 py-1.5 text-sm font-semibold ${elevated ? 'border-amber-300 bg-amber-300/20 hover:bg-amber-300/30' : 'border-white bg-white/15 hover:bg-white/25'}`
        : tint
          ? `px-2 py-1 text-[11px] font-medium hover:brightness-125 ${pinned || active ? 'brightness-125' : ''} ${!active && onchoose && !note ? 'ring-1 ring-white/70' : ''}`
          : `px-2 py-0.5 text-xs border-current/35 hover:bg-black/20 ${pinned ? 'bg-black/25 border-current/70' : 'bg-black/10'}`}
        {pending ? 'border-dashed' : ''}
        {unspent === false || dimmed ? 'opacity-55' : ''}"
    class:playing={active && tint !== undefined}
    style={tint
        ? `border-color: ${tint}${pending ? 'e6' : 'b3'}; background-color: ${pending ? 'transparent' : `${tint}40`}; --glow: ${tint}`
        : undefined}
    onpointerdown={(event) => (lastPointerType = event.pointerType)}
    onmouseenter={show}
    onmouseleave={() => (hovered = false)}
    onfocus={show}
    onblur={() => (hovered = false)}
    onclick={onClick}
    aria-expanded={open}
>
    {#if dot}
        <span
            class="block h-2 w-2 shrink-0 rounded-full"
            style="background-color: {PLANET_FILL[dot]}"
            aria-hidden="true"
        ></span>
    {/if}
    {#if note}
        <span class="flex flex-col items-start text-left leading-tight">
            <span class="font-semibold">{name}{elevated ? ' ★' : ''}</span>
            <span class="text-[10px] opacity-75">{note}</span>
        </span>
    {:else}
        <span class={onchoose && !tint ? '' : 'font-medium'}>{name}{elevated ? ' ★' : ''}</span>
    {/if}
    {#if count > 1}
        <span class="opacity-75">×{count}</span>
    {/if}
    {#if pending}
        <span class="text-[10px] font-semibold uppercase tracking-wide opacity-75">Pending</span>
    {/if}
    {#if toPlace}
        <span
            class="rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-wide {tint
                ? 'text-[#0b1222]'
                : 'bg-current/20'}"
            style={tint ? `background-color: ${tint}` : undefined}
        >
            {toPlace.count} to place
        </span>
    {/if}
    {#if turnsLeft === 0}
        <span
            class="inline-flex items-center gap-1 text-[10px] font-bold uppercase leading-none tracking-wider text-[#ffe14d]"
        >
            <span aria-hidden="true">•</span>Ready
        </span>
    {:else if turnsLeft !== undefined}
        <span class="inline-flex gap-[3px]" aria-label="{turnsLeft} rounds left">
            {#each Array.from({ length: COOLDOWN_TURNS }, (_unused, i) => i) as pip (pip)}
                <span
                    class="block h-[7px] w-[7px] rounded-full border border-current
                        {pip < turnsLeft ? 'bg-current' : 'opacity-35'}"
                ></span>
            {/each}
        </span>
    {/if}
</button>

{#if open && trace && target}
    <svg class="pointer-events-none fixed inset-0 z-40 h-full w-full" aria-hidden="true">
        <line
            x1={trace.start.x}
            y1={trace.start.y}
            x2={trace.end.x}
            y2={trace.end.y}
            stroke={ACCENT}
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-dasharray="7 6"
            class="claim-link"
        ></line>
        <circle
            cx={target.center.x}
            cy={target.center.y}
            r={target.radius}
            fill="none"
            stroke={ACCENT}
            stroke-width="1.5"
        ></circle>
    </svg>
{/if}

{#if open && anchor}
    <div
        bind:clientHeight={popupHeight}
        class="pointer-events-none fixed z-50 rounded-[10px] border-2 border-[#8fb6ff] bg-[#0d1424]/75 backdrop-blur-sm px-4 py-3 text-left text-white shadow-xl"
        style="left: {anchor.left}px; width: {POPUP_WIDTH}px; {anchor.top !== undefined
            ? `top: ${anchor.top}px;`
            : `bottom: ${anchor.bottom}px;`}"
        role="tooltip"
    >
        <div class="flex items-start justify-between gap-3">
            <div>
                {#if category}
                    <div
                        class="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                        style="color: {PLANET_FILL[category.color]}"
                    >
                        {category.name}
                    </div>
                {/if}
                <div class="text-[19px] font-bold">{name}</div>
            </div>
            {#if colors}
                <div
                    class="flex shrink-0 gap-1"
                    aria-label="Matches {colors.join(' and ')} planets"
                >
                    {#each colors as color (color)}
                        <PlanetBadge {color} copy="{name}-{color}" />
                    {/each}
                </div>
            {/if}
        </div>
        <div class="mt-1 text-[15px] leading-snug text-white/80">{ability}</div>
        {#if timing}
            <!-- Whether it is a one-shot or on a timer. -->
            <div class="mt-1.5 text-[13px] leading-snug text-white/70">
                <span
                    class="mr-1 rounded border border-white/40 px-1 py-px text-[10px] font-bold uppercase tracking-wider text-white"
                    >{timing.label}</span
                >{timing.text}
            </div>
        {/if}
        {#if detail}
            <div class="mt-1 text-[13px] text-white/60">{detail}</div>
        {/if}
        {#if status}
            <div class="mt-2 text-[13px] font-semibold text-[#8fb6ff]">{status}</div>
        {/if}
    </div>
{/if}

<style>
    /* The dashes drift slowly from the popup toward the planet. */
    @keyframes claim-link-frames {
        to {
            stroke-dashoffset: -13;
        }
    }

    .claim-link {
        animation: claim-link-frames 2.5s linear infinite;
    }

    /* A power being played: a white edge and a glow in the player's color that swells and
       settles, drawing the eye to what the chip now asks for. */
    @keyframes playing-frames {
        from {
            box-shadow:
                0 0 0 2px rgb(255 255 255 / 0.8),
                0 0 4px 1px var(--glow);
        }
        to {
            box-shadow:
                0 0 0 2px rgb(255 255 255 / 0.8),
                0 0 14px 4px var(--glow);
        }
    }

    .playing {
        animation: playing-frames 0.9s ease-in-out infinite alternate;
    }

    @media (prefers-reduced-motion: reduce) {
        .claim-link {
            animation: none;
        }

        .playing {
            animation: none;
            box-shadow:
                0 0 0 2px rgb(255 255 255 / 0.8),
                0 0 10px 3px var(--glow);
        }
    }
</style>
