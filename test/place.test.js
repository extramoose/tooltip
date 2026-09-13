/**
 * Geometry tests for `place()` - the pure half of @extramoose/tooltip.
 *
 * `place()` is numbers in, numbers out: no DOM, no globals, no clock. So this
 * file needs no runner, no config and no dependencies - just:
 *
 *     node --test
 *
 * Every promise the library makes about staying on screen is decided in that
 * one function, which makes this file the place those promises get written
 * down. The browser-level spec next door only checks the wiring.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { place } from '../index.js';

/* -- the contract, restated ------------------------------------------------ */

/** Defaults `place()` falls back to when `opts` leaves them out. */
const OX = 10; // gap beside the cursor  (--tip-offset-x)
const OY = 16; // gap below the cursor   (--tip-offset-y)
const M = 8; //  keep-out band along every viewport edge (--tip-margin)

/** Anti-thrash constants from the module header. */
const BAND = 12; // slack before a shown pill abandons its preferred side
const RETURN_BAND = 1 / 3; // share of the pill's own extent needed to come back

/* -- helpers --------------------------------------------------------------- */

/** The box the caller would paint, given a placement and the pill's size. */
const boxOf = (p, w, h) => ({
  left: p.x,
  top: p.y,
  right: p.x + w,
  bottom: p.y + h,
});

const describeCase = (c) => JSON.stringify(c);

/**
 * A NaN in a transform is silent: the pill simply stops moving and nobody sees
 * an error. So every placement gets checked for well-formedness, everywhere.
 */
function assertWellFormed(p, where) {
  assert.ok(Number.isFinite(p.x), `${where}: x is not finite (${p.x})`);
  assert.ok(Number.isFinite(p.y), `${where}: y is not finite (${p.y})`);
  assert.ok(
    p.side === 'left' || p.side === 'right' || p.side === 'center',
    `${where}: unresolved side (${p.side})`,
  );
  assert.ok(
    p.vside === 'below' || p.vside === 'above',
    `${where}: unresolved vside (${p.vside})`,
  );
  assert.equal(typeof p.origin, 'string', `${where}: origin is not a string`);
}

/** Fully inside the margin box - the whole point of the library. */
function assertInsideViewport(p, w, h, vw, vh, where) {
  const box = boxOf(p, w, h);
  assert.ok(box.left >= M, `${where}: overflows the left margin (x=${box.left})`);
  assert.ok(box.top >= M, `${where}: overflows the top margin (y=${box.top})`);
  assert.ok(
    box.right <= vw - M,
    `${where}: overflows the right margin (right=${box.right}, limit=${vw - M})`,
  );
  assert.ok(
    box.bottom <= vh - M,
    `${where}: overflows the bottom margin (bottom=${box.bottom}, limit=${vh - M})`,
  );
}

const coversPoint = (box, x, y) =>
  x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;

/* -- the default placement ------------------------------------------------- */

describe('place(): the default placement', () => {
  it('sits below and to the left of a cursor in a roomy viewport', () => {
    const p = place(500, 400, 100, 40, 1000, 800, null, {});

    // x = cx - w - ox = 500 - 100 - 10;  y = cy + oy = 400 + 16.
    assert.deepEqual(p, {
      x: 390,
      y: 416,
      side: 'left',
      vside: 'below',
      origin: 'top right',
    });
  });

  it('treats omitted prev and opts as a fresh show with the documented defaults', () => {
    const withDefaults = place(500, 400, 100, 40, 1000, 800);
    const spelledOut = place(500, 400, 100, 40, 1000, 800, null, {
      align: 'left',
      ox: OX,
      oy: OY,
      m: M,
    });

    assert.deepEqual(withDefaults, spelledOut);
  });

  it('ignores unreadable geometry options instead of producing NaN', () => {
    // The DOM path parses these out of custom properties, so they can arrive as
    // NaN when a theme sets something the parser cannot read.
    const p = place(500, 400, 100, 40, 1000, 800, null, {
      ox: NaN,
      oy: undefined,
      m: null,
    });

    assertWellFormed(p, 'unreadable geometry');
    assert.deepEqual(p, place(500, 400, 100, 40, 1000, 800, null, {}));
  });
});

/* -- edges ----------------------------------------------------------------- */

