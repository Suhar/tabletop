<script lang="ts">
    import type { User } from '@tabletop/common'
    import type { Snippet } from 'svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    let {
        onerror,
        ondetails,
        empty
    }: {
        onerror: (message: string) => void
        ondetails?: (user: User) => void
        empty?: Snippet
    } = $props()

    const { api } = getAppContext()

    // SuharTabletop sends no verification email: new accounts wait here for approval.
    let awaiting = $state<User[]>([])
    let loaded = $state(false)
    let approving = $state<string>()
    $effect(() => {
        api.getSignUpsAwaitingApproval().then(
            (users) => {
                awaiting = users
                loaded = true
            },
            () => (awaiting = [])
        )
    })

    async function approve(user: User) {
        approving = user.id
        onerror('')
        try {
            await api.approveUser(user.id)
            awaiting = awaiting.filter((waiting) => waiting.id !== user.id)
        } catch (failure) {
            onerror(failure instanceof Error ? failure.message : 'Could not approve the account')
        } finally {
            approving = undefined
        }
    }
</script>

{#if awaiting.length}
    <section class="mb-6" aria-labelledby="awaiting-heading">
        <h2 id="awaiting-heading" class="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            Waiting for approval
        </h2>
        <ul
            class="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700/60 dark:border-gray-700/60"
        >
            {#each awaiting as user (user.id)}
                <li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span class="flex flex-col gap-0.5">
                        <span class="font-medium">{user.username ?? user.id}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400"
                            >{user.email} · signed up {user.createdAt
                                ? new Date(user.createdAt).toLocaleDateString()
                                : ''}</span
                        >
                    </span>
                    <span class="flex gap-2">
                        {#if ondetails}
                            <button
                                type="button"
                                onclick={() => ondetails(user)}
                                class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                                >Details</button
                            >
                        {/if}
                        <button
                            type="button"
                            disabled={approving === user.id}
                            onclick={() => approve(user)}
                            class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                            >Approve</button
                        >
                    </span>
                </li>
            {/each}
        </ul>
    </section>
{:else if loaded}
    {@render empty?.()}
{/if}
