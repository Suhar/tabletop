import { type Piece, PieceType, TechnologyEffectKind } from '@tabletop/earendel'

export type SpecialPieceInfo = {
    key: string
    name: string
    // The technology that grants it, whose chip shows it while it waits to be placed.
    grantedBy: TechnologyEffectKind
}

const STATION_HUB: SpecialPieceInfo = {
    key: 'hub',
    name: 'Station Hub',
    grantedBy: TechnologyEffectKind.StationUpgrade
}

const TERRAFORMER: SpecialPieceInfo = {
    key: 'terraformer',
    name: 'Terraformer',
    grantedBy: TechnologyEffectKind.Terraforming
}

const RELAY: SpecialPieceInfo = {
    key: 'relay',
    name: 'Relay',
    grantedBy: TechnologyEffectKind.RelayNetwork
}

export function specialPieceInfo(piece: Piece): SpecialPieceInfo | undefined {
    if (piece.hub) return STATION_HUB
    if (piece.type === PieceType.Terraformer) return TERRAFORMER
    if (piece.type === PieceType.Relay) return RELAY
    return undefined
}