describe('place(): viewport edges', () => {
  it('clamps x so a centred pill stays inside the right margin', () => {
    const vw = 1000;
    const w = 100;
    const cx = 990;

    const p = place(cx, 400, w, 40, vw, 800, null, { align: 'center' });

    // Centring wants cx - w / 2 = 940, which would hang 48px off the edge.
    assert.equal(p.x, vw - w - M, 'pill should be flush against the right margin');
    assert.ok(p.x < cx - w / 2, 'placement should have been clamped inwards');
    assertInsideViewport(p, w, 40, vw, 800, 'right edge');
  });

  it('flips to the other vertical side near the bottom edge', () => {
    const vh = 800;
    const h = 40;
    const cy = 790;

    const p = place(500, cy, 100, h, 1000, vh, null, {});

    assert.equal(p.vside, 'above');
    assert.equal(p.y, cy - h - OY, 'pill should hang above the cursor');
    assert.equal(p.origin, 'bottom right', 'spring origin follows the flip');
    assertInsideViewport(p, 100, h, 1000, vh, 'bottom edge');
  });

  it('flips to the other horizontal side near the left edge', () => {
    const cx = 5;

    const p = place(cx, 400, 100, 40, 1000, 800, null, {});

    assert.equal(p.side, 'right', 'the preferred left side does not fit');
    assert.equal(p.x, cx + OX);
    assert.equal(p.origin, 'top left');
    assertInsideViewport(p, 100, 40, 1000, 800, 'left edge');
  });

  it('stays below the cursor at the top edge, where below is what fits', () => {
    const p = place(500, 0, 100, 40, 1000, 800, null, {});

    assert.equal(p.vside, 'below');
    assert.equal(p.y, OY);
    assertInsideViewport(p, 100, 40, 1000, 800, 'top edge');
  });
});

/* -- corners --------------------------------------------------------------- */

describe('place(): corners resolve both axes', () => {
  const vw = 1000;
  const vh = 800;
  const w = 120;
  const h = 44;

  const cases = [
    { name: 'top-left', cx: 0, cy: 0, side: 'right', vside: 'below', origin: 'top left' },
    { name: 'top-right', cx: vw, cy: 0, side: 'left', vside: 'below', origin: 'top right' },
    { name: 'bottom-left', cx: 0, cy: vh, side: 'right', vside: 'above', origin: 'bottom left' },
    { name: 'bottom-right', cx: vw, cy: vh, side: 'left', vside: 'above', origin: 'bottom right' },
  ];

  for (const c of cases) {
    it(`resolves the ${c.name} corner and stays fully contained`, () => {
      const p = place(c.cx, c.cy, w, h, vw, vh, null, {});

      assertWellFormed(p, c.name);
      assert.equal(p.side, c.side);
      assert.equal(p.vside, c.vside);
      assert.equal(p.origin, c.origin);
      assert.equal(p.x, c.side === 'right' ? c.cx + OX : c.cx - w - OX);
      assert.equal(p.y, c.vside === 'below' ? c.cy + OY : c.cy - h - OY);
      assertInsideViewport(p, w, h, vw, vh, c.name);
    });
  }
});

/* -- align ----------------------------------------------------------------- */

