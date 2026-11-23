<script lang="ts">
    import type { RulesHelp } from '$lib/utils/rulesHelp.js'
    import RulesPill from './RulesPill.svelte'

    // A caption under a row, with a line out to each side that turns up at its end to take in
    // what sits above (the bracket Santiago uses under its bribe controls). With a rules note,
    // its pill follows the caption.
    let { text, help }: { text: string; help?: RulesHelp } = $props()
</script>

<div class="flex items-center gap-1.5 px-2 pb-1 text-white/45">
    <div class="relative flex-1" aria-hidden="true">
        <div class="absolute inset-x-0 top-0 border-t border-current"></div>
        <div class="absolute left-0 -top-1.5 h-1.5 border-l border-current"></div>
    </div>
    <span class="flex shrink-0 items-center">
        <span
            class="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em]"
            aria-hidden="true">{text}</span
        >
        {#if help}<RulesPill {help} />{/if}
    </span>
    <div class="relative flex-1" aria-hidden="true">
        <div class="absolute inset-x-0 top-0 border-t border-current"></div>
        <div class="absolute right-0 -top-1.5 h-1.5 border-r border-current"></div>
    </div>
</div>
