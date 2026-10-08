<script lang="ts">
    let {
        color,
        x = 0,
        y = 0,
        scale = 1
    }: { color: string; x?: number; y?: number; scale?: number } = $props()
</script>

<!-- A small steam engine facing right, drawn around its centre. -->
<g transform="translate({x} {y}) scale({scale})" class="locomotive">
    <ellipse cx="0" cy="15" rx="24" ry="3.5" fill="rgba(40,24,8,0.25)" />
    <rect x="-20" y="-6" width="30" height="14" rx="3" fill={color} stroke="#1d140b" stroke-width="1.6" />
    <rect x="-22" y="-16" width="13" height="12" rx="1.5" fill={color} stroke="#1d140b" stroke-width="1.6" />
    <rect x="-24" y="-19" width="17" height="4" rx="1" fill="#1d140b" />
    <rect x="2" y="-15" width="6" height="10" rx="1" fill="#1d140b" />
    <rect x="0" y="-18" width="10" height="3.5" rx="1" fill="#1d140b" />
    <path d="M10 -2 L20 4 L20 8 L10 8 Z" fill={color} stroke="#1d140b" stroke-width="1.6" stroke-linejoin="round" />
    <circle cx="-13" cy="9" r="6" fill="#1d140b" />
    <circle cx="-13" cy="9" r="2.5" fill={color} />
    <circle cx="2" cy="10" r="4.5" fill="#1d140b" />
    <circle cx="2" cy="10" r="1.8" fill={color} />
    <circle cx="13" cy="11" r="3.5" fill="#1d140b" />
</g>
