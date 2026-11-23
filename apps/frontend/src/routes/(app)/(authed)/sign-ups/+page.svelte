<script lang="ts">
    import AdminSignUpApprovals from '$lib/components/admin/AdminSignUpApprovals.svelte'

    let error = $state('')
</script>

<svelte:head><title>Sign-ups · Tabletop</title></svelte:head>
<main class="collection-page pb-10 text-gray-900 dark:text-gray-100">
    <header class="collection-header">
        <h1 class="collection-heading">Sign-ups</h1>
    </header>
    <div class="pt-5">
        {#if error}<p role="alert" class="mb-4 text-sm text-red-600 dark:text-red-300">
                {error}
            </p>{/if}
        <AdminSignUpApprovals onerror={(message) => (error = message)}>
            {#snippet empty()}
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    No sign-ups are waiting for approval.
                </p>
            {/snippet}
        </AdminSignUpApprovals>
    </div>
</main>
