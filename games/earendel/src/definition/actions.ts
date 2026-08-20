// Defines the entire set of action types

export enum ActionType { 
    DrawPieces = 'drawPieces',
    UseLogisticsUpgrade = 'useLogisticsUpgrade',
    UseUpdatedLogistics = 'useUpdatedLogistics',
    UseTacticalFeint = 'useTacticalFeint',
    UseTradeRouteWormhole = 'useTradeRouteWormhole',
    UseImmediateDownload = 'useImmediateDownload',
    AttackSpread = 'attackSpread',
    DiscardPiece = 'discardPiece',
    PlaceTile = 'placeTile',
    MovePiece = 'movePiece',
    AttackPiece = 'attackPiece',
    ChooseTechnology = 'chooseTechnology',
    ChoosePlanet = 'choosePlanet',
    PlacePiece = 'placePiece',
    Pass = 'pass',
}