export enum MachineState {
    // Before the first turn: each player, last first, stows one more ship in their bag and
    // then places a free station (rules.md, Setup).
    StowingShip = 'StowingShip',
    PlacingOpeningStation = 'PlacingOpeningStation',
    StartOfTurn = 'StartOfTurn',
    DraftingPieces = 'DraftingPieces',
    PlacingPiece = 'PlacingPiece',
    Exploring = 'Exploring',
    ResolvingTechnology = 'ResolvingTechnology',
    PlacingTile = 'PlacingTile',
    PlacingBonusPiece = 'PlacingBonusPiece',
    Attacking = 'Attacking',
    EndingTurn = 'EndingTurn',
    Terraforming = 'Terraforming',
    ChoosingEventOrder = 'ChoosingEventOrder',
    ResolvingEvent = 'ResolvingEvent',
    Seeding = 'Seeding',
    FoundingPlanet = 'FoundingPlanet',
    EndOfGame = 'EndOfGame'
}
