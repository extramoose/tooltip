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
export function place(cx: number, cy: number, w: number, h: number, vw: number, vh: number, prev?: (Placement | string) | null, opts?: {
    align?: "left" | "right" | "center";
    vside?: "below" | "above";
    ox?: number;
    oy?: number;
    m?: number;
    anchor?: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    } | null;
    bounds?: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    } | null;
}): Placement;
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
export function createTooltip(options?: TooltipOptions): TooltipHandle;
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
export const css: string;
export default createTooltip;
export type Placement = {
    x: number;
    y: number;
    side: "left" | "right" | "center";
    vside: "below" | "above";
    origin: string;
};
export type TooltipOptions = {
    /**
     * Trigger selector. Events are
     * delegated, so triggers added to the DOM later work with no re-init.
     */
    selector?: string | undefined;
    /**
     * Delegation root.
     */
    root?: Document | Element | undefined;
    /**
     * Gap from the cursor, in px.
     * Sets `--tip-offset-x` / `--tip-offset-y` on the pill.
     */
    offset?: {
        x?: number;
        y?: number;
    } | undefined;
    /**
     * Milliseconds a cold hover waits before the
     * pill shows. Walking from one trigger straight onto the next, or coming
     * back within `delay` of leaving, is never delayed. Focus never is either.
     */
    delay?: number | undefined;
    /**
     * What a device with no cursor gets.
     * By default a long press shows an element-anchored pill on anything that
     * is not a link, and links keep their own long press (iOS previews them).
     * `'press'` is that on links too; `'tap'` toggles the pill on tap and
     * swallows the first click; `'off'` shows nothing and leaves the text to
     * `aria-describedby`.
     */
    touch?: "off" | "tap" | "press" | undefined;
    /**
     * Sets `data-tip-theme` on the pill. A trigger's own
     * `data-tip-theme` wins over it.
     */
    theme?: string | undefined;
    /**
     * Clamp the pill inside this element's box
     * instead of the window - a panel, a modal, a demo frame. Accepts an element
     * or a selector. Defaults to the viewport.
     */
    boundary?: string | Element | undefined;
    /**
     * Set false to ship the CSS yourself
     * (strict `style-src` with no `'unsafe-inline'`).
     */
    injectStyles?: boolean | undefined;
};
export type TooltipHandle = {
    /**
     * Dismiss whatever is showing.
     */
    hide: () => void;
    /**
     * Show the pill anchored to
     * `trigger`, the way a tap would, until `hide()`, a tap elsewhere or a
     * scroll. For the "Copied!" after a tap, where nothing else would raise
     * it. A no-op when that trigger's pill is already up: change its
     * `data-tip` instead and the pill follows.
     */
    show: (trigger: Element) => void;
    /**
     * Remove every listener and the pill itself.
     */
    destroy: () => void;
};
