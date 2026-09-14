# Changelog

Entries from 1.0.2 on are written by release-please from the commit history.

## [1.0.2](https://github.com/extramoose/tooltip/compare/v1.0.1...v1.0.2) (2026-09-14)


### Docs

* a fuller CONTRIBUTING.md, and the Contributor Covenant 3.0 ([725505a](https://github.com/extramoose/tooltip/commit/725505a0b251eeb93fdeb2b7263d5d2cc416dbf5))
* a pinned, integrity-checked script tag; cookieless analytics on the site ([#4](https://github.com/extramoose/tooltip/issues/4)) ([3a04205](https://github.com/extramoose/tooltip/commit/3a04205de9cc451ad832422666c7a3bbc985ebfc))
* CONTRIBUTING.md and SECURITY.md ([c92c983](https://github.com/extramoose/tooltip/commit/c92c983a2cab1766cea01a4fd00f5b422d3674aa))

## 1.0.1 (2026-09-14)

### Features

* `show(el)` on the handle: raise the pill anchored to an element by hand, the way a tap would. For a "Copied!" on a phone, where nothing else would raise it.

### Docs

* Icon copy buttons on the site answer through the tooltip itself.

## 1.0.0 (2026-09-13)

First release. A tooltip that rides the cursor: follows the pointer, flips before it runs off the edge, and stays out of the way.

* Cursor-following placement with asymmetric hysteresis at the edges, so a cursor dragged along an edge can't make it ping-pong. `place()` is pure and unit-tested.
* Springs out of the corner nearest the cursor and collapses back into it on the way out. Walking from one trigger to the next keeps the pill up and swaps the text.
* Keyboard focus and `Escape`. `aria-describedby` wiring, preserved and restored. Reduced motion honoured.
* Long press on touch, above the finger; a plain tap is never touched. Links keep their own long press by default.
* `delay` for cold hovers, with an instant warm window.
* `data-tip-key` shortcut chips, `data-tip-overflow` for clipped cells, native `title` lift, live text updates, dismissal on blur and hidden tabs.
* One theme that reads the page, nineteen custom properties, `injectStyles: false` for strict CSPs.
* Script-tag build with options on the tag. 4.8 kB gzipped, no dependencies.
