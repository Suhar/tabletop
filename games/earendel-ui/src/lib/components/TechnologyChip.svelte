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
    // Where the trace leaves the popup: level with the technology's name.
    const TRACE_ROW = 26
    const MIN_RUN = 14
    // When a 45° run can't reach the planet, the level part still takes this share of the way.
    const MIN_RUN_SHARE = 0.4

    let chip: HTMLButtonElement | undefined = $state()
    let hovered = $state(false)
    let pinned = $state(false)
    let anchor: { left: number; top?: number; bottom?: number } | undefined = $state()
    let target: { center: Point; radius: number } | undefined = $state()
    let viewportHeight = $state(0)
    let popupHeight = $state(0)

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
        const hex = document.querySelector(`[data-planet="${planet.q},${planet.r}"]`)
        if (!hex) return undefined
        const rect = hex.getBoundingClientRect()
        return {
            center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            radius: rect.height / 2
        }
    }

    // A circuit trace: level out of the popup's side, then an angled run, 45° where it fits, to
    // the planet's ring.
    let trace = $derived.by(() => {
        if (!anchor || !target || popupHeight === 0) return undefined
        const top = anchor.top ?? viewportHeight - (anchor.bottom ?? 0) - popupHeight
        const rightward = target.center.x > anchor.left + POPUP_WIDTH / 2
        const side = rightward ? 1 : -1
        const start = { x: rightward ? anchor.left + POPUP_WIDTH : anchor.left, y: top + TRACE_ROW }

        const rise = Math.abs(target.center.y - start.y)
        const reach = Math.abs(target.center.x - start.x)
        const junction = {
            x: start.x + side * Math.max(MIN_RUN, reach - rise, reach * MIN_RUN_SHARE),
            y: start.y
        }

        const dx = target.center.x - junction.x
        const dy = target.center.y - junction.y
        const length = Math.hypot(dx, dy) || 1
        const end = {
            x: target.center.x - (dx / length) * target.radius,
            y: target.center.y - (dy / length) * target.radius
        }
        return { path: `M${start.x},${start.y} H${junction.x} L${end.x},${end.y}`, junction }
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

{#if open && trace && target}
    <svg class="pointer-events-none fixed inset-0 z-40 h-full w-full" aria-hidden="true">
        <path
            d={trace.path}
            fill="none"
            stroke={color}
            stroke-width="1.25"
            stroke-linejoin="round"
        />
        <circle cx={trace.junction.x} cy={trace.junction.y} r="2.5" fill={color} />
        <circle
            cx={target.center.x}
            cy={target.center.y}
            r={target.radius}
            fill="none"
            stroke={color}
            stroke-width="1.5"
        />
    </svg>
{/if}

{#if open && anchor}
    <div
        bind:clientHeight={popupHeight}
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
