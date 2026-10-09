import { assertExists, type BoundingBox, type Point } from '@tabletop/common'
import {
    EXTERNAL_CONNECTIONS,
    LINKS,
    RailroadId,
    SETTLEMENTS,
    SettlementKind,
    incomeLevels,
    railroadDefinition,
    settlement,
    type SettlementDefinition
} from '@tabletop/south-african-railroads'
import { BOARD_HEIGHT, BOARD_TOP, BOARD_WIDTH, METRO_CELL, METRO_GRIDS } from './boardLayout.js'
import { CONNECTION_STAR_RADIUS, connectionLabelBox } from './mapGeometry.js'

export type MapLabel = { x: number; y: number; rotate?: number }

// Name positions from the 2023 redrawn board: the start of each name's baseline. Where the
// drawn icons are larger than the printed ones, placement moves a name clear of them.
const BOARD_LABELS: Record<string, MapLabel> = {
    'aliwal-north': { x: 244, y: 1037 },
    arlington: { x: 628, y: 767 },
    balfour: { x: 945, y: 679 },
    barberton: { x: 1226, y: 825 },
    belfast: { x: 1140, y: 652 },
    bethal: { x: 1010, y: 739 },
    bethlehem: { x: 646, y: 849 },
    boshoek: { x: 936, y: 382 },
    breyten: { x: 1112, y: 736 },
    bultfontein: { x: 369, y: 641 },
    coligny: { x: 715, y: 404 },
    dover: { x: 729, y: 677 },
    dreunberg: { x: 79, y: 984 },
    ermelo: { x: 1064, y: 825 },
    'glencoe-junction': { x: 926, y: 1063 },
    graskop: { x: 1407, y: 691 },
    harrismith: { x: 826, y: 948 },
    hlobane: { x: 1131, y: 1048 },
    kaapmuiden: { x: 1389, y: 808 },
    kimberley: { x: 137, y: 559 },
    klerksdorp: { x: 649, y: 486 },
    koffiefontein: { x: 96, y: 681 },
    komatipoort: { x: 1385, y: 864 },
    kroonstad: { x: 591, y: 656 },
    ladybrand: { x: 570, y: 952 },
    ladysmith: { x: 820, y: 1070 },
    lichtenburg: { x: 703, y: 332 },
    lothair: { x: 1173, y: 796 },
    'lourenco-marques': { x: 1404, y: 979 },
    machadodorp: { x: 1232, y: 705 },
    mafeking: { x: 622, y: 282 },
    magaliesburg: { x: 793, y: 448 },
    maquassi: { x: 525, y: 519 },
    'marble-hall': { x: 1226, y: 514 },
    marquard: { x: 500, y: 829 },
    maseru: { x: 424, y: 955 },
    modderpoort: { x: 432, y: 882 },
    naboomspruit: { x: 1184, y: 385 },
    nelspruit: { x: 1276, y: 771 },
    newcastle: { x: 897, y: 974 },
    'norvals-point': { x: 43, y: 914 },
    nylstroom: { x: 1061, y: 391 },
    pienaarsriver: { x: 979, y: 446 },
    pietersburg: { x: 1318, y: 389 },
    plaston: { x: 1424, y: 752 },
    potchefstroom: { x: 722, y: 548 },
    pretoria: { x: 1011, y: 502 },
    purdimoe: { x: 310, y: 382 },
    sanderton: { x: 991, y: 783 },
    springfontein: { x: 177, y: 878 },
    steelport: { x: 1364, y: 598 },
    theunissen: { x: 464, y: 700 },
    utrecht: { x: 1044, y: 979 },
    vaalwater: { x: 1156, y: 318 },
    vereeniging: { x: 832, y: 630, rotate: 90 },
    vermaas: { x: 607, y: 375 },
    vierfontein: { x: 583, y: 572 },
    volksrust: { x: 931, y: 873 },
    vrede: { x: 864, y: 835 },
    vredefort: { x: 748, y: 605 },
    vryheid: { x: 1029, y: 1063 },
    warden: { x: 854, y: 866 },
    warrenton: { x: 236, y: 488 },
    watervliet: { x: 348, y: 842 },
    welverdiend: { x: 797, y: 478 },
    winburg: { x: 483, y: 787 },
    witbank: { x: 1059, y: 660 },
    zebediela: { x: 1304, y: 473 },
    zoekmakaar: { x: 1386, y: 437 }
}

