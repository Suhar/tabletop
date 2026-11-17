# Station tokens

`<label>.svg` for the eight Luka companies, the five branches and the Luka: the first token of each
company's sheet in 18xx Maker's token export of `TwoCrowns1874.json`, in its default company theme
(Rails on Board), with the labels turned into Bitter Bold paths. `mapView.ts` gives them to the
stations. `gray-city-tile.svg` is not a token export.

To redo them after a company's `token` changes in the design file, export the tokens from an
18xx Maker checkout and convert them (see the top of `scripts/maker-tokens.mjs`):

```shell
node ./bin/maker.js export TwoCrowns1874.json --format svg --docs tokens --out /tmp/maker
pnpm --filter @tabletop/two-crowns-ui exec node scripts/maker-tokens.mjs /tmp/maker/TwoCrowns1874/svg <18xx Maker checkout>
```

The public 18xx Maker (1.0.0-beta.138) rejects the design file's `playerAid` and `player-aids`;
export from a copy without them, which doesn't change the tokens.