describe('place(): the three align modes', () => {
  const cx = 500;
  const cy = 400;
  const w = 100;
  const h = 40;

  it('puts the pill in three distinct places, all contained', () => {
    const left = place(cx, cy, w, h, 1000, 800, null, { align: 'left' });
    const right = place(cx, cy, w, h, 1000, 800, null, { align: 'right' });
    const center = place(cx, cy, w, h, 1000, 800, null, { align: 'center' });

    assert.equal(left.x, cx - w - OX);
    assert.equal(right.x, cx + OX);
    assert.equal(center.x, cx - w / 2);

    assert.equal(new Set([left.x, right.x, center.x]).size, 3, 'all three differ');

    for (const [name, p] of [['left', left], ['right', right], ['center', center]]) {
      assertWellFormed(p, name);
      assertInsideViewport(p, w, h, 1000, 800, name);
    }
  });

  it('names the spring origin after the resolved side', () => {
    const origin = (align) => place(cx, cy, w, h, 1000, 800, null, { align }).origin;

    assert.equal(origin('left'), 'top right');
    assert.equal(origin('right'), 'top left');
    assert.equal(origin('center'), 'top center');
  });

  // The bug: `center` is a mode, not a flippable side, and the flip below skips
  // anything already centered. A remembered `center` was being taken as the
  // starting side regardless of what the new trigger asked for, so once a pill
  // had been centered every later placement stayed centered. It only showed up
  // once shows started carrying `prev` across a live handoff.
  it('never lets a remembered center override the align it is given', () => {
    for (const align of ['left', 'right']) {
      const fresh = place(cx, cy, w, h, 1000, 800, null, { align });
      const afterCenter = place(cx, cy, w, h, 1000, 800, { side: 'center', vside: 'below' }, { align });

      assert.equal(afterCenter.side, align, `align=${align} must not stay centered`);
      assert.equal(afterCenter.x, fresh.x, `align=${align} lands where a fresh show would`);
    }
  });

  it('keeps center centered whatever side it is coming from', () => {
    for (const was of [null, 'left', 'right', 'center']) {
      const prev = was && { side: was, vside: 'below' };
      assert.equal(place(cx, cy, w, h, 1000, 800, prev, { align: 'center' }).side, 'center',
        `coming from ${was}`);
    }
  });

  // Why `show()` resolves fresh when a trigger asks for a different side rather
  // than carrying the last one over: hysteresis is there to stop a *tracking*
  // pill thrashing, and it is not entitled to overrule an explicit
  // data-tip-pos. Here the right side fits with room to spare, but not the
  // third of the pill's width that coming back to a preferred side demands.
  it('hysteresis can outvote the requested align, which is why a changed one starts over', () => {
    const wide = 300;
    const carried = { side: 'left', vside: 'below' };

    const kept = place(500, cy, wide, h, 900, 800, carried, { align: 'right' });
    const startedOver = place(500, cy, wide, h, 900, 800, null, { align: 'right' });

    assert.equal(kept.side, 'left', 'carried over, the old side wins');
    assert.equal(startedOver.side, 'right', 'started over, the trigger gets what it asked for');
  });

  it('keeps every align mode inside a viewport barely wider than the pill', () => {
    const vw = w + 2 * M; // exactly enough room, and not a pixel more
    for (const align of ['left', 'right', 'center']) {
      for (let cx2 = 0; cx2 <= vw; cx2++) {
        const p = place(cx2, cy, w, h, vw, 800, null, { align });
        assertInsideViewport(p, w, h, vw, 800, `align=${align} cx=${cx2}`);
      }
    }
  });
});

/* -- hysteresis ------------------------------------------------------------ */

describe('place(): hysteresis keeps a tracking pill from thrashing', () => {
  const w = 100;
  const h = 40;
  const vw = 1000;
  const vh = 800;

  /** Walk the cursor down the screen, carrying the placement forward. */
  const firstCyThatFlipsUp = () => {
    let prev = { side: 'left', vside: 'below' };
    for (let cy = 0; cy <= vh; cy++) {
      prev = place(500, cy, w, h, vw, vh, prev, {});
      if (prev.vside === 'above') return cy;
    }
    assert.fail('the pill never flipped above, even at the bottom edge');
  };

  /** …then walk it back up, still carrying the placement forward. */
  const firstCyThatFlipsBackDown = () => {
    let prev = { side: 'left', vside: 'above' };
    for (let cy = vh; cy >= 0; cy--) {
      prev = place(500, cy, w, h, vw, vh, prev, {});
      if (prev.vside === 'below') return cy;
    }
    assert.fail('the pill never returned below');
  };

  it('demands meaningfully more clearance to return to the preferred side', () => {
    const left = firstCyThatFlipsUp();
    const returned = firstCyThatFlipsBackDown();

    assert.ok(
      returned < left,
      `returning must need more room than leaving did (left at cy=${left}, returned at cy=${returned})`,
    );

    // Leaving costs one pixel of overflow. Coming back costs a third of the
    // pill's own height on top of that - the asymmetry *is* the anti-thrash.
    const extraClearance = left - returned;
    assert.ok(
      extraClearance >= h * RETURN_BAND,
      `expected at least ${h * RETURN_BAND}px of extra clearance, got ${extraClearance}px`,
    );
    assert.ok(
      extraClearance <= h * RETURN_BAND + 2,
      `the return band should be ~h/3, not ${extraClearance}px`,
    );
  });

  it('demands the same asymmetry on the horizontal axis, scaled to the width', () => {
    let prev = { side: 'left', vside: 'below' };
    let leftAt = null;
    for (let cx = vw; cx >= 0 && leftAt === null; cx--) {
      prev = place(cx, 400, w, h, vw, vh, prev, {});
      if (prev.side === 'right') leftAt = cx;
    }

    prev = { side: 'right', vside: 'below' };
    let returnedAt = null;
    for (let cx = 0; cx <= vw && returnedAt === null; cx++) {
      prev = place(cx, 400, w, h, vw, vh, prev, {});
      if (prev.side === 'left') returnedAt = cx;
    }

    assert.ok(leftAt !== null && returnedAt !== null, 'both flips should happen');
    const extraClearance = returnedAt - leftAt;
    assert.ok(
      extraClearance >= w * RETURN_BAND,
      `expected at least ${w * RETURN_BAND}px of extra clearance, got ${extraClearance}px`,
    );
  });

  it('flips at most once while the cursor rattles across the boundary', () => {
    const boundary = firstCyThatFlipsUp();
    let prev = { side: 'left', vside: 'below' };
    let flips = 0;

    for (let pass = 0; pass < 10; pass++) {
      for (const cy of [boundary - 6, boundary + 2, boundary - 6, boundary + 2]) {
        const next = place(500, cy, w, h, vw, vh, prev, {});
        if (next.vside !== prev.vside) flips++;
        prev = next;
      }
    }

    // A symmetric threshold would flip twice per crossing: 40 times over.
    assert.equal(flips, 1, 'the pill should settle above and stay there');
  });

  it('needs real overflow, not a graze, before a shown pill moves at all', () => {
    const boundary = firstCyThatFlipsUp();
    const stillBelow = place(500, boundary - 1, w, h, vw, vh, { side: 'left', vside: 'below' }, {});

    assert.equal(stillBelow.vside, 'below');
  });

  it('decides freely on a fresh show, whatever the last show settled on', () => {
    const cy = 730; // past the return band, short of the flip-out point
    const sticky = place(500, cy, w, h, vw, vh, { side: 'left', vside: 'above' }, {});
    const fresh = place(500, cy, w, h, vw, vh, null, {});

    assert.equal(sticky.vside, 'above', 'a shown pill stays where it was');
    assert.equal(fresh.vside, 'below', 'a new show starts from the preference');
  });

  it('accepts a bare side string as the previous placement', () => {
    const fromString = place(400, 400, w, h, vw, vh, 'right', {});
    const fromObject = place(400, 400, w, h, vw, vh, { side: 'right', vside: 'below' }, {});

    assert.deepEqual(fromString, fromObject);
  });
});

