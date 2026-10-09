import { describe, expect, it } from 'vitest'
import { LINKS, SETTLEMENTS, SettlementKind } from '@tabletop/south-african-railroads'
import {
    SETTLEMENT_LABELS,
    TRACK_SEGMENTS,
    boxesOverlap,
    metroCaptionBox,
    nameBox,
    segmentCrossesBox,
    settlementIconBox
} from './mapLabels.js'

const names = SETTLEMENTS.filter((place) => SETTLEMENT_LABELS[place.id]).map((place) => ({
    id: place.id,
    box: nameBox(place.name, SETTLEMENT_LABELS[place.id])
}))

describe('settlement names', () => {
    it('stay clear of every settlement icon', () => {
        const clashes = names.flatMap((name) =>
            SETTLEMENTS.filter((place) => boxesOverlap(name.box, settlementIconBox(place))).map(
                (place) => `${name.id} on ${place.id}`
            )
        )
        expect(clashes).toEqual([])
    })

    it('stay clear of the link building boxes', () => {
        const clashes = names.flatMap((name) =>
            LINKS.filter((trackLink) =>
                boxesOverlap(name.box, {
                    x: trackLink.box.x - 10,
                    y: trackLink.box.y - 10,
                    width: 20,
                    height: 20
                })
            ).map((trackLink) => `${name.id} on ${trackLink.id}`)
        )
        expect(clashes).toEqual([])
    })

    it('stay clear of the track lines', () => {
        const clashes = names
            .filter((name) =>
                TRACK_SEGMENTS.some((segment) => segmentCrossesBox(segment, name.box))
            )
            .map((name) => name.id)
        expect(clashes).toEqual([])
    })

    it('stay clear of each other', () => {
        const clashes = names.flatMap((name, index) =>
            names
                .slice(index + 1)
                .filter((other) => boxesOverlap(name.box, other.box))
                .map((other) => `${name.id} on ${other.id}`)
        )
        expect(clashes).toEqual([])
    })
})

describe('metro name plates', () => {
    const metros = SETTLEMENTS.filter((place) => place.kind === SettlementKind.MetroArea)

    it('stay clear of the link building boxes and other icons', () => {
        const clashes = metros.flatMap((metro) => {
            const plate = metroCaptionBox(metro)
            return [
                ...LINKS.filter((trackLink) =>
                    boxesOverlap(plate, {
                        x: trackLink.box.x - 10,
                        y: trackLink.box.y - 10,
                        width: 20,
                        height: 20
                    })
                ).map((trackLink) => `${metro.id} on ${trackLink.id}`),
                ...SETTLEMENTS.filter(
                    (place) =>
                        place.id !== metro.id && boxesOverlap(plate, settlementIconBox(place))
                ).map((place) => `${metro.id} on ${place.id}`)
            ]
        })
        expect(clashes).toEqual([])
    })
})
