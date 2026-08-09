// The list of all possible state machine states

export enum MachineState {
    // A player's whole turn: place exactly one ship. Nothing else happens in a turn.
    PlacingPiece = 'PlacingPiece',
    // Held open only while a probe placement is waiting on its player - which planet to
    // explore, then which revealed technology to keep. Still the same turn.
    Exploring = 'Exploring',
    // Held open while a newly placed fighter's owner decides whether to destroy something
    // adjacent, and which. Still the same turn.
    Attacking = 'Attacking',
    EndOfGame = 'EndOfGame'
}