/* -- the cursor stays visible ---------------------------------------------- */

describe('place(): the pill never covers the cursor', () => {
  it('keeps clear of a cursor in open space', () => {
    const p = place(500, 400, 100, 40, 1000, 800, null, {});
    assert.equal(coversPoint(boxOf(p, 100, 40), 500, 400), false);
  });

  it('keeps clear wherever the pill has room to sit beside the cursor', () => {
    for (const [vw, vh] of [[320, 568], [768, 1024], [1280, 720], [1440, 900]]) {
      for (const [w, h] of [[40, 24], [120, 44], [200, 80], [320, 160]]) {
        for (const align of ['left', 'right', 'center']) {
          for (let cx = 0; cx <= vw; cx += 17) {
            for (let cy = 0; cy <= vh; cy += 13) {
              // Geometry permits only when the offset gap actually fits on one
              // vertical side; a pill taller than the gap allows has nowhere to
              // go and legitimately lands on the cursor.
              const roomBelow = vh - M - (cy + OY) - h >= 0 && cy + OY >= M;
              const roomAbove = cy - OY - h - M >= 0 && cy - OY <= vh - M;
              if (!roomBelow && !roomAbove) continue;

              const p = place(cx, cy, w, h, vw, vh, null, { align });
              if (coversPoint(boxOf(p, w, h), cx, cy)) {
                assert.fail(
                  `pill covers the cursor with room to spare: ${describeCase({ cx, cy, w, h, vw, vh, align })} -> ${describeCase(p)}`,
                );
              }
            }
          }
        }
      }
    }
  });
});

/* -- element anchors (focus and tap) --------------------------------------- */

