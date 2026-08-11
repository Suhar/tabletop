// The list of all possible state machine states

export enum MachineState {
    // Every turn opens here and waits: the player draws when they choose to, which is what
    // keeps the previous player's undo window open until then.
    StartOfTurn = 'StartOfTurn',
    // Three ships drawn, one to be thrown away.
    DraftingPieces = 'DraftingPieces',
    // A player's whole turn: place exactly one ship. Nothing else happens in a turn.
    PlacingPiece = 'PlacingPiece',
    // Held open only while a probe placement is waiting on its player - which planet to
    // explore, then which revealed technology to keep. Still the same turn.
    Exploring = 'Exploring',
    // Held open while an immediate technology effect waits on the player who just chose it.
    // The exploration itself is already finished. Still the same turn.
    ResolvingTechnology = 'ResolvingTechnology',
    // Held open while a player lays a tile drawn by a technology, and then while they place
    // the ship that has to land on it. Still the same turn.
    PlacingTile = 'PlacingTile',
    PlacingBonusPiece = 'PlacingBonusPiece',
    // Held open while a newly placed fighter's owner decides whether to destroy something
    // adjacent, and which. Still the same turn.
    Attacking = 'Attacking',
    EndOfGame = 'EndOfGame'
}
