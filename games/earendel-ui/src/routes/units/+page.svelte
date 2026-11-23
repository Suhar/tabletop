<script lang="ts">
    import { Color } from '@tabletop/common'
    import { PieceType } from '@tabletop/earendel'
    import { fighterSilhouetteFor } from '$lib/utils/fighterShapes.js'
    import FighterShape from '$lib/components/FighterShape.svelte'
    import ProbeShape from '$lib/components/ProbeShape.svelte'
    import StationShape from '$lib/components/StationShape.svelte'
    import UnitGlyph from '$lib/components/UnitGlyph.svelte'
    import ProposedUnit from './ProposedUnit.svelte'
    import '../../app.css'

    // A review sheet, for the harness only: every unit as the board draws it, in each player
    // color. The color values here are stand-ins close to the game's own.
    const PLAYERS: { name: string; color: Color; fill: string }[] = [
        { name: 'Red', color: Color.Red, fill: '#ef4444' },
        { name: 'Orange', color: Color.Orange, fill: '#f97316' },
        { name: 'Yellow', color: Color.Yellow, fill: '#facc15' },
        { name: 'Pink', color: Color.Pink, fill: '#f472b6' },
        { name: 'White', color: Color.White, fill: '#f5f5f5' }
    ]

    type Kind = 'probe' | 'fighter' | 'station' | 'glyph'
    type Unit = {
        name: string
        note: string
        kind: Kind
        level?: number
        hub?: boolean
        founding?: boolean
        torpedo?: boolean
        type?: PieceType
    }

    const GROUPS: { title: string; units: Unit[] }[] = [
        {
            title: 'Ships from the bag',
            units: [
                { name: 'Probe', note: 'level 2', kind: 'probe', level: 2 },
                { name: 'Probe', note: 'level 3', kind: 'probe', level: 3 },
                { name: 'Fighter', note: 'level 1 (damaged)', kind: 'fighter', level: 1 },
                { name: 'Fighter', note: 'level 2', kind: 'fighter', level: 2 },
                { name: 'Fighter', note: 'level 3', kind: 'fighter', level: 3 },
                { name: 'Gamma Torpedo', note: 'a fighter, armed', kind: 'fighter', level: 3, torpedo: true },
                { name: 'Station', note: '', kind: 'station' },
                { name: 'Opening station', note: 'the free first one', kind: 'station', founding: true },
                { name: 'Scrap', note: 'card only', kind: 'glyph', type: PieceType.Scrap }
            ]
        },
        {
            title: 'Special units',
            units: [
                { name: 'Station Hub', note: 'teal (Expansion)', kind: 'station', hub: true },
                { name: 'Terraformer', note: 'teal (Expansion)', kind: 'glyph', type: PieceType.Terraformer },
                { name: 'Artificial Planet', note: 'teal (Expansion)', kind: 'glyph', type: PieceType.ArtificialPlanet },
                { name: 'Nebula Seeder', note: 'teal (Expansion)', kind: 'glyph', type: PieceType.NebulaSeeder },
                { name: 'Interdictor', note: 'violet (Belligerence)', kind: 'glyph', type: PieceType.Interdictor },
                { name: 'Bastion', note: 'violet (Belligerence)', kind: 'glyph', type: PieceType.Bastion },
                { name: 'Gate', note: 'aqua (Mobility)', kind: 'glyph', type: PieceType.Gate },
                { name: 'Carrier', note: 'mint (Acquisitions)', kind: 'glyph', type: PieceType.Carrier },
                { name: 'Deep Scanner', note: 'mint (Acquisitions)', kind: 'glyph', type: PieceType.DeepScanner },
                { name: 'Salvage Drone', note: 'mint (Acquisitions)', kind: 'glyph', type: PieceType.SalvageDrone },
                { name: 'Relay', note: 'periwinkle (Espionage)', kind: 'glyph', type: PieceType.Relay },
                { name: 'Quarantine Beacon', note: 'periwinkle (Espionage)', kind: 'glyph', type: PieceType.QuarantineBeacon },
                { name: 'Jammer', note: 'periwinkle (Espionage)', kind: 'glyph', type: PieceType.Jammer }
            ]
        }
    ]

    const center = { x: 0, y: 0 }

    // Proposals, drawn by ProposedUnit: a motion for each special piece, and Jammer looks.
    const MOTIONS = [
        { kind: 'relay', name: 'Relay', note: 'signal pulsing outward' },
        { kind: 'scanner', name: 'Deep Scanner', note: 'a sweep turning in the lens' },
        { kind: 'gate', name: 'Gate', note: 'a glint running round' },
        { kind: 'carrier', name: 'Carrier', note: 'bays light, a craft circles' },
        { kind: 'bastion', name: 'Bastion', note: 'a field swelling and fading' },
        { kind: 'terraformer', name: 'Terraformer', note: 'the ground rolling' },
        { kind: 'world', name: 'Artificial Planet', note: 'scaffold turning' }
    ]

    const JAMMERS = [
        { kind: 'jammer-static', name: '1. Static', note: 'today\'s dish, waves flickering' },
        { kind: 'jammer-rings', name: '2. Scrambler', note: 'broken rings, counter-turning' },
        { kind: 'jammer-bolts', name: '3. Mast', note: 'jagged bolts flickering' },
        { kind: 'jammer-burst', name: '4. Noise burst', note: 'a jagged burst, throbbing' },
        { kind: 'jammer-cut', name: '5. Cut signal', note: 'a relay\'s arcs, struck through' }
    ]

    // Candidate Nebula Seeders, each reaching as far as a Station Hub's ring (about 31).
    const SEEDER_IDEAS = [
        { key: 'sprinkler', name: 'A. Sprinkler', note: 'six nozzles, cloud drifting outward' },
        { key: 'duster', name: 'B. Crop duster', note: 'a ship with a spray boom' },
        { key: 'comet', name: 'C. Comet', note: 'a small pod, a wide fan of exhaust' },
        { key: 'pinwheel', name: 'D. Pinwheel', note: 'two spiral arms of cloud, turning' }
    ] as const

    const polar = (radius: number, degrees: number) => ({
        x: radius * Math.cos((degrees * Math.PI) / 180),
        y: radius * Math.sin((degrees * Math.PI) / 180)
    })

    // Sprinkler: a nozzle toward each neighboring hex, three puffs beyond each.
    const NOZZLES = Array.from({ length: 6 }, (_unused, index) => 30 + index * 60)
    const PUFFS = [
        { at: 21, size: 2.4, opacity: 0.8 },
        { at: 25.5, size: 3.2, opacity: 0.5 },
        { at: 30, size: 4, opacity: 0.25 }
    ]

    // Crop duster: where the boom's nozzles sit.
    const BOOM = [-18, -9, 0, 9, 18]

    // Pinwheel: two arms of puffs growing and fading as they wind outward.
    const ARMS = [0, 180].flatMap((offset) =>
        Array.from({ length: 8 }, (_unused, step) => ({
            ...polar(9 + step * 3.1, offset + step * 38),
            size: 1.6 + step * 0.55,
            opacity: 0.95 - step * 0.1
        }))
    )