describe('place(): element anchors run through the same solver', () => {
  const anchor = { left: 400, right: 500, top: 300, bottom: 340 };

  it('centres the pill under the anchor and ignores the cursor', () => {
    const p = place(0, 0, 100, 40, 1000, 800, null, { align: 'center', anchor });

    assert.equal(p.x, (anchor.left + anchor.right) / 2 - 100 / 2);
    assert.equal(p.y, anchor.bottom + OY);
    assert.equal(p.vside, 'below');
  });

  it('flips above an anchor sitting on the bottom edge', () => {
    const low = { left: 400, right: 500, top: 760, bottom: 800 };
    const p = place(0, 0, 100, 40, 1000, 800, null, { align: 'center', anchor: low });

    assert.equal(p.vside, 'above');
    assert.equal(p.y, low.top - 40 - OY);
    assertInsideViewport(p, 100, 40, 1000, 800, 'low anchor');
  });

  it('goes above when asked to, since a finger is in the way below', () => {
    const p = place(0, 0, 100, 40, 1000, 800, null, { align: 'center', anchor, vside: 'above' });

    assert.equal(p.vside, 'above');
    assert.equal(p.y, anchor.top - 40 - OY);
    assert.equal(p.origin, 'bottom center');
  });

  it('a preferred "above" still flips below when the top is out of room', () => {
    const high = { left: 400, right: 500, top: 4, bottom: 44 };
    const p = place(0, 0, 100, 40, 1000, 800, null, { align: 'center', anchor: high, vside: 'above' });

    assert.equal(p.vside, 'below');
    assertInsideViewport(p, 100, 40, 1000, 800, 'high anchor, above preferred');
  });

  it('clamps an anchor that hugs the right edge', () => {
    const far = { left: 960, right: 1000, top: 300, bottom: 340 };
    const p = place(0, 0, 200, 40, 1000, 800, null, { align: 'center', anchor: far });

    assert.equal(p.x, 1000 - 200 - M);
    assertInsideViewport(p, 200, 40, 1000, 800, 'right-edge anchor');
  });
});

/* -- degenerate input ------------------------------------------------------ */

describe('place(): degenerate input stays finite', () => {
  it('pins a pill larger than the viewport to the top-left margin', () => {
    const p = place(100, 100, 500, 300, 200, 150, null, {});

    assertWellFormed(p, 'oversized pill');
    assert.equal(p.x, M);
    assert.equal(p.y, M);
  });

  it('survives a zero-size viewport', () => {
    const p = place(0, 0, 100, 40, 0, 0, null, {});

    assertWellFormed(p, 'zero viewport');
    assert.equal(p.x, M);
    assert.equal(p.y, M);
  });

  it('survives a zero-size pill', () => {
    const p = place(500, 400, 0, 0, 1000, 800, null, {});

    assertWellFormed(p, 'zero pill');
    assertInsideViewport(p, 0, 0, 1000, 800, 'zero pill');
  });

  it('handles a cursor at the exact origin and the exact far corner', () => {
    const topLeft = place(0, 0, 120, 44, 1000, 800, null, {});
    const bottomRight = place(1000, 800, 120, 44, 1000, 800, null, {});

    assertWellFormed(topLeft, 'cursor at (0,0)');
    assertWellFormed(bottomRight, 'cursor at (vw,vh)');
    assertInsideViewport(topLeft, 120, 44, 1000, 800, 'cursor at (0,0)');
    assertInsideViewport(bottomRight, 120, 44, 1000, 800, 'cursor at (vw,vh)');
  });

  it('returns integer pixels, so the transform cannot resample the text', () => {
    const p = place(500.4, 400.6, 100, 40, 1000, 800, null, {});

    assert.equal(p.x, Math.round(p.x));
    assert.equal(p.y, Math.round(p.y));
  });
});

/* -- the sweep ------------------------------------------------------------- */

describe('place(): containment sweep', () => {
  it('keeps the pill inside the margin box for every combination it can fit in', () => {
    const viewports = [[320, 568], [375, 667], [768, 1024], [1280, 720], [1920, 1080]];
    const pills = [[40, 24], [120, 44], [200, 80], [320, 160]];
    const aligns = ['left', 'right', 'center'];
    const prevs = [
      null,
      'left',
      'right',
      { side: 'left', vside: 'above' },
      { side: 'right', vside: 'below' },
    ];

    let checked = 0;

    for (const [vw, vh] of viewports) {
      const stepX = Math.max(1, Math.round(vw / 16));
      const stepY = Math.max(1, Math.round(vh / 14));

      for (const [w, h] of pills) {
        for (const align of aligns) {
          for (const prev of prevs) {
            for (let cx = 0; cx <= vw; cx += stepX) {
              for (let cy = 0; cy <= vh; cy += stepY) {
                const p = place(cx, cy, w, h, vw, vh, prev, { align });
                checked++;

                const where = describeCase({ cx, cy, w, h, vw, vh, align, prev });
                assertWellFormed(p, where);

                // Containment is only a promise the geometry can keep when the
                // pill is small enough to fit between the margins at all.
                if (w + 2 * M <= vw && h + 2 * M <= vh) {
                  assertInsideViewport(p, w, h, vw, vh, where);
                }
              }
            }
          }
        }
      }
    }

    assert.ok(checked > 20000, `sweep should be broad, only checked ${checked}`);
  });
});
