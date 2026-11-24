import {
    type Piece,
    PieceType,
    categoryOfColor,
    PLANET_COLORS,
    ROUTE_POWER_INFO,
    TECHNOLOGY_CATEGORY_INFO,
    TECHNOLOGY_EFFECT_INFO,
    TechnologyEffectKind,
    TechnologyTiming
} from '@tabletop/earendel'
import { Power } from '$lib/model/stagedSelection.js'
import { specialPieceInfo } from './specialPieces.js'

// The Rules pill: a short, plain account of the rules that bear on the decision in front of the
// player. This is not the rule book (games/earendel/docs/rules.md) quoted, and it is rules only:
// what the choice is and what each answer does, never what the player ought to choose.

export type RulesHelp = {
    title: string
    // A sentence on what is being decided.
    lead: string
    // The rules that bear on it: two to five of them.
    points: string[]
}

// Standing notes, not tied to a decision: each sits as a pill beside the caption of the row it
// explains, on anyone's turn, while the Rules pills are on.
export const ELEVATED_HELP: RulesHelp = {
    title: 'Enhanced technologies',
    lead: 'These five cards, one for each planet color, are shuffled into the original deck. A survey of a planet of that color may turn one up.',
    points: [
        'Taking one spends the planet for everyone: it takes effect at once, every player counts as holding it, and nobody surveys or researches that planet again.',
        'An event is resolved once, one pick each. The discoverer picks first, then sets the order the others follow.',
        "A global changes a rule for everyone from then on. Its discoverer also gets one pick of that color's event, alone.",
        'If offered but not taken, the card goes to the discard pile like any other.'
    ]
}

export const SPECIAL_UNITS_HELP: RulesHelp = {
    title: 'Special units',
    lead: 'These five units, one for each category, are the ones in this game. Each comes from its own technology: gaining the technology gives you the unit, face up in front of you.',
    points: [
        'You may place a special unit instead of your draw.',
        'The ships that you did not discard go back into your bag.',
        'A special unit counts 1 toward control where it stands.',
        "Most are ships that a fighter can destroy; each unit's card says what can touch it."
    ]
}

// The decisions with a note of their own. Placing a special piece, using a power and picking
// for an event are written from the piece, the technology or the event instead.
export enum RulesTopic {
    Stow = 'stow',
    OpeningStation = 'openingStation',
    Draw = 'draw',
    DraftDiscard = 'draftDiscard',
    PlaceShips = 'placeShips',
    PlaceProbe = 'placeProbe',
    PlaceFighter = 'placeFighter',
    PlaceStation = 'placeStation',
    TileShip = 'tileShip',
    Survey = 'survey',
    ChooseTechnology = 'chooseTechnology',
    Attack = 'attack',
    TorpedoStrike = 'torpedoStrike',
    Terraform = 'terraform',
    Seed = 'seed',
    FoundPlanet = 'foundPlanet',
    LayTile = 'layTile',
    EventOrder = 'eventOrder',
    Drift = 'drift',
    EndTurn = 'endTurn'
}

