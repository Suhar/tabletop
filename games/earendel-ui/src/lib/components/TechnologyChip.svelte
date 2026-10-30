<script lang="ts">
    import { COOLDOWN_TURNS } from '@tabletop/earendel'

    let {
        name,
        ability,
        count = 1,
        turnsLeft,
        unspent,
        pending = false
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
    } = $props()

    const POPUP_WIDTH = 300
    const GAP = 6
    const MARGIN = 8

    let chip: HTMLButtonElement | undefined = $state()
    let hovered = $state(false)
    let pinned = $state(false)
    let anchor: { left: number; top?: number; bottom?: number } | undefined = $state()

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
        anchor =
            rect.bottom > window.innerHeight * 0.6
                ? { left, bottom: window.innerHeight - rect.top + GAP }
                : { left, top: rect.bottom + GAP }
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

<svelte:window onpointerdown={unpinOutside} />

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
