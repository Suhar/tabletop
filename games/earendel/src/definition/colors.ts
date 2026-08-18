import { Color } from '@tabletop/common'

// The fifth colour is Gray rather than Black. Against a starfield a near-black player reads as a
// hole in the board rather than as somebody's ships, and the colorizer renders both slots as the
// same light grey so a game already dealt Black is not left invisible.
export const EarendelColors = [Color.Green, Color.Yellow, Color.Blue, Color.Red, Color.Gray]