</script>

<svelte:head><title>Earendel units</title></svelte:head>

<div class="min-h-screen bg-[#0b1222] px-6 py-8 text-white">
    <h1 class="text-2xl font-bold">Earendel units</h1>
    <p class="mt-1 text-sm text-white/60">
        Every unit as the board draws it, in each player color. Each fighter row shows that
        color's own ship.
    </p>

    {#snippet seeder(key: (typeof SEEDER_IDEAS)[number]['key'], color: string)}
        {#if key === 'sprinkler'}
            <circle r="12" fill="none" stroke={color} stroke-width="2.5" />
            <circle r="5" fill={color} />
            {#each NOZZLES as angle (angle)}
                {@const from = polar(12, angle)}
                {@const to = polar(17, angle)}
                <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={color}
                    stroke-width="3"
                    stroke-linecap="round"
                />
            {/each}
            <g class="turning">
                {#each NOZZLES as angle (angle)}
                    {#each PUFFS as puff, index (index)}
                        {@const at = polar(puff.at, angle + index * 7)}
                        <circle
                            cx={at.x}
                            cy={at.y}
                            r={puff.size}
                            fill={color}
                            fill-opacity={puff.opacity}
                        />
                    {/each}
                {/each}
            </g>
        {:else if key === 'duster'}
            <path d="M0,-30 L6,-15 L4,-9 L-4,-9 L-6,-15 Z" fill={color} />
            <path
                d="M-20,-9 L20,-9"
                stroke={color}
                stroke-width="3"
                stroke-linecap="round"
                fill="none"
            />
            {#each BOOM as x (x)}
                <path
                    class="spray"
                    d="M{x},-6 L{x * 1.35},16"
                    stroke={color}
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-dasharray="1.5 4"
                    fill="none"
                />
                <ellipse
                    cx={x * 1.4}
                    cy={22 + Math.abs(x) * 0.12}
                    rx="6.5"
                    ry="5"
                    fill={color}
                    fill-opacity="0.3"
                />
            {/each}
        {:else if key === 'comet'}
            <circle cy="-20" r="7" fill={color} />
            <circle cy="-20" r="10.5" fill="none" stroke={color} stroke-width="1.5" />
            {#each [-22, -8, 8, 22] as x, index (x)}
                <path
                    class="spray"
                    d="M{x * 0.2},-11 Q{x * 0.35},6 {x},20"
                    stroke={color}
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-dasharray="2 4"
                    fill="none"
                />
                <circle
                    cx={x}
                    cy={24 - Math.abs(index - 1.5) * 2}
                    r={index === 1 || index === 2 ? 6.5 : 5}
                    fill={color}
                    fill-opacity="0.32"
                />
            {/each}
        {:else}
            <circle r="5.5" fill={color} />
            <circle r="8.5" fill="none" stroke={color} stroke-width="1.5" />
            <g class="turning">
                {#each ARMS as puff, index (index)}
                    <circle
                        cx={puff.x}
                        cy={puff.y}
                        r={puff.size}
                        fill={color}
                        fill-opacity={puff.opacity}
                    />
                {/each}
            </g>
        {/if}
    {/snippet}

    <h2 class="mt-8 text-sm font-semibold uppercase tracking-widest text-white/60">
        Nebula Seeder ideas
    </h2>
    <p class="mt-1 text-xs text-white/50">
        Each beside the current seeder and a Station Hub for size.
    </p>
    <div class="mt-3 overflow-x-auto">
        <table class="border-separate border-spacing-x-1 border-spacing-y-1">
            <thead>
                <tr>
                    <th></th>
                    <th class="w-[96px] px-1 pb-1 align-bottom text-xs font-semibold">
                        Current
                        <div class="text-[10px] font-normal text-white/50">&nbsp;</div>
                    </th>
                    {#each SEEDER_IDEAS as idea (idea.key)}
                        <th class="w-[120px] px-1 pb-1 align-bottom text-xs font-semibold">
                            {idea.name}
                            <div class="text-[10px] font-normal text-white/50">{idea.note}</div>
                        </th>
                    {/each}
                    <th class="w-[96px] px-1 pb-1 align-bottom text-xs font-semibold">
                        Station Hub
                        <div class="text-[10px] font-normal text-white/50">for size</div>
                    </th>
                </tr>
            </thead>
            <tbody>
                {#each PLAYERS as player (player.name)}
                    <tr>
                        <td class="pr-3 text-xs text-white/60">{player.name}</td>
                        <td class="rounded-md bg-white/[0.04] p-1 text-center">
                            <svg viewBox="-34 -34 68 68" width="88" height="88" class="inline-block">
                                <UnitGlyph
                                    type={PieceType.NebulaSeeder}
                                    color={player.fill}
                                    {center}
                                />
                            </svg>
                        </td>
                        {#each SEEDER_IDEAS as idea (idea.key)}
                            <td class="rounded-md bg-white/[0.04] p-1 text-center">
                                <svg
                                    viewBox="-34 -34 68 68"
                                    width="88"
                                    height="88"
                                    class="inline-block"
                                    aria-label="{player.name} seeder idea {idea.name}"
                                >
                                    {@render seeder(idea.key, player.fill)}
                                </svg>
                            </td>
                        {/each}
                        <td class="rounded-md bg-white/[0.04] p-1 text-center">
                            <svg viewBox="-34 -34 68 68" width="88" height="88" class="inline-block">
                                <StationShape {center} color={player.fill} hub />
                            </svg>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    {#each [{ title: 'Proposed motions', units: MOTIONS }, { title: 'Jammer options', units: JAMMERS }] as sheet (sheet.title)}
        <h2 class="mt-8 text-sm font-semibold uppercase tracking-widest text-white/60">
            {sheet.title}
        </h2>
        <div class="mt-3 overflow-x-auto">
            <table class="border-separate border-spacing-x-1 border-spacing-y-1">
                <thead>
                    <tr>
                        <th></th>
                        {#each sheet.units as unit (unit.kind)}
                            <th class="w-[110px] px-1 pb-1 align-bottom text-xs font-semibold">
                                {unit.name}
                                <div class="text-[10px] font-normal text-white/50">
                                    {unit.note}
                                </div>
                            </th>
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each PLAYERS as player (player.name)}
                        <tr>
                            <td class="pr-3 text-xs text-white/60">{player.name}</td>
                            {#each sheet.units as unit (unit.kind)}
                                <td class="rounded-md bg-white/[0.04] p-1 text-center">
                                    <svg
                                        viewBox="-34 -34 68 68"
                                        width="88"
                                        height="88"
                                        class="inline-block"
                                        aria-label="{player.name} {unit.name}: {unit.note}"
                                    >
                                        <ProposedUnit kind={unit.kind} color={player.fill} />
                                    </svg>
                                </td>
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/each}

    {#each GROUPS as group (group.title)}
        <h2 class="mt-8 text-sm font-semibold uppercase tracking-widest text-white/60">
            {group.title}
        </h2>
        <div class="mt-3 overflow-x-auto">
            <table class="border-separate border-spacing-x-1 border-spacing-y-1">
                <thead>
                    <tr>
                        <th></th>
                        {#each group.units as unit (unit.name + unit.note)}
                            <th class="w-[96px] px-1 pb-1 align-bottom text-xs font-semibold">
                                {unit.name}
                                <div class="text-[10px] font-normal text-white/50">
                                    {unit.note}&nbsp;
                                </div>
                            </th>
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each PLAYERS as player (player.name)}
                        <tr>
                            <td class="pr-3 text-xs text-white/60">{player.name}</td>
                            {#each group.units as unit (unit.name + unit.note)}
                                <td class="rounded-md bg-white/[0.04] p-1 text-center">
                                    <svg
                                        viewBox="-34 -34 68 68"
                                        width="88"
                                        height="88"
                                        class="inline-block"
                                        aria-label="{player.name} {unit.name} {unit.note}"
                                    >
                                        {#if unit.kind === 'probe'}
                                            <ProbeShape
                                                {center}
                                                color={player.fill}
                                                level={unit.level ?? 2}
                                            />
                                        {:else if unit.kind === 'fighter'}
                                            <FighterShape
                                                {center}
                                                color={player.fill}
                                                level={unit.level ?? 2}
                                                torpedo={unit.torpedo}
                                                silhouette={fighterSilhouetteFor(player.color)}
                                            />
                                        {:else if unit.kind === 'station'}
                                            <StationShape
                                                {center}
                                                color={player.fill}
                                                hub={unit.hub}
                                                founding={unit.founding}
                                            />
                                        {:else if unit.type}
                                            <UnitGlyph
                                                type={unit.type}
                                                color={player.fill}
                                                {center}
                                            />
                                        {/if}
                                    </svg>
                                </td>
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/each}
</div>

<style>
    /* Use the `animation` shorthand: Svelte rewrites scoped @keyframes names only there. */
    /* Turned about its own middle, as the hub's ring is: both shapes are centered on the unit. */
    .turning {
        transform-box: fill-box;
        transform-origin: center;
        animation: seeder-turn 40s linear infinite;
    }

    .spray {
        animation: seeder-spray 1.6s linear infinite;
    }

    @keyframes seeder-turn {
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes seeder-spray {
        to {
            stroke-dashoffset: -11;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .turning,
        .spray {
            animation: none;
        }
    }
</style>