export type BaseName = { x: number; y: number; railroadId: RailroadId }

// The base railroads' names, printed large beside their homes.
export const BASE_NAMES: BaseName[] = [
    { x: 34, y: 940, railroadId: RailroadId.CMRC },
    { x: 66, y: 588, railroadId: RailroadId.CTRD },
    { x: 196, y: 1068, railroadId: RailroadId.CSAR },
    { x: 812, y: 1098, railroadId: RailroadId.NRC },
    { x: 1352, y: 1026, railroadId: RailroadId.CdFM }
]

export const LEGEND_ORIGIN = { x: 36, y: 286 }

// Printed furniture the names must stay off: legend, both score tracks and the title cartouche.
const FURNITURE: BoundingBox[] = [
    { x: LEGEND_ORIGIN.x - 2, y: LEGEND_ORIGIN.y - 2, width: 226, height: 192 },
    { x: 210, y: 136, width: 420, height: 112 },
    { x: 1058, y: 150, width: 440, height: 78 },
    { x: 322, y: 1008, width: 340, height: 58 }
]

// Libre Baskerville metrics, measured generously so estimates never undershoot the glyphs.
const NAME_CHAR_WIDTH = 7.6
const NAME_ASCENT = 11
const NAME_DESCENT = 4
const BASE_NAME_CHAR_WIDTH = 18
const BASE_NAME_ASCENT = 21
const LABEL_GAP = 3
const FRAME_INSET = 20

const ICON_HALF_SIZE: Record<Exclude<SettlementKind, SettlementKind.MetroArea>, number> = {
    [SettlementKind.RailroadStation]: 13.5,
    [SettlementKind.AgriculturalRailhead]: 18.5,
    [SettlementKind.MercantileCenter]: 16.3,
    [SettlementKind.RailroadBase]: 23
}
const LINK_BOX_HALF_SIZE = 10

function square(x: number, y: number, half: number): BoundingBox {
    return { x: x - half, y: y - half, width: half * 2, height: half * 2 }
}

export const METRO_FRAME_PAD = 3
const METRO_CAPTION_CHAR_WIDTH = 7
const METRO_CAPTION_HEIGHT = 18

export function metroFrameBox(place: SettlementDefinition): BoundingBox {
    const grid = METRO_GRIDS[place.id]
    const rows = Math.ceil(incomeLevels(place.id).length / grid.columns)
    return {
        x: grid.origin.x - METRO_FRAME_PAD,
        y: grid.origin.y - METRO_FRAME_PAD,
        width: grid.columns * METRO_CELL + METRO_FRAME_PAD * 2,
        height: rows * METRO_CELL + METRO_FRAME_PAD * 2
    }
}

function linkBoxes(): BoundingBox[] {
    return LINKS.map((trackLink) => square(trackLink.box.x, trackLink.box.y, LINK_BOX_HALF_SIZE))
}

// Track converges on the metro grids from every side, so their names hang on a plate attached
// to the grid, on the first side clear of link boxes and other settlements.
function placeMetroCaption(place: SettlementDefinition): BoundingBox {
    const frame = metroFrameBox(place)
    const width = Math.max(frame.width, place.name.length * METRO_CAPTION_CHAR_WIDTH + 12)
    const height = METRO_CAPTION_HEIGHT
    const centredX = frame.x + frame.width / 2 - width / 2
    const centredY = frame.y + frame.height / 2 - height / 2
    const sides: BoundingBox[] = [
        { x: centredX, y: frame.y + frame.height - 1, width, height },
        { x: centredX, y: frame.y - height + 1, width, height },
        { x: frame.x + frame.width - 1, y: centredY, width, height },
        { x: frame.x - width + 1, y: centredY, width, height }
    ]
    const obstacles = [
        ...linkBoxes(),
        ...SETTLEMENTS.filter((other) => other.id !== place.id).map(pointIconBox)
    ]
    const caption = sides.find((side) => !obstacles.some((other) => boxesOverlap(side, other)))
    assertExists(caption, `No clear side for the ${place.name} plate`)
    return caption
}

