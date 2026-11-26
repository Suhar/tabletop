<script lang="ts">
    import type { Block, Inline } from '$lib/utils/markdown.js'

    let { blocks }: { blocks: Block[] } = $props()
</script>

{#snippet inlines(parts: Inline[])}
    {#each parts as part, index (index)}
        {#if part.kind === 'text'}{part.text}{:else if part.kind === 'strong'}<strong
                >{@render inlines(part.children)}</strong
            >{:else if part.kind === 'em'}<em>{@render inlines(part.children)}</em
            >{:else if part.kind === 'code'}<code>{part.text}</code>{:else}<br />{/if}
    {/each}
{/snippet}

{#snippet blockList(items: Block[])}
    {#each items as block, index (index)}
        {#if block.kind === 'heading'}
            {#if block.depth === 1}
                <h1>{@render inlines(block.inline)}</h1>
            {:else}
                <h2>{@render inlines(block.inline)}</h2>
            {/if}
        {:else if block.kind === 'paragraph'}
            <p>{@render inlines(block.inline)}</p>
        {:else if block.kind === 'list'}
            {#if block.ordered}
                <ol>
                    {#each block.items as item, itemIndex (itemIndex)}
                        <li>{@render blockList(item)}</li>
                    {/each}
                </ol>
            {:else}
                <ul>
                    {#each block.items as item, itemIndex (itemIndex)}
                        <li>{@render blockList(item)}</li>
                    {/each}
                </ul>
            {/if}
        {:else}
            <hr />
        {/if}
    {/each}
{/snippet}

{@render blockList(blocks)}
