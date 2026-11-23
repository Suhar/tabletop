<script lang="ts" generics="T">
    import { onMount, tick, type Snippet } from 'svelte'
    import { gsap } from 'gsap'
    import type { RulesHelp } from '$lib/utils/rulesHelp.js'
    import BracketCaption from './BracketCaption.svelte'

    // A row of mini cards above the side panels that, clicked, deals the full cards out into a
    // column down the left of the board to read, each sliding in from behind the left panel.
    // Local presentation only: reading the cards changes nothing in the game, so the motion is
    // owned here, not by the state-change animators.
    let {
        entries,
        id,
        label,
        caption,
        help,
        tint,
        title,
        dimmed = () => false,
        mini,
        card
    }: {
        entries: T[]
        id: (entry: T) => string
        // The row's accessible name.
        label: string
        // The caption bracketed under the row.
        caption: string
        // The rules note whose pill follows the caption, when there is one to show.
        help?: RulesHelp
        // Each mini card's edge color and its hover text.
        tint: (entry: T) => string
        title: (entry: T) => string
        dimmed?: (entry: T) => boolean
        // What a mini card shows, and the full card, grown when asked.
        mini: Snippet<[T]>
        card: Snippet<[T, boolean]>
    } = $props()

    let dealt = $state(false)
    // The dealt card grown to read: hovered, or clicked to keep it so on touch.
    let enlargedId: string | undefined = $state()
    let pinnedId: string | undefined = $state()
    let busy = false
    let miniElements: Record<string, HTMLElement> = {}
    let cardElements: Record<string, HTMLElement> = {}
    // Clips the column at the left panel's edge, so the cards emerge from behind it.
    let clip: HTMLElement | undefined = $state()
    let timeline: gsap.core.Timeline | undefined
    onMount(() => () => timeline?.kill())

    const DEAL_GAP = 0.1
    const DEAL_SLIDE = 0.45
    const GATHER_FADE = 0.25

    const reducedMotion = () =>
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Each dealt card with the mini card it flies from.
    function pairs(): { big: HTMLElement; mini: HTMLElement }[] {
        return entries.flatMap((entry) => {
            const big = cardElements[id(entry)]
            const small = miniElements[id(entry)]
            return big && small ? [{ big, mini: small }] : []
        })
    }

    async function deal() {
        if (busy || dealt) return
        busy = true
        dealt = true
        await tick()
        const flights = pairs()
        if (flights.length === 0 || reducedMotion()) {
            busy = false
            return
        }

        // Each card starts wholly behind the panel's edge and slides to its place in the column.
        const edge = clip?.getBoundingClientRect().left ?? 0
        timeline?.kill()
        timeline = gsap.timeline({
            onComplete: () => {
                for (const { big } of flights) gsap.set(big, { clearProps: 'all' })
                busy = false
            }
        })
        flights.forEach(({ big }, index) => {
            const hidden = -(big.getBoundingClientRect().right - edge)
            timeline!.fromTo(
                big,
                { x: hidden },
                { x: 0, duration: DEAL_SLIDE, ease: 'power2.out' },
                index * DEAL_GAP
            )
        })
    }

    function gather() {
        if (busy || !dealt) return
        enlargedId = undefined
        pinnedId = undefined
        const targets = pairs().map((flight) => flight.big)
        if (targets.length === 0 || reducedMotion()) {
            dealt = false
            return
        }
        busy = true
        timeline?.kill()
        // A plain fade: nothing flies back.
        timeline = gsap.timeline({
            onComplete: () => {
                dealt = false
                busy = false
            }
        })
        timeline.to(targets, { opacity: 0, duration: GATHER_FADE, ease: 'power1.out' }, 0)
    }

    function toggle() {
        if (dealt) gather()
        else void deal()
    }

    function onKey(event: KeyboardEvent) {
        if (event.key === 'Escape' && dealt) gather()
    }

    function registerMini(node: HTMLElement, key: string) {
        miniElements[key] = node
        return {
            destroy() {
                if (miniElements[key] === node) delete miniElements[key]
            }
        }
    }

    function registerCard(node: HTMLElement, key: string) {
        cardElements[key] = node
        return {
            destroy() {
                if (cardElements[key] === node) delete cardElements[key]
            }
        }
    }
</script>

<svelte:window onkeydown={onKey} />

{#if entries.length > 0}
    <div
        class="flex items-stretch justify-center gap-1.5 px-2 pt-1 pb-1"
        role="group"
        aria-label={label}
    >
        {#each entries as entry (id(entry))}
            <button
                use:registerMini={id(entry)}
                type="button"
                class="relative flex w-[56px] flex-col items-center rounded-md border bg-[#0d1424] px-0.5 pb-1 pt-1 text-white hover:brightness-125 {dimmed(
                    entry
                )
                    ? 'opacity-55'
                    : ''}"
                style="border-color: {tint(entry)}"
                title="{title(entry)}. Click to read the cards."
                aria-expanded={dealt}
                onclick={toggle}
            >
                {@render mini(entry)}
            </button>
        {/each}
    </div>
    <BracketCaption text={caption} {help} />

    {#if dealt}
        <!-- Dealt into a column down the left of the board; a click anywhere else gathers them
             again. -->
        <div class="fixed inset-0 z-40" role="presentation" onclick={gather}>
            <div
                bind:this={clip}
                class="absolute inset-y-0 left-[340px] right-0 overflow-hidden max-sm:left-2"
            >
                <div class="flex h-full flex-col justify-center gap-2 py-4">
                    {#each entries as entry (id(entry))}
                        {@const enlarged = (pinnedId ?? enlargedId) === id(entry)}
                        <div
                            use:registerCard={id(entry)}
                            class="relative {enlarged ? 'z-10' : ''}"
                            role="presentation"
                            onmouseenter={() => (enlargedId = id(entry))}
                            onmouseleave={() => (enlargedId = undefined)}
                            onclick={(event) => {
                                event.stopPropagation()
                                pinnedId = pinnedId === id(entry) ? undefined : id(entry)
                            }}
                        >
                            {@render card(entry, enlarged)}
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
{/if}
