# Contributing

Thanks for looking. This is a small library with one job, so the bar for a change is "does it make riding the cursor better", not "would it be nice to have".

## Running it

```sh
npm ci
npm test                  # the geometry: place() is pure, no browser needed
npx playwright install chromium
npm run test:e2e          # the DOM: a real Chromium, what a cursor and a finger actually do
npm run build             # dist/ for the script-tag build
npm run types             # index.d.ts from the JSDoc; commit the result
```

The demo and the docs are plain HTML that import `index.js` off disk. `python3 -m http.server` in the repo root and open `/`.

## What's welcome

- Bug reports with a reduced case. A page and a cursor path that shows it is worth more than a description.
- Fixes with a test. If it's geometry, it goes in `test/place.test.js`. If it's wiring, in `e2e/tooltip.spec.js`.
- Docs that were wrong.

## What isn't

Arrows, interactive tooltips, nesting, and element-anchored placement on desktop. [Floating UI](https://floating-ui.com/) does all of that well, and this library stays out of its way on purpose.

Anything visual is a CSS custom property, never a JavaScript option. If a change needs a new option, say why a property can't do it.

## Commits and releases

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`. That's not ceremony, it's what writes the changelog. [release-please](https://github.com/googleapis/release-please) opens a release PR from those commits; merging it tags the commit, publishes the GitHub Release, and publishes that exact commit to npm with provenance. Nobody publishes by hand.

Keep `index.d.ts` in sync (`npm run types`), and keep the size honest: the number in the README is the minified ESM build gzipped.