const METRO_CAPTIONS: Record<string, BoundingBox> = Object.fromEntries(
    SETTLEMENTS.filter((place) => place.kind === SettlementKind.MetroArea).map((place) => [
        place.id,
        placeMetroCaption(place)
    ])
)

export function metroCaptionBox(place: SettlementDefinition): BoundingBox {
    return METRO_CAPTIONS[place.id]
}

function pointIconBox(place: SettlementDefinition): BoundingBox {
    return place.kind === SettlementKind.MetroArea
        ? metroFrameBox(place)
        : square(place.x, place.y, ICON_HALF_SIZE[place.kind])
}

function unionBox(a: BoundingBox, b: BoundingBox): BoundingBox {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    return {
        x,
        y,
        width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y
    }
}

export function settlementIconBox(place: SettlementDefinition): BoundingBox {
    return place.kind === SettlementKind.MetroArea
        ? unionBox(metroFrameBox(place), metroCaptionBox(place))
        : pointIconBox(place)
}

export function nameBox(name: string, label: MapLabel): BoundingBox {
    const length = name.length * NAME_CHAR_WIDTH
    return label.rotate === 90
        ? {
              x: label.x - NAME_DESCENT,
              y: label.y,
              width: NAME_ASCENT + NAME_DESCENT,
              height: length
          }
        : {
              x: label.x,
              y: label.y - NAME_ASCENT,
              width: length,
              height: NAME_ASCENT + NAME_DESCENT
          }
}

function baseNameBox(base: BaseName): BoundingBox {
    const name = railroadDefinition(base.railroadId).shortName
    return {
        x: base.x,
        y: base.y - BASE_NAME_ASCENT,
        width: name.length * BASE_NAME_CHAR_WIDTH,
        height: BASE_NAME_ASCENT + 6
    }
}

export type Segment = readonly [Point, Point]

// Each link is drawn from one settlement through its building box to the other.
export const TRACK_SEGMENTS: Segment[] = [
    ...LINKS.flatMap((trackLink): Segment[] => {
        const [a, b] = trackLink.ends.map((id) => settlement(id))
        return [
            [a, trackLink.box],
            [trackLink.box, b]
        ]
    }),
    ...EXTERNAL_CONNECTIONS.map((connection): Segment => [
        settlement(connection.settlementId),
        connection
    ])
]

// Liang-Barsky clipping: the segment touches the box if any part survives the clip.
export function segmentCrossesBox([from, to]: Segment, box: BoundingBox, gap = 0): boolean {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const edges: [number, number][] = [
        [-dx, from.x - (box.x - gap)],
        [dx, box.x + box.width + gap - from.x],
        [-dy, from.y - (box.y - gap)],
        [dy, box.y + box.height + gap - from.y]
    ]
    let enter = 0
    let exit = 1
    for (const [direction, distance] of edges) {
        if (direction === 0) {
            if (distance < 0) {
                return false
            }
            continue
        }
        const t = distance / direction
        if (direction < 0) {
            enter = Math.max(enter, t)
        } else {
            exit = Math.min(exit, t)
        }
        if (enter > exit) {
            return false
        }
    }
    return true
}

export function boxesOverlap(a: BoundingBox, b: BoundingBox, gap = 0): boolean {
    return (
        a.x < b.x + b.width + gap &&
        b.x < a.x + a.width + gap &&
        a.y < b.y + b.height + gap &&
        b.y < a.y + a.height + gap
    )
}

