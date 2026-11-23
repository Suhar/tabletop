import * as Type from 'typebox'

// What a placed station's complex held when it scored, so the history can explain the points.
export type StationComplexSummary = Type.Static<typeof StationComplexSummary>
export const StationComplexSummary = Type.Object({
    stations: Type.Number(),
    hubs: Type.Number(),
    relays: Type.Number()
})
