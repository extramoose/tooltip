/**
 * The one-script-tag entry point: re-exports the library, then initialises it.
 *
 * This lives outside index.js on purpose. A top-level statement in index.js
 * survives tree-shaking whenever any part of the module is used - `sideEffects:
 * false` licenses dropping an unused *module*, not a live statement inside a
 * used one. So a consumer who imported only `place()` and bundled to a classic
 * script could get a tooltip they never asked for. Keeping index.js free of
 * top-level statements makes "importing this touches nothing" true of every
 * downstream bundle, not just of this package.
 *
 * Options ride on the script tag itself, since a classic script has nowhere
 * else to take them:
 *
 *   <script src=".../tooltip@1" data-touch="press" data-delay="150"></script>
 *
 * `data-selector`, `data-touch`, `data-delay`, `data-theme` and `data-boundary`
 * are read; the instance they make is `Tooltip.tip`.
 *
 * @module @extramoose/tooltip/auto
 */
import createTooltip from './index.js';

export * from './index.js';
export { default } from './index.js';

// A classic <script> sets document.currentScript; inside a module it is null.
const script = typeof document !== 'undefined' && document.currentScript;

/** @type {?import('./index.js').TooltipHandle} */
export const tip = script ? createTooltip(fromDataset(script.dataset)) : null;

function fromDataset(ds) {
  const o = {};
  for (const k of ['selector', 'touch', 'theme', 'boundary']) if (ds[k]) o[k] = ds[k];
  if (ds.delay) o.delay = +ds.delay;
  return o;
}
