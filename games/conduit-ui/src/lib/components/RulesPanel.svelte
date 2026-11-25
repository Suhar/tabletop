<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import rulesText from '$lib/rules/rules.md?raw'
    import { parseMarkdown } from '$lib/utils/markdown.js'
    import RulesText from './RulesText.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const rules = parseMarkdown(rulesText)

    const holdFocus: Attachment<HTMLElement> = (panel) => {
        const opener = document.activeElement
        panel.focus()
        return () => {
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
        }
    }

    function closeOnEscape(event: KeyboardEvent) {
        if (event.key !== 'Escape') return
        event.preventDefault()
        gameSession.closeRules()
    }
</script>

<svelte:window onkeydown={closeOnEscape} />

<div class="backdrop" role="presentation" onclick={() => gameSession.closeRules()}>
    <div
        class="rules"
        role="dialog"
        aria-label="Rules"
        tabindex="-1"
        {@attach holdFocus}
        onclick={(event) => event.stopPropagation()}
        onkeydown={closeOnEscape}
    >
        <button class="close" aria-label="Close the rules" onclick={() => gameSession.closeRules()}
            >×</button
        >
        <article class="text"><RulesText blocks={rules} /></article>
    </div>
</div>

<style>
    .backdrop {
        position: absolute;
        inset: 0;
        z-index: 40;
        display: flex;
        padding: 12px;
        background: rgb(5 9 14 / 0.6);
    }

    .rules {
        position: relative;
        width: min(720px, 100%);
        max-height: 100%;
        margin: 0 auto;
        overflow-y: auto;
        border-radius: 10px;
        color: var(--conduit-paper-ink);
        background: var(--conduit-paper);
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);
        outline: none;
    }

    .close {
        position: sticky;
        top: 8px;
        float: right;
        width: 32px;
        height: 32px;
        margin: 8px 8px 0 0;
        border-radius: 999px;
        font-size: 22px;
        line-height: 1;
        color: var(--conduit-paper-ink);
        background: rgb(0 0 0 / 0.08);
    }

    .text {
        padding: 18px 24px 28px;
        font-size: 15px;
        line-height: 1.55;
    }

    .text :global(h1) {
        font-size: 26px;
        font-weight: 800;
        margin-bottom: 4px;
    }

    .text :global(h2) {
        font-size: 18px;
        font-weight: 700;
        margin: 18px 0 6px;
    }

    .text :global(p) {
        margin: 6px 0;
    }

    .text :global(ul) {
        list-style: disc;
        padding-left: 22px;
    }

    .text :global(ol) {
        list-style: decimal;
        padding-left: 22px;
    }

    .text :global(li) {
        margin: 3px 0;
    }

    .text :global(li > h2) {
        display: inline;
    }

    .text :global(li > p) {
        margin: 0;
    }

    .text :global(hr) {
        margin: 14px 0;
        border-color: rgb(0 0 0 / 0.15);
    }

    @media (max-width: 639px) {
        .backdrop {
            position: fixed;
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
                env(safe-area-inset-left);
        }

        .rules {
            width: 100%;
            border-radius: 0;
        }

        .text {
            padding: 12px 16px 24px;
        }
    }
</style>
