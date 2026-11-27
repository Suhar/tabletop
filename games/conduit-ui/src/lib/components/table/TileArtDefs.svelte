<script lang="ts">
    import { BaseLetters } from '@tabletop/conduit'
    import {
        CopperCentreColor,
        CopperEdgeColor,
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
    <linearGradient
        id="conduit-copper-across-x"
        x1={TraceRunStart}
        y1="0"
        x2={TraceRunEnd}
        y2="0"
        gradientUnits="userSpaceOnUse"
    >
        {@render copper()}
    </linearGradient>
    <linearGradient
        id="conduit-copper-across-y"
        x1="0"
        y1={TraceRunStart}
        x2="0"
        y2={TraceRunEnd}
        gradientUnits="userSpaceOnUse"
    >
        {@render copper()}
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
            fill="url(#conduit-copper-across-y)"
        ></rect>
        <path d={NorthTraceRun} fill="url(#conduit-copper-across-x)"></path>
        <path d={SouthTraceRun} fill="url(#conduit-copper-across-x)"></path>
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

{#snippet copper()}
    <stop offset="0" stop-color={CopperEdgeColor}></stop>
    <stop offset="0.5" stop-color={CopperCentreColor}></stop>
    <stop offset="1" stop-color={CopperEdgeColor}></stop>
{/snippet}
