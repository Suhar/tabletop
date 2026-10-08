import { RailroadId } from '@tabletop/south-african-railroads'

export type RailroadStyle = { fill: string; text: string; dark: string; light: string }

// Colours follow the railroad name blocks printed along the board's bottom edge.
export const RAILROAD_STYLE: Record<RailroadId, RailroadStyle> = {
    [RailroadId.CMRC]: { fill: '#c8231f', text: '#ffffff', dark: '#7d1411', light: '#e9655f' },
    [RailroadId.CTRD]: { fill: '#2f4fa8', text: '#ffffff', dark: '#1b2f66', light: '#6f8bd6' },
    [RailroadId.CSAR]: { fill: '#3d7d2f', text: '#ffffff', dark: '#234a1a', light: '#78b366' },
    [RailroadId.NRC]: { fill: '#85501f', text: '#ffffff', dark: '#4f2d0f', light: '#c08a55' },
    [RailroadId.ZASM]: { fill: '#f0d21b', text: '#2a2208', dark: '#9b8506', light: '#f8e87a' },
    [RailroadId.CdFM]: { fill: '#232323', text: '#ffffff', dark: '#000000', light: '#5c5c5c' }
}
