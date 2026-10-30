<script lang="ts">
    import type { AxialCoordinates, Point } from '@tabletop/common'
    import { COOLDOWN_TURNS } from '@tabletop/earendel'

    let {
        name,
        ability,
        count = 1,
        turnsLeft,
        unspent,
        pending = false,
        planet,
        color = '#8fb6ff'
    }: {
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
        color?: string
    } = $props()

    const POPUP_WIDTH = 300
    const GAP = 6
    const MARGIN = 8
    const ROOM_ABOVE = 180

    let chip: HTMLButtonElement | undefined = $state()
    let hovered = $state(false)
    let pinned = $state(false)
    let anchor: { left: number; top?: number; bottom?: number } | undefined = $state()
    let link: { from: Point; to: Point; radius: number } | undefined = $state()

    let open = $derived(hovered || pinned)

    let status = $derived.by(() => {
        if (pending) {
            return "Pending: researched at this player's next turn if their probes still lead the planet."
        }
        if (turnsLeft !== undefined) {
            if (turnsLeft === 0) return 'Ready to use.'
            return `Ready in ${turnsLeft} more ${turnsLeft === 1 ? 'round' : 'rounds'}.`
        }
        if (unspent !== undefined) return unspent ? 'Not used yet.' : 'Used.'
        return undefined
    })

    // Fixed to the viewport so a scrolling side panel can't clip it.
    function placePopup() {
        if (!chip) return
        const rect = chip.getBoundingClientRect()
        const left = Math.min(
            Math.max(rect.left, MARGIN),
            window.innerWidth - POPUP_WIDTH - MARGIN
        )
        link = planetLink(rect)
        // Open away from the planet so the popup doesn't hide the line to it.
        const above = link
            ? link.to.y > rect.bottom && rect.top > ROOM_ABOVE
            : rect.bottom > window.innerHeight * 0.6
        anchor = above
            ? { left, bottom: window.innerHeight - rect.top + GAP }
            : { left, top: rect.bottom + GAP }
    }

    // From the chip's edge to the planet on the board, both in viewport coordinates.
    function planetLink(rect: DOMRect): { from: Point; to: Point; radius: number } | undefined {
        if (!planet) return undefined
        const hex = document.querySelector(`[data-planet="${planet.q},${planet.r}"]`)
        if (!hex) return undefined
        const target = hex.getBoundingClientRect()
        const to = { x: target.left + target.width / 2, y: target.top + target.height / 2 }
        return {
            from: { x: to.x > rect.right ? rect.right : rect.left, y: rect.top + rect.height / 2 },
            to,
            radius: target.height / 2
        }
    }

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
    class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs leading-tight
        border-current/35 hover:bg-black/20 {pinned ? 'bg-black/25 border-current/70' : 'bg-black/10'}
        {pending ? 'border-dashed' : ''}
        {unspent === false ? 'opacity-55' : ''}"
    onmouseenter={show}
    onmouseleave={() => (hovered = false)}
    onfocus={show}
    onblur={() => (hovered = false)}
    onclick={togglePin}
    aria-expanded={open}
>
    <span class="font-medium">{name}</span>
    {#if count > 1}
        <span class="opacity-75">×{count}</span>
    {/if}
    {#if pending}
        <span class="text-[10px] font-semibold uppercase tracking-wide opacity-75">Pending</span>
    {/if}
    {#if turnsLeft !== undefined}
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

{#if open && link}
    {@const dx = link.to.x - link.from.x}
    {@const dy = link.to.y - link.from.y}
    {@const distance = Math.hypot(dx, dy) || 1}
    <svg class="pointer-events-none fixed inset-0 z-40 h-full w-full" aria-hidden="true">
        <line
            x1={link.from.x}
            y1={link.from.y}
            x2={link.to.x - (dx / distance) * link.radius}
            y2={link.to.y - (dy / distance) * link.radius}
            stroke={color}
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-dasharray="7 6"
            class="claim-link"
        />
        <circle cx={link.from.x} cy={link.from.y} r="3.5" fill={color} />
        <circle
            cx={link.to.x}
            cy={link.to.y}
            r={link.radius}
            fill="none"
            stroke={color}
            stroke-width="3"
            stroke-opacity="0.9"
        />
    </svg>
{/if}

{#if open && anchor}
    <div
        class="pointer-events-none fixed z-50 rounded-[10px] border-2 border-[#8fb6ff] bg-[#0d1424]/[0.97] px-4 py-3 text-left text-white shadow-xl"
        style="left: {anchor.left}px; width: {POPUP_WIDTH}px; {anchor.top !== undefined
            ? `top: ${anchor.top}px;`
            : `bottom: ${anchor.bottom}px;`}"
        role="tooltip"
    >
        <div class="text-[19px] font-bold">{name}</div>
        <div class="mt-1 text-[15px] leading-snug text-white/80">{ability}</div>
        {#if status}
            <div class="mt-2 text-[13px] font-semibold text-[#8fb6ff]">{status}</div>
        {/if}
    </div>
{/if}

<style>
    /* The dashes flow from the player's panel toward the planet. */
    @keyframes claim-link-frames {
        to {
            stroke-dashoffset: -26;
        }
    }

    .claim-link {
        animation: claim-link-frames 1s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
        .claim-link {
            animation: none;
        }
    }
</style>
