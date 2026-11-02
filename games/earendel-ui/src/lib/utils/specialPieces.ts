import { type Piece, PieceType, TechnologyEffectKind } from '@tabletop/earendel'

export type SpecialPieceInfo = {
    key: string
    glyph: string
    name: string
    ability: string
    // The technology that grants it, whose category heads its popup.
    grantedBy: TechnologyEffectKind
}

const STATION_HUB: SpecialPieceInfo = {
    key: 'hub',
    glyph: '▣',
    name: 'Station Hub',
    ability:
        'A station in every respect, which doubles the score of its complex when placed and every time the complex scores afterwards.',
    grantedBy: TechnologyEffectKind.StationUpgrade
}

const TERRAFORMER: SpecialPieceInfo = {
    key: 'terraformer',
    glyph: '◈',
    name: 'Terraformer',
    ability:
        'Placed beside a planet no terraformer touches, it may change that planet to another colour. It counts 1 toward control, and fighters cannot attack it.',
    grantedBy: TechnologyEffectKind.Terraforming
}

const RELAY: SpecialPieceInfo = {
    key: 'relay',
    glyph: '◇',
    name: 'Relay',
    ability:
        'A station for line of sight, protecting your probes, linking your stations and closing hexes to rival probes, whose sight only planets block. It counts 1 toward control, and fighters cannot attack it.',
    grantedBy: TechnologyEffectKind.RelayNetwork
}

export function specialPieceInfo(piece: Piece): SpecialPieceInfo | undefined {
    if (piece.hub) return STATION_HUB
    if (piece.type === PieceType.Terraformer) return TERRAFORMER
    if (piece.type === PieceType.Relay) return RELAY
    return undefined
}
