<script lang="ts">
    import { CompanyToken, PlaceLink } from '@tabletop/18xx-ui'
    import { LukaHomes } from './lukaHomes.js'
    import type { TwoCrownsSession } from './session.svelte.js'

    let { session }: { session: TwoCrownsSession } = $props()
    const id = $props.id()
    let list: HTMLElement | undefined = $state()

    function closeAfterShowingPlace(event: MouseEvent) {
        if (event.target instanceof Element && event.target.closest('button')) list?.hidePopover()
    }
</script>

<button
    class="homes-button"
    popovertarget={id}
    aria-label="Homes"
    title="Where each Luka company starts"
    ><span class="word">Homes</span><svg class="icon" viewBox="0 0 16 16" aria-hidden="true"
        ><path d="M2 8 8 2.5 14 8h-2v5.5H9.5V10h-3v3.5H4V8Z" fill="currentColor"></path></svg
    ></button
>
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- The place buttons inside are the keyboard path; their clicks bubble here. -->
<div
    bind:this={list}
    {id}
    popover
    class="homes"
    role="dialog"
    tabindex="-1"
    aria-label="Luka company homes"
    onclick={closeAfterShowingPlace}
>
    <h2>Luka company homes</h2>
    <table>
        <thead
            ><tr
                ><th scope="col">Share</th><th scope="col">Company</th><th scope="col">Home</th><th
                    scope="col">Hex</th
                ></tr
            ></thead
        >
        <tbody>
            {#each LukaHomes as home (home.companyId)}
                <tr>
                    <td class="number">{home.number}</td>
                    <td
                        ><span class="company"
                            ><CompanyToken
                                appearance={session.mapView.stations[home.companyId]}
                                size={26}
                            />{home.name}</span
                        ></td
                    >
                    <td><PlaceLink locationId={home.locationId} /></td>
                    <td class="hex">{home.locationId}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .homes-button {
        flex-shrink: 0;
        height: 24px;
        margin-right: 6px;
        padding: 0 8px;
        border: 1.5px solid currentColor;
        border-radius: 12px;
        color: var(--rail-muted, #786550);
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
    }
    .icon {
        display: none;
        width: 18px;
        height: 18px;
        margin: auto;
    }
    .homes-button:hover {
        color: var(--rail-text, #443c34);
    }
    .homes {
        inset: 0;
        margin: auto;
        width: max-content;
        height: max-content;
        max-width: calc(100vw - 24px);
        max-height: calc(100dvh - 24px);
        overflow: auto;
        padding: 14px 16px;
        border: 1px solid #5f4d53;
        border-radius: 8px;
        background: #2b2024;
        color: #fff;
        font-size: 14px;
        font-weight: 400;
        letter-spacing: normal;
        text-align: left;
        text-transform: none;
        white-space: normal;
    }
    h2 {
        margin-bottom: 8px;
        font-size: 15px;
        font-weight: 700;
    }
    th {
        padding: 2px 8px;
        color: #d2c4c8;
        font-size: 11px;
        font-weight: 600;
    }
    td {
        padding: 4px 8px;
        border-top: 1px solid #5f4d53;
    }
    .company {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .number,
    .hex {
        color: #d2c4c8;
    }
    @media (width < 40rem) {
        .homes-button {
            margin: 0 -2px 0 -6px;
            padding: 0;
            width: 18px;
            border: 0;
        }
        .word {
            display: none;
        }
        .icon {
            display: block;
        }
    }
</style>