export const RULES_HELP: Record<RulesTopic, RulesHelp> = {
    [RulesTopic.Stow]: {
        title: 'One more ship',
        lead: 'Before the first turn, every player adds one extra ship to their bag in secret.',
        points: [
            'Your choices are a level 3 probe, a level 3 fighter or a station.',
            'It is shuffled into your bag as the game opens.'
        ]
    },
    [RulesTopic.OpeningStation]: {
        title: 'Your first station',
        lead: 'Place your free station on any open hex. Everyone starts the game with one on the board.',
        points: [
            'It scores nothing when placed, but it counts as a station in its group when later stations score.',
            'It counts 1 toward control of each planet it touches. If it joins two planets of the same color it sets up a trade route, with its power but no points.',
            'The opening runs in reverse turn order, so the last player places first and the first player takes the first turn.'
        ]
    },
    [RulesTopic.Draw]: {
        title: 'Starting your turn',
        lead: 'Click your bag to draw three ships. The first thing you then do is discard one of them; the others you place.',
        points: [
            'Any claim you staked last turn is settled first: if your probes lead on that planet, its technology is yours and those probes go into orbit.',
            'Your bag is hidden, but the ships you draw are shown to everyone.',
            'Drawing shows you something new, so it cannot be undone.'
        ]
    },
    [RulesTopic.DraftDiscard]: {
        title: 'The draft',
        lead: 'Before anything else this turn, discard one of the ships that you drew.',
        points: [
            'Nothing else can be done until the discard is made: no ship placed, no technology used, no special piece played.',
            'The discarded ship leaves the game. The others are placed this turn, in either order.',
            'Some technologies change the details of this step.'
        ]
    },
    [RulesTopic.PlaceShips]: {
        title: 'Placing your ships',
        lead: 'Place a ship on an unoccupied hex.',
        points: [
            'The two ships may be placed in either order.',
            'A struck-through ship has nowhere legal to go right now.',
            'If you hold a special piece, you may play it instead of these ships (which go back into your bag).'
        ]
    },
    [RulesTopic.PlaceProbe]: {
        title: 'Placing a probe',
        lead: 'Probes survey adjacent planets in hopes of claiming their technology.',
        points: [
            'A placed probe may survey one adjacent planet, whether it is explored or not, as long as its level exceeds that of all opponents.',
            'A level 3 probe turns up three technologies to choose from; a level 2 turns up two.',
            'A survey does not gain the technology immediately. You gain it at the start of your next turn, and only if your probe(s) still lead there.',
            'A probe cannot go on a hex that lies on a clear line between two of one rival’s stations.'
        ]
    },
    [RulesTopic.PlaceFighter]: {
        title: 'Placing a fighter',
        lead: 'When a fighter is placed, it may be able to fire on a neighbor.',
        points: [
            'A shot destroys a probe outright. Against a fighter of its own level or lower it knocks the target down one level, and a level 1 fighter is destroyed. A stronger fighter is out of reach.',
            'Stations cannot be shot at all.',
            'Any ship with a friendly fighter beside it is escorted and cannot be shot.',
            'A fighter also counts its level toward control of every planet it touches.'
        ]
    },
    [RulesTopic.PlaceStation]: {
        title: 'Placing a station',
        lead: 'A station scores the moment it is placed.',
        points: [
            'It scores 1 for itself and 1 for every other station of yours in the same group.',
            'Stations are in one group when they touch, or when they see each other along a straight line with nothing between them.',
            'That same line closes the hexes between the two stations to rival probes.',
            'Fighters cannot destroy a station. A station counts 1 toward control of the planets it touches.'
        ]
    },
    [RulesTopic.TileShip]: {
        title: 'The ship for the new tile',
        lead: 'The ship you drew with the tile goes on the tile you just laid.',
        points: [
            'It is an extra placement, on top of the two ships from your draft.',
            'It is placed like any other ship: a station scores, a probe may survey, a fighter may fire.'
        ]
    },
    [RulesTopic.Survey]: {
        title: 'Surveying a planet',
        lead: 'Your probe is beside a planet where your probes lead. Survey it, or skip.',
        points: [
            'Surveying an unexplored planet turns up as many technologies as the probe’s level, and you choose which one the planet will hold. An explored planet offers only the one it already holds.',
            'Either way you stake a claim, which pays at the start of your next turn if your probes still lead there.',
            'A probe that surveys is committed: from now on its survey power counts on that planet alone, not on any other planet it touches.',
            'Skipping stakes nothing, but leaves the probe counting 1 for control on every planet beside it.'
        ]
    },
    [RulesTopic.ChooseTechnology]: {
        title: 'Choosing a technology',
        lead: 'Your probe has surveyed the planet. Tech cards were drawn until enough of them matched the planet type.',
        points: [
            'Choose which of these technologies the planet will hold; hover each to read it.',
            'You are staking a claim, not taking it. The technology becomes yours at the start of your next turn, if your probes still lead on this planet then.',
            'The planet keeps the technology you choose for the rest of the game, and any player may claim it there later.',
            'The ones you pass over go to the discard pile.'
        ]
    },
    [RulesTopic.Attack]: {
        title: 'Firing',
        lead: 'Your fighter may fire on one highlighted enemy beside it, or hold fire.',
        points: [
            'A probe is destroyed. A fighter loses a level, and a level 1 fighter is destroyed. Only the highlighted pieces are in reach: stations, and anything with a friendly fighter beside it, never are.',
            'A destroyed ship is out of the game, and the hex it stood on is free again.',
            'Control of the planets beside it is counted again without it, and a claim ends if the probes behind it no longer lead.',
            'Firing is never required.'
        ]
    },
    [RulesTopic.TorpedoStrike]: {
        title: 'The torpedo strikes',
        lead: 'Click the station your torpedo destroys. The fighter that carried it is destroyed too.',
        points: [
            'A torpedo is the only thing that removes a station.',
            'An escort does not stop a torpedo.',
            'Both pieces leave the game, and Gamma Torpedo is then out of use for three of your turns.'
        ]
    },
    [RulesTopic.Terraform]: {
        title: 'Terraforming',
        lead: 'Your terraformer may change the color of one planet beside it, or leave them all as they are.',
        points: [
            'This action may set up a trade route, which scores, or end one that joined the planet under its old color.',
            'The change is permanent, and a planet with a terraformer beside it cannot be changed again.'
        ]
    },
    [RulesTopic.Seed]: {
        title: 'Seeding nebula',
        lead: 'Your seeder may turn one highlighted empty hex into nebula this turn, or leave it.',
        points: [
            'Nothing can be placed on nebula or move through it, and stations cannot see past it, so it cuts groups and blockades as a planet does.',
            'The cloud grows from the seeder: a hex beside it, or beside a nebula already joined to it.',
            'Each seeder lays four hexes in all, one a turn, and nebula never clears.'
        ]
    },
    [RulesTopic.FoundPlanet]: {
        title: 'Founding a planet',
        lead: 'Your Artificial Planet becomes a new, unexplored planet where you placed it. You choose its color.',
        points: [
            'The color decides which technologies it will offer when someone surveys it.',
            'It also decides which planets it can be joined to by a trade route: only two of the same color.',
            'From now on it is a planet like any other: it can be surveyed, controlled and joined by a trade route.'
        ]
    },
    [RulesTopic.LayTile]: {
        title: 'Laying a tile',
        lead: 'Choose where the new tile joins the map by clicking one of the highlighted positions.',
        points: [
            'You have already drawn the ship that follows it: it must be placed on this tile.',
            'The ship, when placed, acts like any other ship that is placed.',
            'If no hex of the tile is open to the ship, the ship goes back into your bag instead.',
            'The tile brings a new, unexplored planet with it.'
        ]
    },
    [RulesTopic.EventOrder]: {
        title: 'An elevated event has been triggered!',
        lead: 'You discovered an elevated technology that fires once for everybody. You pick first; click the other players in the order they will follow.',
        points: [
            'Picks are made one at a time in that order. A planet, card or unit taken by one player is not there for the next.',
            'Each player then makes their own pick on their own.',
            'The event happens now and is over; it is not kept by anyone.'
        ]
    },
    [RulesTopic.Drift]: {
        title: 'Free Drift',
        lead: 'Before placing, you may step one of your pieces into an empty hex beside it, or stay put.',
        points: [
            'It is a plain move, not a placement: nothing scores, surveys or fires when it lands.',
            'Control of planets, and any claim that depends on it, is counted from where the piece now stands.',
            'This is a global technology: every player gets the same step at the start of every turn.'
        ]
    },
    [RulesTopic.EndTurn]: {
        title: 'Ending your turn',
        lead: 'Your ships are placed, but you have a technology you could still use. Use it now, or end your turn.',
        points: [
            'A one-shot technology you do not use is kept for a later turn.',
            'A technology on a timer is ready again three of your own turns after you use it.',
            'Each chip beside your hand says what it does when you hover over it.'
        ]
    }
}

