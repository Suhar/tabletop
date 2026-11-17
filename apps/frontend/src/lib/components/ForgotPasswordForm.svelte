<script lang="ts">
    // SuharTabletop sends no email, so Stephan resets passwords by hand.
    let { onback }: { onback: () => void } = $props()
</script>

<div tabindex="-1" role="status" {@attach (node) => node.focus()}>
    <p class="font-medium text-lg mb-2">Ask Stephan</p>
    <p class="text-gray-600 dark:text-gray-300">
        Message <a
            class="underline"
            href="https://discordapp.com/users/cowbellthunder"
            target="_blank"
            rel="noreferrer">cowbellthunder</a
        >
        on Discord or email
        <a class="underline" href="mailto:cowbellthunder@gmail.com">cowbellthunder@gmail.com</a>
        with your username, and he’ll send you a new password. You can change it in your profile once
        you’re signed in.
    </p>
</div>
<div class="mt-8">
    <button
        class="auth-secondary text-sm text-gray-600 hover:underline dark:text-gray-300"
        onclick={onback}>Back to sign in</button
    >
</div>
