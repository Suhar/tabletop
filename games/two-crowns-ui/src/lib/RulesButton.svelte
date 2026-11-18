<script lang="ts">
    // The rulebook is large, so it loads the first time the dialog opens.
    type Rulebook = typeof import('./rules/rulebook.js')
    let dialog: HTMLDialogElement | undefined = $state()
    let body: HTMLElement | undefined = $state()
    let rulebook: Rulebook | undefined = $state()
    let failed = $state(false)

    async function open() {
        dialog?.showModal()
        if (rulebook) return
        try {
            rulebook = await import('./rules/rulebook.js')
        } catch {
            failed = true
        }
    }
    function jump(event: MouseEvent, id: string) {
        event.preventDefault()
        body?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start' })
    }
</script>

<button class="rules-button" aria-label="Rules" title="Rules" aria-haspopup="dialog" onclick={open}
    >?</button
>
<dialog
    bind:this={dialog}
    class="rules-dialog"
    aria-labelledby="rules-title"
    onclick={(event) => {
        if (event.target === dialog) dialog?.close()
    }}
>
    <header>
        <h2 id="rules-title">
            Rules{#if rulebook}<span class="version">version {rulebook.RulebookVersion}</span>{/if}
        </h2>
        <button class="close" aria-label="Close the rules" onclick={() => dialog?.close()}>×</button
        >
    </header>
    {#if rulebook}
        <nav aria-label="Rule sections">
            {#each rulebook.RulebookContents as section (section.id)}<a
                    href={`#${section.id}`}
                    onclick={(event) => jump(event, section.id)}>{section.title}</a
                >{/each}
        </nav>
        <article bind:this={body} class="rulebook">
            <!-- The rulebook comes from the design repo through the sync; no player content. -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html rulebook.RulebookHtml}
        </article>
    {:else if failed}
        <p class="status">The rules couldn’t load. Close this and try again.</p>
    {:else}
        <p class="status">Loading the rules…</p>
    {/if}
</dialog>

<style>
    .rules-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        margin-left: -4px;
        border: 1.5px solid currentColor;
        border-radius: 50%;
        color: var(--rail-muted, #786550);
        font-size: 14px;
        font-weight: 700;
        line-height: 1;
    }
    .rules-button:hover {
        color: var(--rail-text, #443c34);
    }
    .rules-dialog {
        width: min(860px, calc(100vw - 24px));
        height: min(88dvh, 1100px);
        max-width: none;
        max-height: none;
        margin: auto;
        padding: 0;
        border: 1px solid var(--rules-border);
        border-radius: 8px;
        background: var(--rules-surface);
        color: var(--rules-text);
        box-shadow: 0 18px 50px #0007;
        /* Its own colours: on your turn the header it opens from swaps in dark text for its
           light background, which the dialog would otherwise inherit onto its dark surface. */
        --rules-text: #ffffff;
        --rules-muted: #b9c4cf;
        --rules-border: #485666;
        --rules-surface: #222c37;
        --rules-hover: #ffffff18;
        color-scheme: dark;
        /* It opens from the table header, whose text settings it would otherwise inherit. */
        white-space: normal;
        text-align: left;
        text-transform: none;
        letter-spacing: normal;
        font-weight: 400;
    }
    .rules-dialog[open] {
        display: flex;
        flex-direction: column;
    }
    .rules-dialog::backdrop {
        background: #0009;
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px 10px 18px;
        border-bottom: 1px solid var(--rules-border);
    }
    h2 {
        display: flex;
        align-items: baseline;
        gap: 10px;
        font-size: 18px;
        font-weight: 700;
    }
    .version {
        color: var(--rules-muted);
        font-size: 13px;
        font-weight: 500;
    }
    .close {
        width: 32px;
        height: 32px;
        border-radius: 4px;
        color: var(--rules-muted);
        font-size: 24px;
        line-height: 1;
    }
    .close:hover {
        background: var(--rules-hover);
        color: var(--rules-text);
    }
    nav {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        padding: 8px 18px;
        border-bottom: 1px solid var(--rules-border);
        font-size: 12px;
    }
    nav a {
        color: var(--rules-muted);
    }
    nav a:hover {
        color: var(--rules-text);
        text-decoration: underline;
    }
    .status {
        padding: 18px;
        color: var(--rules-muted);
    }
    .rulebook {
        flex: 1;
        overflow-y: auto;
        padding: 6px 22px 28px;
        font-size: 14px;
        line-height: 1.55;
    }
    .rulebook :global(h1) {
        margin: 26px 0 8px;
        font-size: 19px;
        font-weight: 700;
        scroll-margin-top: 8px;
    }
    .rulebook :global(h2) {
        margin: 18px 0 6px;
        font-size: 16px;
        font-weight: 700;
        scroll-margin-top: 8px;
    }
    .rulebook :global(h3) {
        margin: 14px 0 4px;
        font-size: 14px;
        font-weight: 700;
    }
    .rulebook :global(p),
    .rulebook :global(ul),
    .rulebook :global(ol),
    .rulebook :global(table) {
        margin: 0 0 10px;
    }
    .rulebook :global(ul) {
        padding-left: 22px;
        list-style: disc;
    }
    .rulebook :global(ol) {
        padding-left: 22px;
        list-style: decimal;
    }
    .rulebook :global(li) {
        margin-bottom: 4px;
    }
    .rulebook :global(table) {
        display: block;
        overflow-x: auto;
        border-collapse: collapse;
        font-size: 13px;
    }
    .rulebook :global(th),
    .rulebook :global(td) {
        padding: 4px 8px;
        border: 1px solid var(--rules-border);
        vertical-align: top;
    }
    .rulebook :global(a) {
        text-decoration: underline;
        text-underline-offset: 2px;
    }
    .rulebook :global(blockquote) {
        margin: 0 0 10px;
        padding-left: 12px;
        border-left: 3px solid var(--rules-border);
        color: var(--rules-muted);
    }
</style>
