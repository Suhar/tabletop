import { Color } from '@tabletop/common'

export enum RailroadId {
    CdFM = 'CdFM',
    CSAR = 'CSAR',
    NRC = 'NRC',
    CTRD = 'CTRD',
    CMRC = 'CMRC',
    ZASM = 'ZASM'
}

export type RailroadDefinition = {
    id: RailroadId
    shortName: string
    name: string
    color: Color
}

export const SHARES_PER_RAILROAD = 5

export const RAILROADS: readonly RailroadDefinition[] = [
    {
        id: RailroadId.CMRC,
        shortName: 'CMRC',
        name: 'Cape Midland Railway Company',
        color: Color.Red
    },
    {
        id: RailroadId.CTRD,
        shortName: 'CTR&D',
        name: 'Cape Town Railway & Dock Company',
        color: Color.Blue
    },
    {
        id: RailroadId.CSAR,
        shortName: 'CSAR',
        name: 'Central South African Railway',
        color: Color.Green
    },
    { id: RailroadId.NRC, shortName: 'NRC', name: 'Natal Railway Company', color: Color.Brown },
    {
        id: RailroadId.ZASM,
        shortName: 'ZASM',
        name: 'Zuid Afrikaansche Spoorweg Maatschappij',
        color: Color.Yellow
    },
    {
        id: RailroadId.CdFM,
        shortName: 'CdFM',
        name: 'Caminhos de Ferro de Moçambique',
        color: Color.Black
    }
]

export const INITIAL_OFFERING: readonly RailroadId[] = [
    RailroadId.CdFM,
    RailroadId.CSAR,
    RailroadId.NRC,
    RailroadId.CTRD,
    RailroadId.CMRC
]

export function railroadDefinition(id: RailroadId): RailroadDefinition {
    const railroad = RAILROADS.find((candidate) => candidate.id === id)
    if (!railroad) {
        throw Error(`Unknown railroad ${id}`)
    }
    return railroad
}
