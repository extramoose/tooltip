/**
 * @extramoose/tooltip - the tooltip that rides the cursor.
 *
 * One pill per instance follows the pointer, flips off the viewport edges and
 * clamps itself inside them. The geometry lives in `place()`, a pure function
 * of numbers; everything else is event plumbing. Anything visual is a CSS
 * custom property, so the look is a stylesheet, not an option.
 *
 * Accessibility note for anyone extending this: `data-tip` is a *description*,
 * not a name. It is wired with `aria-describedby`, which supplements the
 * trigger's accessible name - it never supplies one. An icon-only trigger still
 * needs its own `aria-label`.
 *
 * @module @extramoose/tooltip
 */

const CLASS = 'hah-tip';
const STYLE_ID = 'hah-tip-styles';

/** A device that can actually hover a cursor. Capability, never a UA string. */
const POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/**
 * Anti-thrash. `BAND` is the slack required before a *visible* tooltip changes
 * its mind at all; `RETURN_BAND` is the extra slack, as a fraction of the pill's
 * own size, required to flip back to the side it started on. The asymmetry is
 * the point: leaving a side that genuinely does not fit is cheap, coming back is
 * expensive, so a cursor tracing a viewport edge cannot ping-pong. A symmetric
 * threshold still oscillates once the cursor sits exactly on the boundary.
 */
const BAND = 12;
const RETURN_BAND = 1 / 3;

/** Fallbacks for the three geometry vars, used only if a value is unreadable. */
const GEOM = { ox: 10, oy: 16, m: 8 };

/**
 * The stylesheet, exported so the build can emit `dist/tooltip.css` from the
 * same string the script injects. Single source of truth.
 *
 * Theming contract - every one of these is yours to override from your own
 * stylesheet, on `:root` or on `[data-tip-theme="…"]`. Not on a wrapper of
 * your own: the pill is appended to `document.body`, so an element that wraps
 * the *trigger* is not an ancestor of the *pill* and nothing inherits down
 * from it. Per-tooltip styling goes through `data-tip-theme`, which is copied
 * from the trigger onto the pill on show:
 *
 *   --tip-bg --tip-color --tip-border --tip-radius --tip-padding --tip-shadow
 *   --tip-font-family --tip-font-size --tip-font-weight --tip-letter-spacing
 *   --tip-line-height --tip-max-width --tip-z --tip-scale --tip-transition
 *   --tip-offset-x --tip-offset-y --tip-margin --tip-key-bg
 *
 * The offsets and the margin are read back by the script, so give those plain
 * px values.
 *
 * @type {string}
 */
