import type { OffsetCoordinates } from '@tabletop/common'
import {
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type PlacementValues = {
    cell: OffsetCoordinates
    rotation: number
}

export type PlacementSelection = StagedSelectionState<PlacementValues>

export const PlacementStageOrder = [
    'cell',
    'rotation'
] as const satisfies readonly (keyof PlacementValues)[]
type MissingStages = Exclude<keyof PlacementValues, (typeof PlacementStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function chooseCell(selection: PlacementSelection, cell: OffsetCoordinates) {
    return setStagedSelectionValue<PlacementValues, 'cell'>(
        selection,
        PlacementStageOrder,
        'cell',
        cell,
        'manual'
    )
}

export function chooseRotation(
    selection: PlacementSelection,
    rotation: number,
    source: StagedSelectionSource
) {
    return setStagedSelectionValue<PlacementValues, 'rotation'>(
        selection,
        PlacementStageOrder,
        'rotation',
        rotation,
        source
    )
}
