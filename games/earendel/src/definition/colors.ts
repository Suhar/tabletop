import { Color } from '@tabletop/common'

// Players are all warm colours (and white) and planets all cool ones, so a piece never matches a
// planet: a warm colour is a person, a cool colour is a place. Chosen by measuring the ten
// together - player and planet colours alike - for how far apart the closest two are, under
// normal vision and colour blindness. See PLANET_FILL in the UI's Board for the planet half.
export const EarendelColors = [Color.Red, Color.Orange, Color.Yellow, Color.Pink, Color.White]
