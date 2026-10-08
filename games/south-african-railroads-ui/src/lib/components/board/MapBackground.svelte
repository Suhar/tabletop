<script lang="ts">
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/utils/boardLayout.js'

    type RegionLabel = { lines: string[]; x: number; y: number; rotate?: number }

    // Placed where the redrawn board prints them.
    const REGIONS: RegionLabel[] = [
        { lines: ['TRANSVAAL', 'REPUBLIC'], x: 1180, y: 560 },
        { lines: ['ORANGE', 'FREE', 'STATE'], x: 336, y: 596 },
        { lines: ['CAPE COLONY'], x: 300, y: 380, rotate: -24 },
        { lines: ['BASUTOLAND'], x: 540, y: 992 },
        { lines: ['NATAL'], x: 884, y: 1004 },
        { lines: ['SWAZILAND'], x: 1268, y: 888 },
        { lines: ['MOÇAMBIQUE'], x: 1400, y: 1058 }
    ]

    const SEA =
        'M1584 640 C1566 742 1540 832 1528 904 C1516 980 1522 1040 1540 1100 L1556 1224 L1584 1224 Z'
</script>

<defs>
    <radialGradient id="sar-paper" cx="50%" cy="46%" r="75%">
        <stop offset="0%" stop-color="#f6eed7" />
        <stop offset="70%" stop-color="#eadcb8" />
        <stop offset="100%" stop-color="#d6c296" />
    </radialGradient>
    <linearGradient id="sar-sea" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#9fc7cf" />
        <stop offset="100%" stop-color="#6fa5b3" />
    </linearGradient>
    <linearGradient id="sar-band" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4a2e17" />
        <stop offset="100%" stop-color="#36210f" />
    </linearGradient>
    <clipPath id="sar-inner">
        <rect x="15" y="15" width={BOARD_WIDTH - 30} height={BOARD_HEIGHT - 30} rx="10" />
    </clipPath>
    <filter id="sar-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="1.6"
            flood-color="#2a1a08"
            flood-opacity="0.35"
        />
    </filter>
</defs>

<rect width={BOARD_WIDTH} height={BOARD_HEIGHT} rx="18" fill="url(#sar-paper)" />
<g clip-path="url(#sar-inner)">
    <path d={SEA} fill="url(#sar-sea)" />
    <path d={SEA} fill="none" stroke="#4f7f8c" stroke-width="2" />
    {#each [10, 22, 34] as offset (offset)}
        <path
            d="M{1584 - 4} {640 + offset * 2} C{1566 + offset} {742 + offset} {1540 + offset} {832 +
                offset} {1528 + offset} {904 + offset}"
            fill="none"
            stroke="#e4f1f3"
            stroke-width="1.2"
            stroke-dasharray="6 9"
            opacity="0.7"
        />
    {/each}
</g>
<rect
    x="8"
    y="8"
    width={BOARD_WIDTH - 16}
    height={BOARD_HEIGHT - 16}
    rx="14"
    fill="none"
    stroke="#7a5a32"
    stroke-width="3"
/>
<rect
    x="15"
    y="15"
    width={BOARD_WIDTH - 30}
    height={BOARD_HEIGHT - 30}
    rx="10"
    fill="none"
    stroke="#a8875a"
    stroke-width="1"
/>

<text x="1556" y="770" class="sea-label" transform="rotate(-80 1556 770)">INDIAN OCEAN</text>

{#each REGIONS as region (region.lines.join(' '))}
    <text
        class="region"
        x={region.x}
        y={region.y}
        transform={region.rotate ? `rotate(${region.rotate} ${region.x} ${region.y})` : undefined}
    >
        {#each region.lines as line, index (line)}
            <tspan x={region.x} dy={index === 0 ? 0 : 19}>{line}</tspan>
        {/each}
    </text>
{/each}

<g class="cartouche" transform="translate(330 1044)">
    <rect
        x="-8"
        y="-36"
        width="340"
        height="58"
        rx="6"
        fill="#f7efd9"
        stroke="#7a5a32"
        stroke-width="2"
    />
    <text x="162" y="-6" class="title">South African Railroads</text>
    <text x="162" y="13" class="credit"
        >John Bohrer · Winsome Games · map redrawn by Stephan Suhar</text
    >
</g>

<style>
    .region {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        letter-spacing: 0.32em;
        fill: #9a8461;
        text-anchor: middle;
        pointer-events: none;
    }

    .sea-label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-style: italic;
        letter-spacing: 0.4em;
        fill: #eef6f7;
        text-anchor: middle;
        pointer-events: none;
    }

    .title {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 26px;
        font-weight: 700;
        fill: #3b2410;
        text-anchor: middle;
    }

    .credit {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 9.5px;
        font-style: italic;
        fill: #7a5a32;
        text-anchor: middle;
    }
</style>
