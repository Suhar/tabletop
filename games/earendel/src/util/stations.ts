import type { AxialCoordinates } from '@tabletop/common'
import type { EarendelBoard } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { connectedGroup } from './groups.js'

// The unbroken run of this player's own stations that the station on this hex belongs to.
//
// Stations link to stations and nothing else: a probe or fighter standing between two of them
// - yours or anyone's - leaves them in separate groups. That is what makes a station cluster
// something to be defended rather than a shape that happens by accident.
export function stationGroup(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): AxialCoordinates[] {
    return connectedGroup(
        board,
        coords,
        (hex) => hex.piece?.playerId === playerId && hex.piece.type === PieceType.Station
    )
}

// What placing a station on this hex pays: one for itself, and one for every other station
// already in the group it joins.
//
// Because it is scored on every placement, a group built up one station at a time pays 1, 2,
// 3, ... - the same triangular total a chain pays, but earned incrementally and without
// needing planets to line up. Building compactly from the start beats placing apart and
// joining later, which is the decision the rule creates.
export function stationGroupPoints(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): number {
    return stationGroup(board, playerId, coords).length
}
