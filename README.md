# @extramoose/tooltip [![npm](https://img.shields.io/npm/v/@extramoose/tooltip.svg)](https://www.npmjs.com/package/@extramoose/tooltip) [![CI](https://github.com/extramoose/tooltip/actions/workflows/ci.yml/badge.svg)](https://github.com/extramoose/tooltip/actions) [![size](https://img.shields.io/bundlephobia/minzip/@extramoose/tooltip.svg)](https://bundlephobia.com/package/@extramoose/tooltip)

A tooltip that rides the cursor. It follows the pointer, and when it runs out of room it flips to the other side rather than hanging off the edge. No dependencies, 4.8 kB of vanilla JS.

[Demo](https://tooltip.hah.to/) · [Docs](https://tooltip.hah.to/docs/)

## Install

```sh
npm i @extramoose/tooltip
```

```html
<script src="https://cdn.jsdelivr.net/npm/@extramoose/tooltip@1"></script>
```

## Usage

One script tag and it runs. There's nothing to import.

```html
<script src="https://cdn.jsdelivr.net/npm/@extramoose/tooltip@1"></script>
<span data-tip="Rides the cursor">hover me</span>
```

Options ride on the tag itself: `data-selector`, `data-touch`, `data-delay`, `data-theme`, `data-boundary`. The instance it makes is `Tooltip.tip`, so `Tooltip.tip.hide()` works.

```html
<script src="https://cdn.jsdelivr.net/npm/@extramoose/tooltip@1" data-touch="press"></script>
```

`@1` floats to the newest 1.x. To audit once and pin, use the exact version with an integrity hash (this is 1.0.1; any version's hash is `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`):

```html
<script
  src="https://cdn.jsdelivr.net/npm/@extramoose/tooltip@1.0.1/dist/tooltip.global.js"
  integrity="sha384-O31yeI3XmXgNT9WOeIPoBs5uqbcD2o5Fof+C+uC+PFpYaVEn0XmdCJAJ856l+F/i"
  crossorigin="anonymous"></script>
```

Or call it yourself.

```js
import createTooltip from '@extramoose/tooltip';

const tip = createTooltip();
tip.destroy();
```

Events are delegated from the root, so anything you add to the DOM later picks it up without a re-init.

## Attributes

| Attribute | |
| --- | --- |
| `data-tip` | The text. Required, unless `data-tip-overflow` is doing the talking. |
| `data-tip-key` | A shortcut, rendered as a `<kbd>` chip after the text. Plain text. |
| `data-tip-pos` | `left` (default), `right`, `center`. Which side of the cursor. |
| `data-tip-overflow` | Show only when the element is actually clipped. |
| `data-tip-theme` | Style this one differently. You write the CSS. |

```html
<button data-tip="Save the draft" data-tip-key="⌘S">Save</button>
<td class="truncate" data-tip-overflow>content-security-policy-report-only</td>
```

The chip is tinted from the pill's own text color with `color-mix`, so it lands right on a light page and a dark one. `--tip-key-bg` overrides it.

`data-tip-overflow` gates on `scrollWidth > clientWidth`, so the pill shows up exactly when the text is cut off and stays out of the way when it isn't. The words come from `data-tip` if there is one, otherwise from the element itself. That's the truncated table cell.

## Options

| Option | Default | |
| --- | --- | --- |
| `selector` | `'[data-tip],[data-tip-overflow]'` | Trigger selector. |
| `root` | `document` | Delegation root. |
| `offset` | `{ x: 10, y: 16 }` | Gap from the cursor, in px. |
| `delay` | `150` | ms a cold hover waits before the pill shows. |
| `touch` | long press, except on links | `'press'` for links too, `'tap'` for tap-to-toggle, `'off'` for nothing. |
| `theme` | - | Default theme name. A trigger's own attribute wins. |
| `boundary` | viewport | Element or selector to clamp inside. |
| `injectStyles` | `true` | `false` to ship the CSS yourself. |

Returns `{ hide(), show(el), destroy() }`. `hide()` also cancels a pending delay, or a press in progress. `show(el)` raises the pill anchored to an element the way a tap would, which is how a "Copied!" gets on screen on a phone; if that element's pill is already up it does nothing, so just change its `data-tip`.

```js
createTooltip({ delay: 120 });
```

A cold hover waits that long, and the cursor keeps being tracked while it does, so the pill lands under the pointer rather than where it came in. Walking from one trigger straight onto the next is never delayed, and coming back to anything within `delay` of leaving is instant too. Focus doesn't wait at all.

## Styling

There's one theme, and it reads the page and goes light or dark on its own, so it lands right without you setting anything. If your page has its own light/dark switch, set `data-theme="light"` or `"dark"` on `<html>` and the tooltip follows it instead of the OS.

It springs up out of the corner nearest your cursor and collapses back into the same one on the way out. Walk straight from one trigger onto the next and it stays up and changes what it says instead of blinking out and back. Transform and opacity only, so it costs the same whether the pill is two words or twenty. `--tip-transition` is the whole motion if you want your own.

If you want it different, override the properties. Nothing visual is a JavaScript option.

```css
:root {
  --tip-bg: #1d1f24;
  --tip-radius: 10px;
}
```

`data-tip-theme` moves one trigger instead of all of them. The library copies the name onto the pill and styles nothing itself; `theme` sets the same name for a whole instance.

```css
[data-tip-theme="danger"] {
  --tip-bg: #b3261e;
  --tip-color: #fff;
}
```

The full set:

`--tip-bg` `--tip-color` `--tip-border` `--tip-radius` `--tip-padding` `--tip-shadow` `--tip-font-family` `--tip-font-size` `--tip-font-weight` `--tip-letter-spacing` `--tip-line-height` `--tip-max-width` `--tip-z` `--tip-scale` `--tip-transition` `--tip-offset-x` `--tip-offset-y` `--tip-margin` `--tip-key-bg`

The script reads the two offsets and the margin back out, so those three want plain `px` values.

Styles inject on the first `createTooltip()` call rather than at import, so importing `place` on its own touches nothing. If your CSP has a `style-src` without `'unsafe-inline'`, pass `injectStyles: false` and ship `@extramoose/tooltip/tooltip.css` yourself.

## Boundaries

By default the pill clamps to the window. Point `boundary` at an element and it clamps inside that instead.

```js
createTooltip({ root: panel, boundary: panel });
```

That's the one you want for a modal or a scroll container. The box gets re-read every frame, so it holds up if the thing scrolls.

## Accessibility

It shows on keyboard focus, not just hover, and `Escape` dismisses it.

`data-tip` is a description, not a name, which means an icon-only button still needs a label of its own.

```html
<!-- wrong -->
<button data-tip="Copy"><svg …></svg></button>

<!-- right -->
<button aria-label="Copy" data-tip="Copy to clipboard"><svg …></svg></button>
```

If the trigger already had an `aria-describedby`, it's kept and put back on hide. I'm not claiming WCAG conformance, just these behaviors.

## Reduced motion

`prefers-reduced-motion: reduce` turns the transition off and skips the exit entirely, though it still follows the cursor. Following is the component, not decoration on top of it.

## Touch

There's no cursor on touch, so the default is a long press. Hold a finger on a trigger for 400 ms and a pill appears above it, centred, because your hand is covering everything below. Let go and it stays up. A tap anywhere else, or any scroll, takes it down; tapping the trigger itself dismisses it and that tap goes through. The click the browser fires when the pressing finger lifts is swallowed, because you asked what the button does, not for it to do it. Move more than 10 px during the hold and it's a scroll, so nothing shows. A plain tap is never touched.

Links are the exception. A long press on a link is also how iOS previews it, so by default links keep theirs and their text sits in the DOM wired up with `aria-describedby` instead. `touch: 'press'` takes the long press on links too.

`touch: 'tap'` is the blunter one: first tap shows, second dismisses and lets the link or the button run. It costs you the first click on every trigger, and press costs you nothing.

Both put the pill above the element and flip it below only when there's no room up there. Keyboard focus still sits below, where nothing is in the way.

`touch: 'off'` does nothing on touch at all, and wires every trigger's text up with `aria-describedby` so nobody loses it.

Detection is `(hover: hover) and (pointer: fine)`, re-checked when the input changes, so an iPad that picks up a trackpad mid-session sorts itself out.

## Details

Change `data-tip` or `data-tip-key` on the trigger while its pill is up and the pill re-fills and re-places itself, so "Copy" can become "Copied" without anything blinking. It's a MutationObserver, pointed at the active trigger and nothing else.

Alt-tab away or switch tabs and the pill goes too. `blur` on the window and a `visibilitychange` to hidden both dismiss it, so nothing gets left stranded on a page you aren't looking at.

Point the selector at `title` and the first hover moves that `title` into `data-tip` and removes it, so the browser's own tooltip never gets its turn.

```js
createTooltip({ selector: '[data-tip], [title]' });
```

That isn't the default. It would turn every `title` on the page into a pill, including the ones you left there for other reasons.

A `<button disabled data-tip>` raises the pill in Chromium, which has fired mouse events on disabled form controls since 116. Firefox and Safari have historically swallowed those events and I haven't checked either, so if you need it everywhere, hang `data-tip` on a wrapping `<span>` instead.

## How it works

`place()` is a pure function of numbers. No DOM, no globals.

```js
place(cx, cy, w, h, vw, vh, prev, opts) -> { x, y, side, vside, origin }
```

Flip first, then clamp. The flip is deliberately asymmetric: bailing off a side that doesn't fit is cheap, but coming back costs a third of the pill's own size in spare room, and that gap is what stops a cursor dragged along an edge from making it ping-pong.

It measures once per show, and every frame after that is a write.

Since `place()` is pure, all the geometry gets unit-tested without a browser anywhere near it.

## Prior art

For most tooltips [Floating UI](https://floating-ui.com/) and [tippy.js](https://atomiks.github.io/tippyjs/) are the better answer, and I'd point you at them for element anchoring, arrows, interactive content or nesting. This one does a single placement problem and has no opinion about the rest.

`popover="hint"` and `interestfor` are coming, but they're Chrome and Edge only right now.

CSS anchor positioning went Baseline this year and still can't help, because a tooltip that rides the cursor has no anchor element to hang off. The anchor is the pointer.

## License

MIT. Issues and PRs welcome, see [CONTRIBUTING.md](CONTRIBUTING.md); vulnerabilities go through [SECURITY.md](SECURITY.md), not the issue tracker. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/); [release-please](https://github.com/googleapis/release-please) turns them into the [changelog](CHANGELOG.md) and the releases, and every release is published to npm from GitHub with provenance.