export const css = `
.${CLASS}{
  --_tip-fill: var(--tip-bg, #14151a);
  --_tip-x: var(--tip-offset-x, 10px);
  --_tip-y: var(--tip-offset-y, 16px);
  --_tip-m: var(--tip-margin, 8px);
  position: fixed; left: 0; top: 0; z-index: var(--tip-z, 9999);
  box-sizing: border-box; margin: 0; padding: 0; border: 0;
  pointer-events: none;
  width: max-content; max-width: var(--tip-max-width, min(320px, 72vw));
  transform: translate3d(0, 0, 0); will-change: transform;
}
.${CLASS}__pill{
  box-sizing: border-box; display: block;
  background: var(--_tip-fill);
  color: var(--tip-color, #fff);
  border: var(--tip-border, 0);
  border-radius: var(--tip-radius, 18px);
  padding: var(--tip-padding, 10px 16px);
  box-shadow: var(--tip-shadow, 0 4px 14px rgb(16 18 24 / .13));
  font-family: var(--tip-font-family, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  font-size: var(--tip-font-size, .88rem);
  font-weight: var(--tip-font-weight, 600);
  font-style: normal;
  letter-spacing: var(--tip-letter-spacing, .01em);
  line-height: var(--tip-line-height, 1.45);
  text-align: start; text-transform: none; text-indent: 0;
  white-space: normal; overflow-wrap: break-word;
  opacity: 0;
  transform: scale(var(--tip-scale, .85));
  transform-origin: top right;
  transition: var(--tip-transition, opacity .16s ease, transform .18s cubic-bezier(.3, 1.5, .5, 1));
}
.${CLASS}[data-tip-show] .${CLASS}__pill{ opacity: 1; transform: none; }

/* The shortcut chip, from data-tip-key. Tinted from the pill's own text
   colour so it lands right on either scheme and on any --tip-bg. */
.${CLASS}__key{
  display: inline-block; vertical-align: baseline;
  margin-left: .3em; padding: .02em .38em; border-radius: .35em;
  background: var(--tip-key-bg, color-mix(in srgb, currentColor 16%, transparent));
  font-size: .86em; font-weight: 500; letter-spacing: .02em; line-height: 1.5;
}
/* While a finger is held on a trigger: no selection, no link callout. */
[data-tip-press]{ -webkit-user-select: none; user-select: none; -webkit-touch-callout: none }

/* Leaving: it collapses back into the corner it sprang out of, which is the
   corner nearest the cursor - the script already resolved that for the enter
   spring, so the exit costs no new math. Transform and opacity only, so it is
   the same cheap two-property animation whether the pill is small or wide. */
.${CLASS}[data-tip-out] .${CLASS}__pill{
  opacity: 0;
  transform: scale(.52);
  transition: opacity .13s ease-in, transform .15s cubic-bezier(.55, 0, .85, .35);
}
@media (prefers-reduced-motion: reduce){
  .${CLASS}__pill,
  .${CLASS}[data-tip-out] .${CLASS}__pill{ transition: none }
}

/* Armed: the from-state is parked with no transition, so the enter always
   starts from the same place instead of from wherever the last one left off. */
.${CLASS}[data-tip-arm] .${CLASS}__pill{ transition: none; }

/* Dark, two ways. The media query is the default; [data-theme] on the root
   lets a page that has its own light/dark switch carry the tooltip with it.
   Without the second form, a page whose toggle disagrees with the OS renders a
   white pill on a white background. */
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .${CLASS}{ --_tip-fill: var(--tip-bg, #fff) }
  :root:not([data-theme="light"]) .${CLASS}__pill{
    color: var(--tip-color, #14151a);
    box-shadow: var(--tip-shadow, 0 6px 20px rgb(0 0 0 / .45));
  }
}
:root[data-theme="dark"] .${CLASS}{ --_tip-fill: var(--tip-bg, #fff) }
:root[data-theme="dark"] .${CLASS}__pill{
  color: var(--tip-color, #14151a);
  box-shadow: var(--tip-shadow, 0 6px 20px rgb(0 0 0 / .45));
}
`;

/* ------------------------------------------------------------------ geometry */

/** How long a finger has to hold before it is asking, not tapping. */
const PRESS = 400;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const num = (v, fallback) => (typeof v === 'number' && isFinite(v) ? v : fallback);

/**
 * Clearance to the nearer edge of the margin box. Negative means it overflows.
 * `lo`/`hi` are the boundary's own edges, so the box does not have to start at
 * zero - that is what lets a tooltip clamp inside a panel instead of the window.
 */
const fit = (start, size, lo, hi, m) =>
  Math.min(start - lo - m, hi - m - start - size);

/**
 * Choose between the current side `cur` and its opposite `alt`, one of which is
 * the `preferred` one the markup asked for.
 *
 * Leaving the preferred side is cheap: one pixel of overflow does it, plus
 * `BAND` of slack so a cursor resting exactly on the edge cannot rattle.
 * Coming back is expensive: the preferred side has to have earned `RETURN_BAND`
 * of the pill's own extent in spare room first. That asymmetry is what kills
 * the oscillation - a symmetric threshold still flips twice per crossing.
 *
 * `BAND` is deliberately smaller than the default `--tip-offset-y`, so the
 * overflow tolerated before a flip can never be enough to drag the pill onto
 * the cursor it belongs to.
 */
function decide(cur, alt, preferred, fitCur, fitAlt, extent, fresh) {
  if (fresh) return fitCur < 0 && fitAlt > fitCur ? alt : cur;
  if (cur === preferred) return fitCur < 0 && fitAlt > fitCur + BAND ? alt : cur;
  // Coming back to the preferred side: normally it must have earned
  // RETURN_BAND of spare room. The second clause is the escape hatch - the
  // side we are sitting on is itself overflowing, so staying is not "sticky",
  // it is stuck. Without it a pill that flipped above a cursor near the top of
  // the viewport stays pinned flat against the margin while the whole page
  // sits empty below it, and a fresh show of the same geometry disagrees.
  // It cannot reintroduce oscillation: arriving here at all required
  // fitAlt > fitCur + BAND, so the mirrored condition is unsatisfiable next call.
  return fitAlt >= extent * RETURN_BAND || (fitCur < 0 && fitAlt > fitCur + BAND)
    ? alt
    : cur;
}

