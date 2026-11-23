import { type AxialCoordinates, sameCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export enum Power {
    Shift = 'shift',
    Warp = 'warp',
    Rift = 'rift',
    Colony = 'colony',
    Spoof = 'spoof',
    Asteroid = 'asteroid',
    Breach = 'breach',
    Feint = 'feint',
    Wormhole = 'wormhole',
    Download = 'download',
    Logistics = 'logistics',
    Spread = 'spread',
    Railgun = 'railgun',
    Torpedo = 'torpedo'
}

export type PieceChoice = { source: 'held' | 'special'; pieceId: string }

export type EarendelSelectionValues = {
    piece: PieceChoice
    power: Power
    // The players an elevated event's discoverer has lined up after themselves, so far.
    order: string[]
    rotation: number
    origin: AxialCoordinates
    targets: AxialCoordinates[]
    preview: AxialCoordinates
}

export type EarendelSelection = StagedSelectionState<EarendelSelectionValues>

export const EarendelStageOrder = [
    'piece',
    'power',
    'order',
    'rotation',
    'origin',
    'targets',
    'preview'
] as const satisfies readonly (keyof EarendelSelectionValues)[]
type MissingStages = Exclude<keyof EarendelSelectionValues, (typeof EarendelStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setEarendelSelection<TStage extends keyof EarendelSelectionValues>(
    selection: EarendelSelection,
    stage: TStage,
    value: EarendelSelectionValues[TStage] | undefined,
    source: StagedSelectionSource = 'manual'
): EarendelSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<EarendelSelectionValues, TStage>(
              selection,
              EarendelStageOrder,
              stage
          )
        : setStagedSelectionValue<EarendelSelectionValues, TStage>(
              selection,
              EarendelStageOrder,
              stage,
              value,
              source
          )
}

export function toggleEarendelTarget(
    selection: EarendelSelection,
    coords: AxialCoordinates
): EarendelSelection {
    const targets = selection.targets?.value ?? []
    const next = targets.some((target) => sameCoordinates(target, coords))
        ? targets.filter((target) => !sameCoordinates(target, coords))
        : [...targets, coords]
    return setEarendelSelection(selection, 'targets', next.length > 0 ? next : undefined)
}

export function hasManualEarendelSelection(selection: EarendelSelection): boolean {
    return hasManualStagedSelection<EarendelSelectionValues>(selection, EarendelStageOrder)
}

export function popEarendelSelection(selection: EarendelSelection): EarendelSelection {
    return popHighestManualStagedSelection<EarendelSelectionValues>(selection, EarendelStageOrder)
        .nextState
}

export async function undoSelectionOrAction(
    selection: { undo: () => boolean },
    undoAction: () => Promise<void>
): Promise<void> {
    if (selection.undo()) return
    await undoAction()
}