// What a power's own note adds to what its chip says: the rule its use turns on.
const POWER_TIP: Record<Power, string> = {
    [Power.Shift]:
        'The piece counts as newly placed where it lands: a station scores again, a probe may survey, a fighter may fire.',
    [Power.Warp]:
        'The way there must be empty space from hex to hex: a piece, a planet or nebula stops it. Where it lands it counts as newly placed.',
    [Power.Rift]:
        'Both ends must be on the outer edge of the map. Where it comes out it counts as newly placed.',
    [Power.Spoof]:
        'The rival’s piece is moved, not placed: nothing scores, surveys or fires for its owner where it lands.',
    [Power.Feint]:
        'Your ship counts as newly placed in the enemy’s old hex; theirs simply takes yours.',
    [Power.Wormhole]:
        'It needs two planets of the same color: the ship leaves the side of one and comes out beside the other, counting as newly placed.',
    [Power.Download]:
        'Choose one of your Download planets, then an explored planet within three hexes of it. You gain that technology at once, without staking a claim.',
    [Power.Logistics]:
        'A fighter already on the board fires as if it had just been placed, on one enemy beside it.',
    [Power.Spread]:
        'Tick any or all of the highlighted targets, then fire: every one of them is hit by the same fighter.',
    [Power.Railgun]:
        'It only matters against a fighter the shot would otherwise just damage. The game will not spend it on a shot that kills anyway.',
    [Power.Torpedo]:
        'Arm it, then place the fighter beside a station or Bastion. The fighter and that piece are both destroyed, whoever owns it.',
    [Power.Asteroid]:
        'Three copies of the ship you choose go into your bag, and nobody else is told which ship it was.',
    [Power.Breach]:
        'The Scrap sits in that player’s bag. Thrown out in a draft it goes back in; to be rid of it they must play it in place of a ship.',
    [Power.Colony]:
        'The planet counts as one of your stations for the groups touching it, scores at once, and stays yours even if you lose control of the planet.'
}