const xAt = (side, a, w, ox) =>
  side === 'center' ? (a.left + a.right) / 2 - w / 2
  : side === 'right' ? a.right + ox
  : a.left - w - ox;

const yAt = (vside, a, h, oy) =>
  vside === 'above' ? a.top - h - oy : a.bottom + oy;

/**
 * Resolve one placement. Pure - numbers in, numbers out, no DOM, no globals.
 *
 * The cursor is modelled as a zero-size rect, so the cursor path and the
 * element-anchored path (focus, tap) run through the same solver: pass a real
 * box as `opts.anchor` and `cx`/`cy` are ignored.
 *
 * Order is flip, then clamp: `decide` settles each axis against the viewport
 * (with the deadband that keeps a moving cursor from oscillating), then the
 * clamp guarantees the pill ends up fully inside whatever the flip chose.
 * Nothing about the pill's previous *position* is an input - only the side it
 * settled on - so a resolved position can never feed back into the next one.
 *
 * @param {number} cx Cursor x, viewport coordinates.
 * @param {number} cy Cursor y, viewport coordinates.
 * @param {number} w  Pill width.
 * @param {number} h  Pill height.
 * @param {number} vw Viewport width.
 * @param {number} vh Viewport height.
 * @param {?(Placement|string)} [prev] The previous result (or just its `side`)
 *   to stay sticky against; null/omitted means a fresh show, decided freely.
 * @param {{align?:'left'|'right'|'center', vside?:'below'|'above',
 *          ox?:number, oy?:number, m?:number,
 *          anchor?:?{left:number,top:number,right:number,bottom:number},
 *          bounds?:?{left:number,top:number,right:number,bottom:number}}} [opts]
 *   `vside` is the vertical side to prefer: below the anchor unless told
 *   otherwise. A finger wants the pill above, since the hand is below.
 * @returns {Placement}
 */
export function place(cx, cy, w, h, vw, vh, prev, opts) {
  const o = opts || {};
  const align = o.align === 'right' || o.align === 'center' ? o.align : 'left';
  const vpref = o.vside === 'above' ? 'above' : 'below';
  const ox = num(o.ox, GEOM.ox);
  const oy = num(o.oy, GEOM.oy);
  const m = num(o.m, GEOM.m);
  const a = o.anchor || { left: cx, right: cx, top: cy, bottom: cy };
  // The box the pill must stay inside. Defaults to the viewport, which is what
  // vw/vh describe; pass a rect to clamp inside a panel, a modal or a demo
  // frame instead. Everything below works off b, never off vw/vh directly.
  const b = o.bounds || { left: 0, top: 0, right: vw, bottom: vh };

  const fresh = !prev;
  const was = typeof prev === 'string' ? prev : prev && prev.side;
  // "center" is a mode, not a side, so it is decided by `align` alone and a
  // remembered one must never leak into a trigger that asked for left or right.
  // It used to: the remembered side was taken as-is, and the flip below skips
  // anything already centered, so once a pill had been centered it stayed
  // centered for every trigger after it.
  let side = align === 'center' ? 'center'
    : was === 'left' || was === 'right' ? was : align;
  let vside = (prev && prev.vside) || vpref;

  if (side !== 'center') {
    const alt = side === 'left' ? 'right' : 'left';
    side = decide(side, alt, align, fit(xAt(side, a, w, ox), w, b.left, b.right, m),
                  fit(xAt(alt, a, w, ox), w, b.left, b.right, m), w, fresh);
  }

  const altV = vside === 'below' ? 'above' : 'below';
  vside = decide(vside, altV, vpref, fit(yAt(vside, a, h, oy), h, b.top, b.bottom, m),
                 fit(yAt(altV, a, h, oy), h, b.top, b.bottom, m), h, fresh);

  return {
    // Integer pixels: a fractional translate resamples the text every frame and
    // the pill shimmers while it follows.
    x: Math.round(clamp(xAt(side, a, w, ox), b.left + m, Math.max(b.left + m, b.right - w - m))),
    y: Math.round(clamp(yAt(vside, a, h, oy), b.top + m, Math.max(b.top + m, b.bottom - h - m))),
    side,
    vside,
    // The pill springs out of the corner nearest the anchor, so the origin
    // follows the resolved sides rather than staying at the default top right.
    origin: (vside === 'below' ? 'top ' : 'bottom ') +
            (side === 'left' ? 'right' : side === 'right' ? 'left' : 'center'),
  };
}