function insideFrame(box: BoundingBox): boolean {
    return (
        box.x >= FRAME_INSET &&
        box.x + box.width <= BOARD_WIDTH - FRAME_INSET &&
        box.y >= BOARD_TOP + FRAME_INSET &&
        box.y + box.height <= BOARD_TOP + BOARD_HEIGHT - FRAME_INSET
    )
}

const RING_DISTANCES = [3, 8, 14, 20, 28, 38, 48]
const RING_DIRECTIONS = 16

function labelFromBox(box: BoundingBox, vertical: boolean): MapLabel {
    return vertical
        ? { x: box.x + NAME_DESCENT, y: box.y, rotate: 90 }
        : { x: box.x, y: box.y + NAME_ASCENT }
}

// Spots around the icon, nearest ring first: each name box touches a point just off the icon in
// one of sixteen directions, on the side that faces away from it. Vertical names, as the board
// prints Vereeniging, come after every horizontal spot.
function ringLabels(place: SettlementDefinition, vertical: boolean): MapLabel[] {
    const icon = settlementIconBox(place)
    const length = place.name.length * NAME_CHAR_WIDTH
    const thickness = NAME_ASCENT + NAME_DESCENT
    const width = vertical ? thickness : length
    const height = vertical ? length : thickness
    const centre = { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2 }
    return RING_DISTANCES.flatMap((distance) =>
        Array.from({ length: RING_DIRECTIONS }, (_, index) => {
            const angle = (2 * Math.PI * index) / RING_DIRECTIONS
            const cos = Math.cos(angle)
            const sin = Math.sin(angle)
            const x = centre.x + cos * (icon.width / 2 + distance)
            const y = centre.y + sin * (icon.height / 2 + distance)
            return labelFromBox(
                {
                    x: cos > 0.3 ? x : cos < -0.3 ? x - width : x - width / 2,
                    y: sin > 0.3 ? y : sin < -0.3 ? y - height : y - height / 2,
                    width,
                    height
                },
                vertical
            )
        })
    )
}

function placeLabels(): Record<string, MapLabel> {
    const fixed: BoundingBox[] = [
        ...SETTLEMENTS.map(settlementIconBox),
        ...linkBoxes(),
        ...EXTERNAL_CONNECTIONS.flatMap((connection) => [
            square(connection.x, connection.y, CONNECTION_STAR_RADIUS),
            connectionLabelBox(connection)
        ]),
        ...BASE_NAMES.map(baseNameBox),
        ...FURNITURE
    ]
    const clearOfMap = (box: BoundingBox) =>
        insideFrame(box) &&
        !fixed.some((other) => boxesOverlap(box, other, LABEL_GAP)) &&
        !TRACK_SEGMENTS.some((segment) => segmentCrossesBox(segment, box, LABEL_GAP))
    const options = SETTLEMENTS.filter(
        (place) => place.kind !== SettlementKind.MetroArea && BOARD_LABELS[place.id]
    ).map((place) => ({
        place,
        labels: [
            BOARD_LABELS[place.id],
            ...ringLabels(place, false),
            ...ringLabels(place, true)
        ].filter((label) => clearOfMap(nameBox(place.name, label)))
    }))
    options.sort((a, b) => a.labels.length - b.labels.length)
    const placedBoxes: BoundingBox[] = []
    const placed: Record<string, MapLabel> = {}
    for (const { place, labels } of options) {
        const label = labels.find(
            (candidate) =>
                !placedBoxes.some((other) =>
                    boxesOverlap(nameBox(place.name, candidate), other, LABEL_GAP)
                )
        )
        assertExists(label, `No clear spot for ${place.name}`)
        placed[place.id] = label
        placedBoxes.push(nameBox(place.name, label))
    }
    return placed
}

export const SETTLEMENT_LABELS: Record<string, MapLabel> = placeLabels()