const POWER_TECHNOLOGY: Record<Power, TechnologyEffectKind> = {
    [Power.Shift]: TechnologyEffectKind.MoveFriendlyPiece,
    [Power.Warp]: TechnologyEffectKind.WarpDrive,
    [Power.Rift]: TechnologyEffectKind.DimensionalRift,
    [Power.Spoof]: TechnologyEffectKind.SpoofedOrders,
    [Power.Feint]: TechnologyEffectKind.TacticalFeint,
    [Power.Wormhole]: TechnologyEffectKind.TradeRouteWormhole,
    [Power.Download]: TechnologyEffectKind.ImmediateDownload,
    [Power.Logistics]: TechnologyEffectKind.UpdatedLogistics,
    [Power.Spread]: TechnologyEffectKind.FullTorpedoSpread,
    [Power.Railgun]: TechnologyEffectKind.Railgun,
    [Power.Torpedo]: TechnologyEffectKind.GammaTorpedo,
    [Power.Asteroid]: TechnologyEffectKind.AsteroidField,
    [Power.Breach]: TechnologyEffectKind.SecurityBreach,
    [Power.Colony]: TechnologyEffectKind.ColonyShip
}

export function powerHelp(power: Power): RulesHelp {
    const info = TECHNOLOGY_EFFECT_INFO[POWER_TECHNOLOGY[power]]
    return {
        title: `Using ${info.name}`,
        lead: info.ability,
        points: [
            POWER_TIP[power],
            info.timing === TechnologyTiming.Cooldown
                ? 'It is yours for the rest of the game, but once used it is out of use for three of your own turns.'
                : 'It can be used once. You do not have to use it now: it keeps until you choose to.',
            'Click its chip again to change your mind before it is done.'
        ]
    }
}

// What each elevated event asks of the player picking.
const EVENT_TIP: Partial<Record<TechnologyEffectKind, string>> = {
    [TechnologyEffectKind.OrbitalBombardment]:
        'Click any highlighted enemy probe or fighter, anywhere on the board, to destroy it. It need not be near anything of yours.',
    [TechnologyEffectKind.WormholeStorm]:
        'Click one of your pieces, then any empty hex beside any planet. It is a move, not a placement: nothing scores, surveys or fires when it lands.',
    [TechnologyEffectKind.SalvageRights]:
        'Choose one technology from the discard pile. It is yours at once, without staking a claim.',
    [TechnologyEffectKind.SignalIntercept]:
        'Click any explored planet to gain the technology it holds, at once. Each planet can be taken by one player only.',
    [TechnologyEffectKind.ShipyardWorld]:
        'Choose one special unit from the stock. There is one of each unit in play, so later pickers choose from what is left.'
}

export const EVENT_KINDS: TechnologyEffectKind[] = [
    TechnologyEffectKind.OrbitalBombardment,
    TechnologyEffectKind.WormholeStorm,
    TechnologyEffectKind.SalvageRights,
    TechnologyEffectKind.SignalIntercept,
    TechnologyEffectKind.ShipyardWorld
]

export function eventHelp(kind: TechnologyEffectKind): RulesHelp | undefined {
    const tip = EVENT_TIP[kind]
    if (!tip) return undefined
    const info = TECHNOLOGY_EFFECT_INFO[kind]
    return {
        title: `${info.name}: your pick`,
        lead: info.ability,
        points: [
            tip,
            'Everybody gets one pick, in the order the discoverer chose. This is yours.',
            'If there is nothing for you to pick, you are passed over.'
        ]
    }
}