/* ----------------------------------------------------------------- instance */

let uid = 0;
const nextId = () => {
  let id;
  do { id = CLASS + '-' + ++uid; } while (document.getElementById(id));
  return id;
};

/** Idempotent, and only ever from `createTooltip` - importing injects nothing. */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}

/** A set of listeners that binds and unbinds as a unit, so nothing can leak. */
function group() {
  const items = [];
  let on = false;
  return {
    add(target, type, fn, opts) {
      items.push([target, type, fn, opts]);
      if (on && target) target.addEventListener(type, fn, opts);
    },
    bind() {
      if (on) return;
      on = true;
      for (const [t, ty, fn, o] of items) if (t) t.addEventListener(ty, fn, o);
    },
    unbind() {
      if (!on) return;
      on = false;
      for (const [t, ty, fn, o] of items) if (t) t.removeEventListener(ty, fn, o);
    },
  };
}

const px = (style, name, fallback) => {
  const v = parseFloat(style.getPropertyValue(name));
  return isFinite(v) ? v : fallback;
};

/**
 * @typedef {Object} Placement
 * @property {number} x
 * @property {number} y
 * @property {'left'|'right'|'center'} side
 * @property {'below'|'above'} vside
 * @property {string} origin
 */

/**
 * @typedef {Object} TooltipOptions
 * @property {string} [selector='[data-tip],[data-tip-overflow]'] Trigger selector. Events are
 *   delegated, so triggers added to the DOM later work with no re-init.
 * @property {Document|Element} [root=document] Delegation root.
 * @property {{x?:number, y?:number}} [offset] Gap from the cursor, in px.
 *   Sets `--tip-offset-x` / `--tip-offset-y` on the pill.
 * @property {number} [delay=150] Milliseconds a cold hover waits before the
 *   pill shows. Walking from one trigger straight onto the next, or coming
 *   back within `delay` of leaving, is never delayed. Focus never is either.
 * @property {'off'|'tap'|'press'} [touch] What a device with no cursor gets.
 *   By default a long press shows an element-anchored pill on anything that
 *   is not a link, and links keep their own long press (iOS previews them).
 *   `'press'` is that on links too; `'tap'` toggles the pill on tap and
 *   swallows the first click; `'off'` shows nothing and leaves the text to
 *   `aria-describedby`.
 * @property {string} [theme] Sets `data-tip-theme` on the pill. A trigger's own
 *   `data-tip-theme` wins over it.
 * @property {Element|string} [boundary] Clamp the pill inside this element's box
 *   instead of the window - a panel, a modal, a demo frame. Accepts an element
 *   or a selector. Defaults to the viewport.
 * @property {boolean} [injectStyles=true] Set false to ship the CSS yourself
 *   (strict `style-src` with no `'unsafe-inline'`).
 */

/**
 * @typedef {Object} TooltipHandle
 * @property {() => void} hide Dismiss whatever is showing.
 * @property {(trigger: Element) => void} show Show the pill anchored to
 *   `trigger`, the way a tap would, until `hide()`, a tap elsewhere or a
 *   scroll. For the "Copied!" after a tap, where nothing else would raise
 *   it. A no-op when that trigger's pill is already up: change its
 *   `data-tip` instead and the pill follows.
 * @property {() => void} destroy Remove every listener and the pill itself.
 */

/**
 * Create a tooltip instance.
 *
 * @param {TooltipOptions} [options]
 * @returns {TooltipHandle}
 */
