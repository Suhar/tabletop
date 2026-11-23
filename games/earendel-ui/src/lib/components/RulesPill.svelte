<script lang="ts">
    import type { RulesHelp } from '$lib/utils/rulesHelp.js'

    // A small pill beside a decision that gives the rules for it: hover or focus shows the
    // note, a click (or a tap) pins it open, a click anywhere else lets it go.
    let { help }: { help: RulesHelp } = $props()

    const POPUP_WIDTH = 340
    const GAP = 6
    const MARGIN = 8

    let pill: HTMLButtonElement | undefined = $state()
    let hovered = $state(false)
    let pinned = $state(false)
    let anchor: { left: number; top: number } | undefined = $state()
    let open = $derived(hovered || pinned)

    // Fixed to the viewport, under the pill, so nothing around the action panel can clip it.
    function place() {
        if (!pill) return
        const rect = pill.getBoundingClientRect()
        anchor = {
            left: Math.min(
                Math.max(rect.left + rect.width / 2 - POPUP_WIDTH / 2, MARGIN),
                Math.max(MARGIN, window.innerWidth - POPUP_WIDTH - MARGIN)
            ),
            top: rect.bottom + GAP
        }
    }

    function show() {
        place()
        hovered = true
    }

    function togglePin() {
        place()
        pinned = !pinned
    }

    function unpinOutside(event: PointerEvent) {
        if (pinned && pill && event.target instanceof Node && !pill.contains(event.target)) {
            pinned = false
        }
    }
</script>

<svelte:window onpointerdown={unpinOutside} onresize={() => open && place()} />

<button
    bind:this={pill}
    type="button"
    class="ml-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border align-middle text-[11px] font-semibold uppercase tracking-wide
        {pinned
        ? 'border-[#8fb6ff] bg-[#8fb6ff]/30 text-white'
        : 'border-[#8fb6ff]/70 bg-[#8fb6ff]/10 text-[#c9dcff] hover:bg-[#8fb6ff]/25'}"
    onmouseenter={show}
    onmouseleave={() => (hovered = false)}
    onfocus={show}
    onblur={() => (hovered = false)}
    onclick={togglePin}
    aria-expanded={open}
    aria-label="Rules: {help.title}"
>
    ?
</button>

{#if open && anchor}
    <div
        class="pointer-events-none fixed z-50 rounded-[10px] border-2 border-[#8fb6ff] bg-[#0d1424]/75 backdrop-blur-sm px-4 py-3 whitespace-normal text-left normal-case tracking-normal text-white shadow-xl"
        style="left: {anchor.left}px; top: {anchor.top}px; width: {POPUP_WIDTH}px; max-width: calc(100vw - {2 *
            MARGIN}px)"
        role="tooltip"
    >
        <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8fb6ff]">
            Rules
        </div>
        <div class="text-[19px] font-bold">{help.title}</div>
        <div class="mt-1 text-[15px] leading-snug text-white/90">{help.lead}</div>
        <ul class="mt-2 list-disc space-y-1.5 pl-4 text-[14px] leading-snug text-white/75">
            {#each help.points as point (point)}
                <li>{point}</li>
            {/each}
        </ul>
    </div>
{/if}