// A special piece about to be placed: what it does, and what playing it costs.
export function specialPieceHelp(piece: Piece): RulesHelp | undefined {
    const info = specialPieceInfo(piece)
    if (!info?.rules) return undefined
    return {
        title: `Placing your ${info.name}`,
        lead: info.rules,
        points: [
            'A special piece is played instead of the ships you drew: your hand goes back into your bag, to be drawn again later.',
            'It can only be played before any drawn ship is down this turn.',
            'It is kept face up until you play it, on any later turn of yours.'
        ]
    }
}

// What the player is being asked to decide.
export type Decision = {
    stowing?: boolean
    openingStation?: boolean
    drawing?: boolean
    choosingEventOrder?: boolean
    // The elevated event the player is picking for.
    event?: TechnologyEffectKind
    layingTile?: boolean
    drifting?: boolean
    seeding?: boolean
    founding?: boolean
    terraforming?: boolean
    surveying?: boolean
    choosingTechnology?: boolean
    torpedoStrike?: boolean
    attacking?: boolean
    discarding?: boolean
    // The power chosen from the panel and being played.
    power?: Power
    // Whether a ship or special piece is to be placed, and which is chosen, if any.
    placing?: boolean
    piece?: Piece
    // The ship that follows a laid tile is the one being placed.
    tileShip?: boolean
    endingTurn?: boolean
}

const SHIP_TOPIC: Partial<Record<PieceType, RulesTopic>> = {
    [PieceType.Probe]: RulesTopic.PlaceProbe,
    [PieceType.Fighter]: RulesTopic.PlaceFighter,
    [PieceType.Station]: RulesTopic.PlaceStation
}

// The note for the decision, most pressing first: what the game is waiting on comes before what
// the player merely could do.
export function rulesHelpFor(decision: Decision): RulesHelp | undefined {
    const topic = (key: RulesTopic) => RULES_HELP[key]

    if (decision.stowing) return topic(RulesTopic.Stow)
    if (decision.openingStation) return topic(RulesTopic.OpeningStation)
    if (decision.drawing) return topic(RulesTopic.Draw)
    if (decision.choosingEventOrder) return topic(RulesTopic.EventOrder)
    if (decision.event) return eventHelp(decision.event)
    if (decision.layingTile) return topic(RulesTopic.LayTile)
    if (decision.drifting) return topic(RulesTopic.Drift)
    if (decision.seeding) return topic(RulesTopic.Seed)
    if (decision.founding) return topic(RulesTopic.FoundPlanet)
    if (decision.terraforming) return topic(RulesTopic.Terraform)
    if (decision.surveying) return topic(RulesTopic.Survey)
    if (decision.choosingTechnology) return topic(RulesTopic.ChooseTechnology)
    if (decision.torpedoStrike) return topic(RulesTopic.TorpedoStrike)
    if (decision.attacking && decision.power !== Power.Spread && decision.power !== Power.Railgun) {
        return topic(RulesTopic.Attack)
    }
    if (decision.discarding) return topic(RulesTopic.DraftDiscard)
    if (decision.power) return powerHelp(decision.power)
    if (decision.placing) {
        if (decision.tileShip) return topic(RulesTopic.TileShip)
        if (!decision.piece) return topic(RulesTopic.PlaceShips)
        const special = specialPieceHelp(decision.piece)
        if (special) return special
        const ship = SHIP_TOPIC[decision.piece.type]
        return ship ? topic(ship) : undefined
    }
    if (decision.endingTurn) return topic(RulesTopic.EndTurn)
    return undefined
}

// The overview: the game in a handful of cards, opened from the title and from the header. It
// reuses the notes above where one already says it, and adds the few that belong to no single
// decision.
// Why the game is called what it is: the overview's first card. `lead` is the paragraph; add
// `points` only if it wants a list under it.
const THE_NAME: RulesHelp = {
    title: 'Earendel',
    lead: 'At 28 billion light years from Earth, Earendel is one of the most distant objects that we have observed. It may be a star or a star system; this game imagines it as a system.',
    points: [
        'You are one of a handful of engineers who are investigating this system using a fleet of drones: some drones explore, some provide safety, and some are hostile.',
        'Each planet in the system holds the key to a technology that will help perhaps not just you, but all of the explorers who are here.'
    ]
}

