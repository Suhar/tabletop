<script lang="ts">
    import { LatestRequest } from '$lib/utils/latestRequest'
    import { ADMIN_ASSIGNABLE_ROLES, Role, UserStatus, type User } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import AdminUserBan from './AdminUserBan.svelte'
    import AdminUserDelete from './AdminUserDelete.svelte'
    import AdminUserPassword from './AdminUserPassword.svelte'
    import AdminUserRoles from './AdminUserRoles.svelte'
    import AdminUserUsername from './AdminUserUsername.svelte'

    const { api } = getAppContext()
    const roleLabels: Record<Role, string> = {
        [Role.User]: 'User',
        [Role.Admin]: 'Admin',
        [Role.Developer]: 'Developer',
        [Role.BetaTester]: 'Beta tester',
        [Role.AlphaTester]: 'Alpha tester'
    }
    const statusLabels: Record<UserStatus, string> = {
        [UserStatus.Active]: 'active',
        [UserStatus.Incomplete]: 'incomplete',
        [UserStatus.Inactive]: 'banned',
        [UserStatus.Deleted]: 'deleted'
    }

    let query = $state('')
    let users = $state<User[]>([])
    let selected = $state<User>()
    let busy = $state(false)
    let searched = $state(false)
    let error = $state('')
    const requests = new LatestRequest()

    // SuharTabletop sends no verification email: new accounts wait here for approval.
    let awaiting = $state<User[]>([])
    let approving = $state<string>()
    $effect(() => {
        api.getSignUpsAwaitingApproval().then(
            (users) => (awaiting = users),
            () => (awaiting = [])
        )
    })

    async function approve(user: User) {
        approving = user.id
        error = ''
        try {
            await api.approveUser(user.id)
            awaiting = awaiting.filter((waiting) => waiting.id !== user.id)
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not approve the account'
        } finally {
            approving = undefined
        }
    }

    async function search(event: SubmitEvent) {
        event.preventDefault()
        const current = requests.begin()
        busy = true
        error = ''
        try {
            const results = await api.searchUsers(query)
            if (!current()) return
            users = results
            searched = true
            selected = results.find((user) => user.id === selected?.id)
        } catch (failure) {
            if (current())
                error = failure instanceof Error ? failure.message : 'Could not search users'
        } finally {
            if (current()) busy = false
        }
    }

    function replaceUser(updated: User) {
        users = users.map((user) => (user.id === updated.id ? updated : user))
        selected = updated
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
                        <button
                            type="button"
                            onclick={() => {
                                users = [user]
                                selected = user
                            }}
                            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                            >Details</button
                        >
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
{/if}
<form class="flex flex-wrap items-end gap-3" onsubmit={search}>
    <label class="flex grow flex-col gap-1 text-sm sm:max-w-md">
        <span class="text-gray-600 dark:text-gray-300">Username or email</span>
        <input
            type="search"
            name="query"
            bind:value={query}
            autocomplete="off"
            class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
    </label>
    <button
        type="submit"
        disabled={busy || !query.trim()}
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >Search</button
    >
</form>
{#if error}<p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>{/if}
<div class="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div aria-busy={busy}>
        {#if searched && !users.length && !busy}
            <p class="text-sm text-gray-500 dark:text-gray-400">No users match that search.</p>
        {/if}
        {#if users.length}
            <ul
                class="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700/60 dark:border-gray-700/60"
            >
                {#each users as user (user.id)}
                    <li>
                        <button
                            type="button"
                            aria-pressed={selected?.id === user.id}
                            onclick={() => (selected = user)}
                            class="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-gray-50 aria-pressed:bg-blue-50 dark:hover:bg-gray-800/60 dark:aria-pressed:bg-blue-900/30"
                        >
                            <span class="font-medium">{user.username ?? user.id}</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">
                                {user.email ?? 'No email'} · {statusLabels[user.status]} ·
                                {user.roles.map((role) => roleLabels[role]).join(', ')}
                            </span>
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
    {#if selected}
        <div class="flex flex-col gap-5">
            {#if selected.status !== UserStatus.Deleted}
                <AdminUserUsername user={selected} onsaved={replaceUser} />
                <AdminUserRoles
                    user={selected}
                    assignableRoles={ADMIN_ASSIGNABLE_ROLES}
                    {roleLabels}
                    onsaved={replaceUser}
                />
                <AdminUserPassword user={selected} />
                <AdminUserBan user={selected} onsaved={replaceUser} />
            {/if}
            <AdminUserDelete user={selected} onsaved={replaceUser} />
        </div>
    {/if}
</div>
