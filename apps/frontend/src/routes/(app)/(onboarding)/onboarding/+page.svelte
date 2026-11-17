<script lang="ts">
    import { Card, Label, Input, Button, Helper, Alert, P, Hr } from 'flowbite-svelte'
    import { ABANDONED_SIGN_UP_DAYS, UserStatus, type UserUpdateRequest } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import { isAlreadyExists, isUsernameNotAllowed } from '$lib/utils/accountErrors'
    import AgeConfirmation from '$lib/components/AgeConfirmation.svelte'
    import { ageConfirmationMessage } from '$lib/utils/accountFormValidation'
    import {
        reauthentication,
        requiresRecentAuthentication
    } from '$lib/stores/reauthentication.svelte'

    let { authorizationService, api } = getAppContext()

    let unexpectedError = $state(false)
    let errors: Record<string, string[]> = $state({})
    let username: string | undefined = $state(undefined)
    let email: string | undefined = $state(undefined)
    let ageConfirmed = $state(false)

    let user = $derived(authorizationService.getSessionUser())
    let neverActivated = $derived(Boolean(user && !user.activatedAt))

    async function updateUser(event: SubmitEvent) {
        event.preventDefault()
        username = username?.trim()
        email = email?.trim()
        errors = {}
        if (user && !user.ageConfirmedAt && !ageConfirmed) {
            errors.ageConfirmed = [ageConfirmationMessage]
            return
        }

        const payload: UserUpdateRequest = {
            username,
            email,
            ageConfirmed: ageConfirmed ? true : undefined
        }
        await reauthentication.run({
            description: email ? 'update your email address' : 'complete your profile',
            retry: () => saveProfile(payload)
        })
    }

    async function saveProfile(payload: UserUpdateRequest) {
        try {
            let updatedUser = await api.updateUser(payload)
            authorizationService.setSessionUser(updatedUser)

            username = ''
            email = ''

            if (updatedUser.status === UserStatus.Active) {
                await authorizationService.onLogin(updatedUser)
            }
        } catch (e) {
            if (requiresRecentAuthentication(e)) throw e
            if (isUsernameNotAllowed(e)) {
                errors.username = [e.message]
            } else if (isAlreadyExists(e)) {
                if (e.message.includes('username')) {
                    errors.username = ['Username already exists']
                } else if (e.message.includes('email')) {
                    errors.email = ['Email already exists']
                } else {
                    unexpectedError = true
                }
            } else {
                unexpectedError = true
            }
        }
    }

    let stillWaiting = $state(false)
    async function checkApproval() {
        const current = await api.getSelf()
        if (current?.status === UserStatus.Active) {
            await authorizationService.onLogin(current)
        } else {
            stillWaiting = true
        }
    }

    function trim(event: Event) {
        const input = event.target as HTMLInputElement
        input.value = input.value.trim()
    }
</script>

{#snippet signUpDeadline()}
    {#if neverActivated}
        <P class="text-sm mt-4 text-gray-500 dark:text-gray-400"
            >Unfinished sign-ups are deleted after {ABANDONED_SIGN_UP_DAYS} days.</P
        >
    {/if}
{/snippet}

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center space-y-6">
    {#if user && user.email && !user.emailVerified}
        <!-- SuharTabletop sends no email: Stephan approves each new account instead of a code. -->
        <Card class="p-4 sm:p-6">
            <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300">
                Waiting for approval
            </h1>
            <Hr class="my-4" />
            <P class="dark:text-gray-300"
                >Thanks for signing up. Stephan approves each new account by hand, so you can play
                once he has. To hurry him along, message <a
                    class="underline"
                    href="https://discordapp.com/users/cowbellthunder"
                    target="_blank"
                    rel="noreferrer">cowbellthunder</a
                > on Discord.</P
            >
            <div class="flex flex-row items-center justify-end gap-4 mt-6">
                {#if stillWaiting}<span class="text-sm text-gray-500 dark:text-gray-400"
                        >Not yet.</span
                    >{/if}
                <Button onclick={checkApproval}>Check again</Button>
            </div>
        </Card>
    {:else}
        <Card class="p-4 sm:p-6">
            <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">
                Complete your profile...
            </h1>
            {#if unexpectedError}
                <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
                    <span class="font-bold text-lg">Oops...</span><br />
                    An unexpected error occurred. Please try again and hopefully it will be better next
                    time.
                </Alert>
            {/if}
            <form class="flex flex-col space-y-6" action="/" onsubmit={updateUser}>
                {#if user && !user.username}
                    <Label class="mb-2">Username</Label>
                    <Input
                        bind:value={username}
                        oninput={trim}
                        type="text"
                        name="username"
                        placeholder="choose a username"
                        required
                    />
                    {#if errors?.username}
                        {#each errors.username as error, i (i)}
                            <Helper class="mb-2" color="red"
                                ><span class="font-medium">{error}</span></Helper
                            >
                        {/each}
                    {/if}
                {/if}
                {#if user && !user.email}
                    <Label class="mb-2">Email</Label>
                    <Input
                        bind:value={email}
                        oninput={trim}
                        type="email"
                        name="email"
                        placeholder="name@company.com"
                        required
                    />
                    {#if errors?.email}
                        {#each errors.email as error, i (i)}
                            <Helper class="mb-2" color="red"
                                ><span class="font-medium">{error}</span></Helper
                            >
                        {/each}
                    {/if}
                    <Helper class="text-sm mt-2">
                        We’ll never share your email publicly. It is only used for account recovery
                        and notifications.
                    </Helper>
                {/if}
                {#if user && !user.ageConfirmedAt}
                    <AgeConfirmation bind:checked={ageConfirmed} errors={errors.ageConfirmed} />
                {/if}
                <div class="flex justify-end"><Button type="submit" class="">Submit</Button></div>
            </form>
            {@render signUpDeadline()}
        </Card>
    {/if}
</div>
