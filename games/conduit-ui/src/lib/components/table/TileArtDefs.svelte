<script lang="ts">
    import { BaseLetters } from '@tabletop/conduit'
    import { CellSize } from '$lib/utils/boardLayout.js'
    import {
        BoardGroundColor,
        BoardGroundId,
        BoardGroundMarkColor,
        CautionBlack,
        CautionStripeWidth,
        CautionStripesId,
        CautionYellow,
        TraceCentreColor,
        TraceEdgeColor,
        EmblemStroke,
        Emblems,
        LetterGlowWidths,
        NorthTraceRun,
        SouthTraceRun,
        TileArtSize,
        TileBoardColor,
        TileBoardId,
        TraceHalfWidth,
        TraceOutlineColor,
        TraceOutlineHalfWidth,
        TraceOutlineStart,
        TraceRunEnd,
        TraceRunStart,
        emblemId,
        emblemPath
    } from '$lib/utils/tileArt.js'
</script>

<defs>
    <pattern id={BoardGroundId} width={CellSize} height={CellSize} patternUnits="userSpaceOnUse">
        <rect width={CellSize} height={CellSize} fill={BoardGroundColor}></rect>
        <path
            d="M0 6V0H6M{CellSize - 6} 0H{CellSize}V6M{CellSize} {CellSize -
                6}V{CellSize}H{CellSize - 6}M6 {CellSize}H0V{CellSize - 6}"
            fill="none"
            stroke={BoardGroundMarkColor}
            stroke-width="1.5"
        ></path>
    </pattern>
    <pattern
        id={CautionStripesId}
        width={CautionStripeWidth * 2}
        height={CautionStripeWidth * 2}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
    >
        <rect width={CautionStripeWidth * 2} height={CautionStripeWidth * 2} fill={CautionYellow}
        ></rect>
        <rect width={CautionStripeWidth} height={CautionStripeWidth * 2} fill={CautionBlack}></rect>
    </pattern>
    <linearGradient
        id="conduit-trace-across-x"
        x1={TraceRunStart}
        y1="0"
        x2={TraceRunEnd}
        y2="0"
        gradientUnits="userSpaceOnUse"
    >
        {@render traceStops()}
    </linearGradient>
    <linearGradient
        id="conduit-trace-across-y"
        x1="0"
        y1={TraceRunStart}
        x2="0"
        y2={TraceRunEnd}
        gradientUnits="userSpaceOnUse"
    >
        {@render traceStops()}
    </linearGradient>
    <g id={TileBoardId}>
        <rect width={TileArtSize} height={TileArtSize} fill={TileBoardColor}></rect>
        <rect
            x={TraceOutlineStart}
            width={2 * TraceOutlineHalfWidth}
            height={TileArtSize}
            fill={TraceOutlineColor}
        ></rect>
        <rect
            y={TraceOutlineStart}
            width={TileArtSize}
            height={2 * TraceOutlineHalfWidth}
            fill={TraceOutlineColor}
        ></rect>
        <rect
            y={TraceRunStart}
            width={TileArtSize}
            height={2 * TraceHalfWidth}
            fill="url(#conduit-trace-across-y)"
        ></rect>
        <path d={NorthTraceRun} fill="url(#conduit-trace-across-x)"></path>
        <path d={SouthTraceRun} fill="url(#conduit-trace-across-x)"></path>
    </g>
    {#each BaseLetters as letter (letter)}
        {@const art = Emblems[letter]}
        <g id={emblemId(letter)}>
            <path
                d={emblemPath(letter)}
                fill={art.fill}
                stroke="#000"
                stroke-width={EmblemStroke}
                stroke-linejoin="round"
            ></path>
            {#each LetterGlowWidths as width (width)}
                <path
                    d={art.letter}
                    fill="none"
                    stroke="#fff"
                    stroke-opacity="0.2"
                    stroke-width={width}
                    stroke-linejoin="round"
                ></path>
            {/each}
            <path d={art.letter} fill="#fff"></path>
        </g>
    {/each}
</defs>

{#snippet traceStops()}
    <stop offset="0" stop-color={TraceEdgeColor}></stop>
    <stop offset="0.5" stop-color={TraceCentreColor}></stop>
    <stop offset="1" stop-color={TraceEdgeColor}></stop>
{/snippet}