export function createTooltip(options) {
  const opt = options || {};
  const selector = opt.selector || '[data-tip],[data-tip-overflow]';
  const root = opt.root || document;
  // A long press is what iOS and Android already mean by "what does this
  // do", and it costs the tap nothing, so it is on by default - except on
  // links, where the long press is already taken (iOS previews them), so
  // those keep theirs and the text reaches a screen reader through
  // aria-describedby instead. 'press' overrides that; 'tap' and 'off' are
  // the other two answers.
  const touch = opt.touch === 'tap' || opt.touch === 'press' || opt.touch === 'off' ? opt.touch : 'auto';
  const skip = (t) => touch === 'auto' && t.matches('a[href]');
  const delay = opt.delay == null ? 150 : Math.max(0, +opt.delay || 0);

  if (opt.injectStyles !== false) injectStyles();

  const el = document.createElement('div');
  const pill = document.createElement('div');
  el.className = CLASS;
  el.id = nextId();
  el.setAttribute('role', 'tooltip');
  el.setAttribute('aria-hidden', 'true');
  pill.className = CLASS + '__pill';
  el.appendChild(pill);
  const bounds = typeof opt.boundary === 'string'
    ? document.querySelector(opt.boundary)
    : opt.boundary || null;
  if (opt.theme) el.setAttribute('data-tip-theme', opt.theme);
  if (opt.offset) {
    if (opt.offset.x != null) el.style.setProperty('--tip-offset-x', opt.offset.x + 'px');
    if (opt.offset.y != null) el.style.setProperty('--tip-offset-y', opt.offset.y + 'px');
  }
  (document.body || document.documentElement).appendChild(el);

  /** @type {?Element} */ let active = null;
  let mode = 'pointer';              // 'pointer' | 'focus' | 'tap'
  let align = 'left';
  let prev = null;                   // last Placement, for sticky sides
  let cx = 0, cy = 0;                // last cursor position
  let w = 0, h = 0;                  // pill size, measured once per show
  let geom = GEOM;                   // offsets read back from CSS
  let origin = '';
  let outTimer = 0;
  let described = null;              // trigger's own aria-describedby, restored on hide
  let frame = 0;
  let pending = null;                // trigger waiting out `delay`
  let delayTimer = 0;
  let warmUntil = 0;                 // a hover before this is instant again
  let pressing = null;               // trigger under a finger, with its timer
  let pressTimer = 0;
  let pressX = 0, pressY = 0;
  let held = null;                   // trigger a long press just showed; its click is ours
  // Live text: a trigger that changes its data-tip while the pill is up
  // ("Copy" to "Copied") re-fills in place. One observer, re-pointed per show.
  const watch = typeof MutationObserver === 'function' ? new MutationObserver(refresh) : null;

  const triggerAt = (node) => {
    const t = node && node.closest ? node.closest(selector) : null;
    return t && root.contains(t) ? t : null;
  };

  /**
   * What this trigger has to say, if anything. A native `title` is lifted
   * into data-tip the first time it is seen, so the browser's own tooltip
   * never gets its second in - that is what makes `selector: '[title]'`
   * work. `data-tip-overflow` gates on the element actually being clipped,
   * and falls back to the element's own text: the truncated-cell case.
   */
  function textFor(t) {
    let text = t.getAttribute('data-tip');
    if (text === null) {
      text = t.getAttribute('title');
      if (text) { t.setAttribute('data-tip', text); t.removeAttribute('title'); }
    }
    if (t.hasAttribute('data-tip-overflow')) {
      if (t.scrollWidth <= t.clientWidth) return '';
      text = text || t.textContent.trim();
    }
    return text || '';
  }

  /** Fill the pill from the trigger. False means there is nothing to show. */
  function fill(t) {
    const text = textFor(t);
    if (!text) return false;
    pill.textContent = text;         // textContent, never innerHTML
    const key = t.getAttribute('data-tip-key');
    if (key) {
      const k = document.createElement('kbd');
      k.className = CLASS + '__key';
      k.textContent = key;
      pill.append('\u00a0', k);      // a space for the screen reader, one that
                                     // never leaves the chip alone on a line
    }
    return true;
  }

  /* -- read phase: one forced layout per show, never during a mousemove ----- */
  function measure() {
    // offsetWidth/Height, not getBoundingClientRect(): the pill sits at
    // scale(.85) while hidden and the rect would report the scaled box. The
    // outer box is `width: max-content`, so what we measure does not depend on
    // where the pill currently sits - the measurement can't chase the position.
    w = el.offsetWidth;
    h = el.offsetHeight;
    const cs = getComputedStyle(el);
    geom = { ox: px(cs, '--_tip-x', GEOM.ox), oy: px(cs, '--_tip-y', GEOM.oy), m: px(cs, '--_tip-m', GEOM.m) };
  }

  /* -- write phase --------------------------------------------------------- */
  function position() {
    if (!active) return;
    // clientWidth/Height, not innerWidth/Height: the latter counts the
    // scrollbar, and a fixed pill clamped to it hides under the gutter.
    const doc = document.documentElement;
    const anchor = mode === 'pointer' ? null : active.getBoundingClientRect();
    // A boundary element clamps the pill inside that box instead of the window
    // - a panel, a modal, a demo frame. Read every frame, since it can scroll.
    const box = bounds && bounds.getBoundingClientRect();
    const p = place(cx, cy, w, h, doc.clientWidth, doc.clientHeight, prev, {
      align, ox: geom.ox, oy: geom.oy, m: geom.m, anchor,
      vside: mode === 'tap' ? 'above' : 'below',   // a finger is in the way below
      bounds: box && { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
    });
    prev = p;
    el.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)';
    if (p.origin !== origin) pill.style.transformOrigin = origin = p.origin;
  }

  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
  function paint() { frame = 0; position(); }

  function show(trigger, how, x, y) {
    disarm();
    if (!fill(trigger)) return;
    // Still on screen? Then this is a handoff, not a fresh show: the cursor
    // walked from one trigger straight onto the next, which is what moving
    // along a toolbar looks like. Without this the exit starts, gets a frame
    // in, and the next show yanks it back to the enter's start state - the
    // pill blinks once per button. A handoff keeps the pill alive, swaps the
    // words, and lets it carry on following.
    const handoff = how === 'pointer'
      && (el.hasAttribute('data-tip-show') || el.hasAttribute('data-tip-out'));
    release();                       // unconditional: re-showing the same
    active = trigger;                // trigger must not capture our own id
    mode = how;
    if (x !== undefined) { cx = x; cy = y; }
    if (watch) watch.observe(trigger, { attributes: true, attributeFilter: ['data-tip', 'data-tip-key'] });

    const theme = trigger.getAttribute('data-tip-theme') || opt.theme;
    if (theme) el.setAttribute('data-tip-theme', theme);
    else el.removeAttribute('data-tip-theme');

    // An element anchor is a box, not a point: centring under it is the only
    // placement that reads as "belongs to this control", so data-tip-pos stays
    // a cursor-path concern.
    const pos = trigger.getAttribute('data-tip-pos');
    const wasAligned = align;
    align = how !== 'pointer' ? 'center'
      : pos === 'right' || pos === 'center' ? pos : 'left';
    // Sides are resolved fresh, once, per show. A handoff keeps the previous
    // one instead: the pill is already on screen, so re-resolving from nothing
    // can flip it across the cursor for no reason the eye can account for.
    // Unless the new trigger asks for a different side - that is an explicit
    // instruction, and the hysteresis that stops thrash would otherwise sit on
    // it until the old side ran out of room.
    if (!handoff || align !== wasAligned) prev = null;

    // Unhide before wiring the description: an aria-describedby target must
    // never be aria-hidden.
    el.removeAttribute('aria-hidden');
    described = trigger.getAttribute('aria-describedby');
    trigger.setAttribute('aria-describedby', described ? described + ' ' + el.id : el.id);

    measure();                       // also flushes the hidden state, so the
    position();                      // spring has something to animate from
    clearTimeout(outTimer);
    el.removeAttribute('data-tip-out');
    // Arm, commit, show. Showing in one tick leaves the browser animating out
    // of whatever was last on screen, so the spring starts from the middle of
    // the previous one. Parking the from-state with the transition off, forcing
    // one recalc, then releasing gives every enter the same real start.
    //
    // A handoff skips the arm on purpose. There is no enter to give a start to,
    // and if the pill was a frame or two into its exit the same transition now
    // carries it back from wherever it got to, which reads as the pill simply
    // never leaving.
    if (!handoff) {
      el.setAttribute('data-tip-arm', '');
      void pill.offsetWidth;
      el.removeAttribute('data-tip-arm');
    }
    el.setAttribute('data-tip-show', '');
    if (how === 'pointer') move.bind();
  }

  function release() {
    if (watch) watch.disconnect();
    if (!active) return;
    if (described === null) active.removeAttribute('aria-describedby');
    else active.setAttribute('aria-describedby', described);
    described = null;
  }

  function hide() {
    if (!active) return;
    release();
    if (mode === 'pointer') warmUntil = Date.now() + delay;
    active = null;
    move.unbind();
    el.removeAttribute('data-tip-show');
    el.setAttribute('aria-hidden', 'true');
    // Mark the exit for exactly as long as it runs. A show clears it early, so
    // re-entering a trigger mid-bloop arrives clean rather than half-collapsed.
    el.setAttribute('data-tip-out', '');
    clearTimeout(outTimer);
    outTimer = setTimeout(() => el.removeAttribute('data-tip-out'), 170);
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }

  /** The active trigger changed its words. Re-fill, re-measure, re-place. */
  function refresh() {
    if (!active) return;
    if (!fill(active)) { hide(); return; }
    measure();
    position();
  }

  /* -- the cold-open delay ---------------------------------------------------
     Scanning a toolbar should not raise a pill on every button on the way
     past. A cold hover waits `delay`; the cursor keeps being tracked
     meanwhile so the pill lands under it, not where it entered. Once one
     is up, or was up within `delay`, the next is instant: that is the warm
     window, and the handoff in show() is the other half of it. */
  function arm(t, x, y) {
    cx = x; cy = y;
    pending = t;
    move.bind();
    delayTimer = setTimeout(() => { pending = null; show(t, 'pointer', cx, cy); }, delay);
  }
  function disarm() {
    if (!pending) return;
    clearTimeout(delayTimer);
    pending = null;
    if (!active) move.unbind();
  }

  /* -- long press ------------------------------------------------------------
     A finger held on a trigger for PRESS ms shows the pill above it. Letting
     go leaves it up; a tap elsewhere or a scroll takes it down. The click the
     browser fires when that finger lifts is swallowed - the person asked what
     the button does, not for it to do it - and a plain tap is never touched. */
  function press(t, x, y) {
    unpress();
    pressing = t;
    pressX = x; pressY = y;
    t.setAttribute('data-tip-press', '');
    pressTimer = setTimeout(() => { held = t; show(t, 'tap'); }, PRESS);
  }
  function unpress() {
    if (!pressing) return;
    clearTimeout(pressTimer);
    pressing.removeAttribute('data-tip-press');
    pressing = null;
  }

  /* -- handlers ------------------------------------------------------------ */
  function onOver(e) {
    const t = triggerAt(e.target);
    if (!t || (t === active && mode === 'pointer')) return;
    const warm = el.hasAttribute('data-tip-show') || el.hasAttribute('data-tip-out')
      || Date.now() < warmUntil;
    if (delay && !warm) arm(t, e.clientX, e.clientY);
    else show(t, 'pointer', e.clientX, e.clientY);  // a hover takes over a focus
  }

  function onMove(e) {
    cx = e.clientX;
    cy = e.clientY;
    schedule();                      // one write per frame, zero reads
  }

  function onOut(e) {
    if (pending && !pending.contains(e.relatedTarget)) disarm();
    if (active && mode === 'pointer' && !active.contains(e.relatedTarget)) hide();
  }

  /** Alt-tab with the cursor parked on a trigger used to leave a pill behind. */
  function onAway() {
    disarm();
    unpress();
    hide();
  }

  function onFocusIn(e) {
    const t = triggerAt(e.target);
    // :focus-visible only. A mouse click focuses the trigger too, and pinning
    // the pill to the element mid-hover would fight the cursor path.
    if (!t || t === active || !focusVisible(t)) return;
    show(t, 'focus');
  }

  function onFocusOut(e) {
    if (mode === 'focus' && active && active === triggerAt(e.target)) hide();
  }

  function onKey(e) {
    if (active && (e.key === 'Escape' || e.key === 'Esc')) hide();
  }

  function onClick(e) {
    const t = triggerAt(e.target);
    if (!t) return;
    if (t === active) { hide(); return; }        // second tap: let the link run
    if (touch !== 'tap') return;                 // press mode: a tap is a tap
    e.preventDefault();                          // first tap is the tooltip
    show(t, 'tap');
  }

  function onDown(e) {
    held = null;                                 // any new touch is a real one
    const t = triggerAt(e.target);
    if (t && !skip(t)) press(t, e.clientX, e.clientY);
  }
  function onPressMove(e) {
    // Ten pixels is a scroll, not a hold. pointercancel covers the rest.
    if (pressing && (Math.abs(e.clientX - pressX) > 10 || Math.abs(e.clientY - pressY) > 10)) unpress();
  }
  // Capture phase, on the root: the click a long press produces is stopped
  // before the trigger's own handlers, or a link's navigation, can see it.
  function onHeldClick(e) {
    if (!held) return;
    if (triggerAt(e.target) === held) { e.preventDefault(); e.stopPropagation(); }
    held = null;
  }
  function onMenu(e) {
    if (pressing || held) e.preventDefault();    // no Android context menu mid-hold
  }

  // Dismissal listens on the document even when `root` is scoped, otherwise a
  // tap outside the root would leave the pill stranded. Runs after onClick, so
  // a tap that just opened a tooltip is not also a tap outside one.
  function onClickAway(e) {
    if (active && !triggerAt(e.target)) hide();
  }

  function onScroll() {
    if (!active) return;
    if (mode === 'tap') hide();                  // the anchor is walking away
    else if (mode === 'focus') schedule();       // …but keep up with focus
  }

  function onResize() {
    if (!active) return;
    measure();                                   // --tip-max-width is viewport-relative
    position();
  }

  /* -- wiring -------------------------------------------------------------- */
  const core = group();
  const hover = group();
  const tap = group();
  const move = group();

  core.add(root, 'focusin', onFocusIn);
  core.add(root, 'focusout', onFocusOut);
  core.add(document, 'keydown', onKey);
  core.add(document, 'scroll', onScroll, { capture: true, passive: true });
  core.add(window, 'resize', onResize, { passive: true });
  core.add(window, 'orientationchange', onResize, { passive: true });
  core.add(window, 'blur', onAway);
  core.add(document, 'visibilitychange', () => { if (document.hidden) onAway(); });

  hover.add(root, 'mouseover', onOver);
  hover.add(root, 'mouseout', onOut);
  move.add(root, 'mousemove', onMove, { passive: true });

  tap.add(root, 'click', onClick);
  tap.add(document, 'click', onClickAway);
  if (touch === 'press' || touch === 'auto') {
    tap.add(root, 'click', onHeldClick, true);
    tap.add(root, 'contextmenu', onMenu);
    tap.add(root, 'pointerdown', onDown, { passive: true });
    tap.add(root, 'pointermove', onPressMove, { passive: true });
    tap.add(root, 'pointerup', unpress, { passive: true });
    tap.add(root, 'pointercancel', unpress, { passive: true });
  }

  // With no pill to show, a trigger's text still has to reach a screen
  // reader: every trigger when touch is off, only the links when it is auto.
  const descriptions = fallbackDescriptions(root, selector, touch === 'auto' ? skip : null);
  const mq = typeof matchMedia === 'function' ? matchMedia(POINTER_QUERY) : null;

  /** Hybrid laptops and tablets-with-trackpads change input mid-session. */
  function sync() {
    if (!mq || mq.matches) {
      descriptions.unmount();
      tap.unbind();
      hover.bind();
      return;
    }
    onAway();
    hover.unbind();
    if (touch === 'off') { tap.unbind(); descriptions.mount(); return; }
    tap.bind();
    if (touch === 'auto') descriptions.mount();
    else descriptions.unmount();
  }
  if (mq && mq.addEventListener) core.add(mq, 'change', sync);

  core.bind();
  sync();

  return {
    hide: onAway,
    show(trigger) {
      if (trigger && trigger !== active) show(trigger, 'tap');
    },
    destroy() {
      onAway();
      core.unbind();
      hover.unbind();
      tap.unbind();
      move.unbind();
      descriptions.unmount();
      el.remove();
      // The stylesheet is shared by every instance and inert on its own, so it
      // stays put rather than thrashing the CSSOM on create/destroy cycles.
    },
  };
}

