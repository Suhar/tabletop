import { Color } from '@tabletop/common'

// A fighter's silhouette, drawn about the origin with its nose at the top (y negative). The
// body is filled; a trail, where one is given, is stroked below it instead of the exhaust;
// windows are drawn over the body in the exhaust's pale color.
export type FighterSilhouette = {
    name: string
    body: string
    trail?: string
    windows?: string[]
}

export const KITE: FighterSilhouette = {
    name: 'kite',
    body: 'M0,-13 L6.4,3 L0,8 L-6.4,3 Z',
    trail: 'M-6,8 L-8,15 L0,11 L8,15 L6,8'
}
// A plain delta with a bite out of its base and two cockpit windows along the nose.
export const NOTCHED_DELTA: FighterSilhouette = {
    name: 'notched delta',
    body: 'M0,-13 L10,9 L5,7 L0,9 L-5,7 L-10,9 Z',
    windows: ['M0,-9 L1.5,-5 L-1.5,-5 Z', 'M0,-3 L1.6,0.5 L-1.6,0.5 Z']
}
export const CRUCIFORM: FighterSilhouette = {
    name: 'cruciform',
    body: 'M0,-13 L3,-3 L11,1 L11,4 L3,3 L2,9 L-2,9 L-3,3 L-11,4 L-11,1 L-3,-3 Z'
}
export const SWALLOWTAIL: FighterSilhouette = {
    name: 'swallowtail',
    body: 'M0,-13 L5,1 L10,10 L0,6 L-10,10 L-5,1 Z'
}
export const NEEDLE: FighterSilhouette = {
    name: 'needle',
    body: 'M0,-14 L2,-1 L7,9 L2,6 L0,10 L-2,6 L-7,9 L-2,-1 Z'
}
export const DART: FighterSilhouette = {
    name: 'dart',
    body: 'M0,-13 L4,4 L7,9 L0,6 L-7,9 L-4,4 Z'
}

// Each player color flies its own fighter (EarendelColors: red, orange, yellow, pink, white).
const BY_COLOR: Partial<Record<Color, FighterSilhouette>> = {
    [Color.Red]: KITE,
    [Color.Orange]: NOTCHED_DELTA,
    [Color.Yellow]: CRUCIFORM,
    [Color.Pink]: SWALLOWTAIL,
    [Color.White]: NEEDLE
}

export function fighterSilhouetteFor(color: Color | undefined): FighterSilhouette {
    return (color && BY_COLOR[color]) || DART
}
