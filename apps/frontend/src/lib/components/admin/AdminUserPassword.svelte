<script lang="ts">
    import { UserStatus, type User } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { AdminSubmission } from './adminSubmission.svelte'

    let { user }: { user: User } = $props()

    const { api } = getAppContext()
    const submission = new AdminSubmission('Could not set the password')
    let password = $state<{ userId: string; value: string }>()

    // Letters and digits that can't be mistaken for one another when read out.
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    function temporaryPassword(): string {
        const bytes = crypto.getRandomValues(new Uint8Array(14))
        return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
    }

    function reset() {
        const name = user.username ?? user.id
        if (!confirm(`Give ${name} a new password? Their current one stops working.`)) return
        const value = temporaryPassword()
        void submission.run(async () => {
            await api.setUserPassword(user.id, value)
            password = { userId: user.id, value }
        })
    }
</script>

{#if user.status === UserStatus.Active}
    <section
        class="rounded-xl border border-gray-200 p-4 dark:border-gray-700/60"
        aria-label={`Password for ${user.username ?? user.id}`}
    >
        {#if password?.userId === user.id}
            <p class="text-sm text-gray-600 dark:text-gray-300">
                New password, to pass on to {user.username}:
            </p>
            <p class="mt-2 font-mono text-lg select-all">{password.value}</p>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                It's shown only now. They can change it in their profile.
            </p>
        {:else}
            <button
                type="button"
                disabled={submission.saving}
                onclick={reset}
                class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                >Set a new password</button
            >
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                For a player who forgot theirs. You pass it on; nothing is emailed.
            </p>
        {/if}
        {#if submission.error}<p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">
                {submission.error}
            </p>{/if}
    </section>
{/if}
