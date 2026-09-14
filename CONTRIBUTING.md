# Contributing

Thanks for looking. This is a small library with one job, so the bar for a change is "does it make riding the cursor better", not "would it be nice to have". Everything below is how to get a change from your editor to npm without surprises.

## The lay of the land

```
index.js            the library: one file, ~600 lines, heavily commented
index.d.ts          types, generated from the JSDoc in index.js - never edited by hand
auto.js             the script-tag entry: re-exports index.js and initialises it
build.mjs           esbuild: dist/tooltip.global.js (IIFE) and dist/tooltip.css
test/place.test.js  the geometry suite, node:test, no browser
e2e/tooltip.spec.js the DOM suite, Playwright, real Chromium
index.html          the demo page, imports ./index.js off disk
docs/index.html     the reference, same
llms.txt            the reference again, in one file, for models
og.html / og.png    the social card, and the page it is screenshotted from
```

`index.js` splits in two. `place()` is a pure function of numbers: cursor, pill size, viewport, previous placement in, coordinates and sides out. It has no DOM and no globals, which is why the geometry suite runs with nothing installed and covers thousands of cases in a quarter of a second. Everything else in the file is event plumbing around it: `createTooltip()` wires listeners, measures once per show, and writes one transform per frame.

There are no runtime dependencies and there will not be any. Four devDependencies: esbuild, TypeScript (for the types only), publint, Playwright.

## Setting up

```sh
git clone https://github.com/extramoose/tooltip
cd tooltip
npm ci
npx playwright install chromium     # once, for the DOM suite
```

To see the demo and the docs, serve the repo root and open `/` or `/docs/`:

```sh
python3 -m http.server 8000
```

No build step is needed for that. Both pages import `index.js` directly, so what you see is the source you just edited.

## Running the checks

```sh
npm test              # geometry, node:test, ~0.3s
npm run test:e2e      # DOM, Playwright, ~10s
npm run build         # dist/, needed before publint and by the e2e suite's CSS check
npm run types         # regenerates index.d.ts; CI fails if the committed one differs
npx publint           # package.json and exports sanity
```

CI runs exactly those, in that order, on every push and PR. Run them locally first; the DOM suite in particular is faster to iterate on than to wait for.

## Making a change

1. Branch from `main`.
2. Make the change in `index.js`. If it touches geometry, it goes in `place()` and gets a case in `test/place.test.js`. If it touches wiring, it gets a case in `e2e/tooltip.spec.js`. A fix without a test that would have caught it is not finished.
3. If you changed any JSDoc, run `npm run types` and commit `index.d.ts` with it.
4. If you added or renamed an option, attribute, or `--tip-*` property, update all three references: the README, `docs/index.html`, and `llms.txt`. They are cross-checked by hand before a release and drift is treated as a bug. The docs page reads the property list out of the CSS at load, so a new property shows up there on its own, but it still needs a description in the `WHAT` map in that file.
5. Check the size. The number in the README is the minified ESM build, gzipped:
   ```sh
   node -e "const e=require('esbuild'),z=require('zlib');e.build({entryPoints:['index.js'],bundle:true,format:'esm',minify:true,write:false}).then(r=>console.log(z.gzipSync(r.outputFiles[0].contents,{level:9}).length))"
   ```
   If your change moves it past the next tenth of a kilobyte, say so in the PR and update the number everywhere it appears (README, package.json description, both HTML pages, `llms.txt`, `og.html`, and regenerate `og.png` with the command in its header).
6. Open a PR against `main`. Describe what changed and why, and what a reviewer should try with a cursor to see it.

## What's welcome

- Bug reports with a reduced case. A page and a cursor path that shows it is worth more than a description. If you can express it as a `place()` call with numbers, better still.
- Fixes with a test.
- Docs that were wrong, unclear, or missing the thing you needed.
- Accessibility findings. The pill is wired with `aria-describedby`, shows on `:focus-visible`, and dismisses on `Escape`; if a screen reader or a keyboard path is worse than that, that's a bug.

## What isn't

Arrows, interactive tooltips, nesting, and element-anchored placement on desktop. [Floating UI](https://floating-ui.com/) does all of that well, and this library stays out of its way on purpose. A PR adding one of these will be closed with thanks.

Anything visual is a CSS custom property, never a JavaScript option. If a change needs a new option, the PR should say why a property can't do it.

New options, attributes, and properties are also a documentation cost times three, so they need to earn it.

## Style

- Plain JavaScript, ES2020, no transpiling. The source is what ships.
- Comments explain *why*. The file has a lot of them and that is on purpose: the reasoning behind the hysteresis, the arm-then-show trick, and the touch handling is the part that is hard to rediscover.
- Regular hyphens in prose and comments, no em or en dashes.
- The docs and README are written in the first person and read like a person wrote them. Match the register.

## Commits and releases

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: long press shows the pill above the finger
fix: a remembered center no longer sticks to the next trigger
docs: say what the overflow demo does
test: cover show() against a focused trigger
ci: pin the action SHAs
chore: bump devDependencies
```

That's not ceremony. `feat` and `fix` are what move the version, and the changelog is written from them. A `feat!:` or a `BREAKING CHANGE:` footer is a major.

Releases are automated and nobody publishes by hand:

1. A `feat:` or `fix:` lands on `main`.
2. [release-please](https://github.com/googleapis/release-please) opens, or updates, a release PR with the version bump and the `CHANGELOG.md` entry.
3. A maintainer merges it. That tags the commit and publishes a GitHub Release, which is immutable.
4. The same workflow publishes that exact commit to npm with provenance, through npm's trusted publishing. No token exists anywhere in this repo.

If you are a maintainer cutting a release, that is the whole procedure: merge the PR release-please opened.

## Security

Vulnerabilities go through [SECURITY.md](SECURITY.md), not the issue tracker.

## Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