const IN_BRIEF: RulesHelp = {
    title: 'The game in brief',
    lead: 'Explore planets, gain their technologies, build stations and join planets with your ships. The player with the most points when the game ends wins.',
    points: [
        'Your bag starts with 22 ships: 8 probes and 8 fighters (four each of level 2 and level 3) and 6 stations. At the opening you secretly add one more.',
        'On your turn you draw three ships from your bag, discard one and place the other two.',
        'Stations and trade routes score during play. Nothing is scored at the end.',
        'A trade route gives you a power for as long as it stands. So does controlling enough planets.',
        'Scores are public and never go down.'
    ]
}

const CONTROL_HELP: RulesHelp = {
    title: 'Control of planets',
    lead: 'A planet is controlled by whoever has the most power on the six hexes touching it.',
    points: [
        'A probe counts 1, a fighter counts its level, a station counts 1 and a special unit counts 1.',
        'To take a planet you must get ahead. A tie changes nothing: whoever already controlled it keeps it while they are still tied for the most.',
        "Control three planets of one color (two in a two-player game) and you have that color's trade route power without needing a route.",
        'Control one planet of each of the five colors and you score 2 points at the start of each of your turns.',
        'A technology needs more than control: it takes strictly more probe strength than anyone else beside the planet.'
    ]
}

const ROUTES_HELP: RulesHelp = {
    title: 'Trade routes',
    lead: 'Join two planets of the same color with an unbroken chain of your own ships and the pair becomes your trade route.',
    points: [
        'Setting up a route scores 1 point for each ship in the chain, every time. The shortest run through your ships is the one counted.',
        'Any of your ships link a chain, whatever their type. Rival ships do not, and a chain must go around a planet.',
        'A pair of planets carries one route at a time. While yours stands, a rival chain joining the same pair earns nothing.',
        'Your route ends the moment you have no chain joining the pair. Then anyone can take it: the only player with a chain there gets it at once, and if several have one, nobody does until one is left.'
    ]
}

const ROUTE_POWERS_HELP: RulesHelp = {
    title: 'Trade route powers',
    lead: "While you have a trade route of a color, you have that color's power. Lose your last route of that color and the power goes with it.",
    points: PLANET_COLORS.map((color) => {
        const power = ROUTE_POWER_INFO[color]
        const theme = TECHNOLOGY_CATEGORY_INFO[categoryOfColor(color)].name
        const colorName = color.charAt(0).toUpperCase() + color.slice(1)
        return `${colorName} (${theme}), ${power.name}: ${power.ability}`
    })
}

const END_HELP: RulesHelp = {
    title: 'The end of the game',
    lead: 'The game ends the moment any player places the last piece from their bag. There is no final round.',
    points: [
        'It also ends the moment a player cannot legally place a ship they drew and has no special unit to place instead.',
        'Final scores are the points scored during play. Nothing is added at the end.',
        'A tie for the highest score is a shared win.'
    ]
}

// What a card is about, which the overview shows by its color and a small label.
export enum OverviewGroup {
    Game = 'game',
    Ships = 'ships',
    Scoring = 'scoring',
    Technology = 'technology'
}

export const RULES_OVERVIEW: readonly { group: OverviewGroup; note: RulesHelp }[] = [
    { group: OverviewGroup.Game, note: THE_NAME },
    { group: OverviewGroup.Game, note: IN_BRIEF },
    { group: OverviewGroup.Ships, note: RULES_HELP[RulesTopic.PlaceProbe] },
    { group: OverviewGroup.Ships, note: RULES_HELP[RulesTopic.PlaceFighter] },
    { group: OverviewGroup.Ships, note: RULES_HELP[RulesTopic.PlaceStation] },
    { group: OverviewGroup.Scoring, note: CONTROL_HELP },
    { group: OverviewGroup.Scoring, note: ROUTES_HELP },
    { group: OverviewGroup.Scoring, note: ROUTE_POWERS_HELP },
    { group: OverviewGroup.Technology, note: ELEVATED_HELP },
    { group: OverviewGroup.Technology, note: SPECIAL_UNITS_HELP },
    { group: OverviewGroup.Game, note: END_HELP }
]