/** `:focus-visible` is ~2020 and universal now; treat a throw as "keyboard". */
function focusVisible(el) {
  try { return el.matches(':focus-visible'); } catch (_) { return true; }
}

/**
 * No cursor and no tap mode still has to reach a screen reader, so each trigger
 * gets a hidden description node of its own, wired permanently - the same
 * relationship the pointer path makes on show, minus the pill. Covers the
 * triggers present when the mode engages; the pointer path's delegation is what
 * handles later arrivals.
 */
function fallbackDescriptions(root, selector, only) {
  let box = null;
  const wired = [];
  return {
    mount() {
      if (box) return;
      box = document.createElement('div');
      // Hidden, but still announced: an element referenced directly by
      // aria-describedby contributes its text even when it is not rendered.
      box.hidden = true;
      box.setAttribute('data-hah-tip', 'descriptions');
      for (const t of root.querySelectorAll(selector)) {
        const text = t.getAttribute('data-tip');
        if (!text || t.hasAttribute('aria-describedby') || (only && !only(t))) continue;
        const node = document.createElement('span');
        node.id = nextId();
        node.textContent = text;
        box.appendChild(node);
        t.setAttribute('aria-describedby', node.id);
        wired.push(t);
      }
      (document.body || document.documentElement).appendChild(box);
    },
    unmount() {
      if (!box) return;
      for (const t of wired) t.removeAttribute('aria-describedby');
      wired.length = 0;
      box.remove();
      box = null;
    },
  };
}

export default createTooltip;
