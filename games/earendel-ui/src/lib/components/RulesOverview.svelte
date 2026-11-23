<script lang="ts">
    import { fade } from 'svelte/transition'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { OverviewGroup, RULES_OVERVIEW } from '$lib/utils/rulesHelp.js'

    // The game in a handful of cards, over the whole table. Closed by its button, by a click
    // outside the cards, or by Escape.
    const gameSession = getGameSession()
    const close = () => (gameSession.overviewShown = false)

    // Each card is tinted by what it is about. None of these is a planet's color, which would
    // read as that planet's theme.
    const GROUPS: Record<OverviewGroup, { label: string; tint: string }> = {
        [OverviewGroup.Game]: { label: 'The game', tint: '#ffd27a' },
        [OverviewGroup.Ships]: { label: 'Ships', tint: '#8fb6ff' },
        [OverviewGroup.Scoring]: { label: 'Scoring', tint: '#ff9fb5' },
        [OverviewGroup.Technology]: { label: 'Technology', tint: '#d7dde8' }
    }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && close()} />

<div
    class="fixed inset-0 z-50 overflow-y-auto bg-[#05080f]/45"
    role="dialog"
    aria-modal="true"
    aria-label="Rules overview"
    tabindex="-1"
    transition:fade={{ duration: 200 }}
    onclick={(event) => event.target === event.currentTarget && close()}
    onkeydown={() => {}}
>
    <div class="pointer-events-none mx-auto max-w-[1100px] px-4 py-6 text-left text-white">
        <div class="pointer-events-auto mb-4 flex items-center justify-between">
            <div>
                <div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8fb6ff]">
                    Rules
                </div>
                <h2 class="text-2xl font-bold">Overview</h2>
            </div>
            <button
                type="button"
                class="rounded-md border-2 border-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-white/15"
                onclick={close}
            >
                Close
            </button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {#each RULES_OVERVIEW as { group, note } (note.title)}
                {@const { label, tint } = GROUPS[group]}
                <!-- See-through, with the table blurred behind each card, and a wash of the
                     group's tint over the dark. -->
                <section
                    class="pointer-events-auto rounded-[10px] border-2 px-4 py-3 backdrop-blur-md"
                    style="border-color: {tint}b3; background: linear-gradient({tint}1f, {tint}12), rgb(13 20 36 / 0.62)"
                >
                    <div
                        class="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style="color: {tint}"
                    >
                        {label}
                    </div>
                    <h3 class="text-[17px] font-bold">{note.title}</h3>
                    <p class="mt-1 text-[14px] leading-snug text-white/90">{note.lead}</p>
                    {#if note.points.length > 0}
                        <ul
                            class="mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-snug text-white/75"
                        >
                            {#each note.points as point (point)}
                                <li>{point}</li>
                            {/each}
                        </ul>
                    {/if}
                </section>
            {/each}
        </div>
    </div>
</div>
