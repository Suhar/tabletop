<script lang="ts">
    import { AnnotationSolid, ArrowRightOutline, UsersOutline } from 'flowbite-svelte-icons'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    const { authorizationService } = getAppContext()
    const libraryUrl = $derived(authorizationService.getSessionUser() ? '/library' : '/#games')
</script>

<svelte:head>
    <title>About — SuharTabletop</title>
    <meta
        name="description"
        content="SuharTabletop is a private table for friends to play games that are still being made."
    />
</svelte:head>

<main class="about-page collection-page">
    <header class="page-heading collection-header">
        <h1 class="collection-heading">About</h1>
        <a class="library-link" href={libraryUrl}>
            Go to the library <ArrowRightOutline class="h-4 w-4" />
        </a>
    </header>

    <div class="introduction">
        <div class="intro-copy">
            <p class="lead">
                <span class="font-bold">SuharTabletop</span>
                is a private table for friends to play games that are still being made.
            </p>
            <p class="welcome">
                You’re here because Stephan invited you. The games here are prototypes and works in
                progress, so expect rough edges, placeholder art, and rules that change between
                visits. Thanks for playing them anyway.
            </p>
            <p class="welcome">
                The site runs on
                <a
                    class="credit-link"
                    href="https://github.com/justinkwaugh/tabletop"
                    rel="noreferrer">Tabletop</a
                >, Justin Waugh’s open-source framework for board games online.
            </p>
        </div>
        <ul class="principles" aria-label="The table">
            <li><strong>Invite</strong> only.</li>
            <li><strong>Always</strong> a work in progress.</li>
        </ul>
    </div>

    <div class="community">
        <section class="community-card" aria-labelledby="feedback-heading">
            <div class="card-heading">
                <AnnotationSolid class="h-7 w-7 shrink-0" />
                <h2 id="feedback-heading">Tell Stephan what you think</h2>
            </div>
            <p>
                Found a bug, got stuck on a rule, or had an idea mid-game? Send Stephan a message,
                or bring it up next time you play together. Compliments and complaints are both
                welcome.
            </p>
            <ul class="tips" aria-label="What helps in a bug report">
                <li>Which game</li>
                <li>What you expected</li>
                <li>What happened instead</li>
                <li>A screenshot, if you can</li>
            </ul>
        </section>

        <section class="community-card" aria-labelledby="private-heading">
            <div class="card-heading">
                <UsersOutline class="h-7 w-7 shrink-0" />
                <h2 id="private-heading">Please keep it between us</h2>
            </div>
            <p>
                These games are unpublished prototypes. Please don’t share screenshots, rules, or
                the link outside the group.
            </p>
            <p class="invite">
                Know someone who’d enjoy playing? Ask Stephan before passing on the address.
            </p>
        </section>
    </div>
</main>

<style>
    .about-page {
        padding-bottom: 64px;
        color: var(--color-gray-200);
    }
    .page-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px 24px;
    }
    .credit-link {
        color: var(--color-blue-300);
    }
    .library-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--color-blue-300);
        font-size: 14px;
    }
    .introduction {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        align-items: start;
        gap: 64px;
        padding: 8px 0 36px;
        border-bottom: 1px solid var(--color-gray-700);
    }
    .lead {
        max-width: 32ch;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 28px;
        line-height: 1.35;
        letter-spacing: -0.015em;
    }
    .welcome {
        max-width: 56ch;
        margin-top: 16px;
        color: var(--color-gray-400);
        font-size: 15px;
        line-height: 1.7;
    }
    .principles {
        display: grid;
        gap: 12px;
        padding-left: 28px;
        border-left: 2px solid var(--color-highlight-border);
        font-family: 'Source Sans 3', sans-serif;
        font-size: 21px;
        line-height: 1.4;
    }
    .principles strong {
        font-weight: 600;
    }
    .community {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
        margin-top: 32px;
        align-items: start;
    }
    .community-card {
        min-width: 0;
        padding: 28px;
        background: color-mix(in srgb, var(--color-gray-800) 50%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-gray-700) 60%, transparent);
        border-radius: 12px;
    }
    .card-heading {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        color: var(--color-blue-300);
    }
    h2 {
        font-family: 'Source Sans 3', sans-serif;
        font-size: 24px;
        font-weight: 600;
        line-height: 1.25;
        letter-spacing: -0.02em;
        color: var(--color-gray-200);
    }
    .community-card p {
        color: var(--color-gray-400);
        font-size: 15px;
        line-height: 1.7;
    }
    .community-card p.invite {
        margin-top: 16px;
        color: var(--color-gray-200);
    }
    .tips {
        list-style-type: disc;
        padding-left: 18px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 20px;
        margin-top: 20px;
        font-size: 14px;
        line-height: 1.5;
    }
    a:hover {
        text-decoration: underline;
        text-underline-offset: 4px;
    }
    a:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 5px;
        border-radius: 3px;
    }
    @media (max-width: 900px) {
        .introduction {
            gap: 32px;
            grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        }
        .community-card {
            padding: 24px;
        }
        .tips {
            grid-template-columns: 1fr;
        }
    }
    @media (max-width: 700px) {
        .about-page {
            padding-bottom: 48px;
        }
        .introduction {
            grid-template-columns: 1fr;
            gap: 24px;
            padding-bottom: 28px;
        }
        .lead {
            font-size: 24px;
        }
        .principles {
            font-size: 18px;
            padding-left: 16px;
            gap: 6px;
        }
        .community {
            grid-template-columns: 1fr;
            gap: 16px;
            margin-top: 24px;
        }
        .tips {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 12px;
        }
    }
</style>
