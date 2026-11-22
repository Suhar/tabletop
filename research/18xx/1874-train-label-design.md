# 1874 train label and stations by location

## Surveyed

- Markers on single trains: 1862's warranties (counted, shown as pips through `trainTokens`),
  1874's quarantine (one marked train), and attached rolling stock (1822's Pullman, its own
  train record). Most titles mark no train.
- A company's stations that stand for other companies' homes: 1871's Pier and 1874's Luka.
  Joint and neutral stations already have their own appearances (`sharedStations`,
  `neutralStation`).

## Shared

- `TrainTokens.label` extends the existing hook rather than adding one for markers. The badge
  prints it, every place that chooses an owned train passes it, and trade-in choices differing
  by tokens stay separate, since they differ in what is given up.
- `MapViewDefinition.locationStations` changes only a station's appearance at a location.

## Title-owned

- 1874 decides which train has a label and its words, and prints each Luka station with the
  initials of the home it holds.

## Limits

- History rows record train kinds, so they carry no label.
- A title wanting more than one label on a train would need a list.

## Verified by

`trainBuyingModule.svelte.spec.ts` (trade-ins), `games/two-crowns-ui/src/lib/mapView.spec.ts`
(homes and J9), and the first playtest's position with two 6H trains, one marked.
