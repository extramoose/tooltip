/**
 * DOM integration for @extramoose/tooltip, in a real browser.
 *
 *     npx playwright test
 *
 * This is the *secondary* suite. The geometry - the part that is actually hard
 * to get right - is proven next door in `place.test.js`, which needs nothing
 * installed. What is left here is wiring: does a cursor over a trigger produce
 * a pill in the right place, does the keyboard reach it, does it clean up.
 *
 * Two things this file goes out of its way to do:
 *
 *   1. Never hard-code a pixel. Expected positions are derived from
 *      `boundingBox()` and `viewportSize()`, so the assertions survive a
 *      different default viewport, font or padding.
 *   2. Skip cleanly instead of failing when Playwright - or its browsers - are
 *      not installed. `node --test` also picks up every file under `test/`, so
 *      the import is guarded and this file degrades to a single skipped test
 *      under the built-in runner.
 */

import { existsSync, readFileSync } from 'node:fs';

/** The library source, injected into the page as a module. */
const SOURCE = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

const FIXTURE = `<!doctype html>
<meta charset="utf-8">
<title>@extramoose/tooltip fixture</title>
<style>
  html, body { margin: 0; height: 100%; font: 16px/1.4 system-ui, sans-serif; }
  /* A trigger that covers the viewport, so the cursor is over a trigger at
     every point we can move it to - including one pixel from each edge. */
  #field { position: fixed; inset: 0; }
  #trigger { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
</style>
<div id="field" data-tip="Rides the cursor"></div>
<button id="trigger" data-tip="Explains this control" aria-describedby="note">Trigger</button>
<p id="note" hidden>a description the page already had</p>
`;

// This file lives in e2e/ rather than test/ so the two runners never see each
// other's files: `node --test` owns test/, Playwright owns e2e/. Guarding the
// import here instead would not work - once @playwright/test is installed the
// import succeeds and its API runs under the wrong runner.
defineSuite(await import('@playwright/test'));

function defineSuite({ test, expect, chromium }) {
  const missing = browsersMissing(chromium);

  const suite = missing ? test.describe.skip : test.describe;

  suite(`tooltip in the DOM${missing ? ` [skipped: ${missing}]` : ''}`, () => {
    /** Load the fixture and start one instance we control. */
    // Most of these are about what happens once the pill is up, so they run
    // with the cold-open delay off; the delay has tests of its own below.
    async function mount(page, options = '{ delay: 0 }') {
      await page.setContent(FIXTURE);
      await page.addScriptTag({
        type: 'module',
        content: `${SOURCE}\nwindow.tip = createTooltip(${options});\nwindow.__ready = true;`,
      });
      await page.waitForFunction(() => window.__ready === true);
    }

    /** The pill positions itself on the next frame; let that frame happen. */
    const settle = (page) =>
      page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );

    test('keeps the pill inside the viewport as the cursor visits every edge', async ({ page }) => {
      await mount(page);
      const view = page.viewportSize();
      const tip = page.locator('.hah-tip');

      const stops = [
        ['top-left', 1, 1],
        ['top-right', view.width - 1, 1],
        ['bottom-left', 1, view.height - 1],
        ['bottom-right', view.width - 1, view.height - 1],
        ['left-middle', 0, Math.round(view.height / 2)],
        ['right-middle', view.width - 1, Math.round(view.height / 2)],
      ];

      for (const [name, x, y] of stops) {
        await page.mouse.move(x, y);
        await expect(tip).toHaveAttribute('data-tip-show', '');
        await settle(page);

        const box = await tip.boundingBox();
        expect(box, `${name}: the pill should be laid out`).not.toBeNull();
        expect(box.x, `${name}: left edge`).toBeGreaterThanOrEqual(0);
        expect(box.y, `${name}: top edge`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${name}: right edge`).toBeLessThanOrEqual(view.width);
        expect(box.y + box.height, `${name}: bottom edge`).toBeLessThanOrEqual(view.height);
      }
    });

    test('Escape dismisses a pill that is following the cursor', async ({ page }) => {
      await mount(page);
      const view = page.viewportSize();
      const tip = page.locator('.hah-tip');

      await page.mouse.move(Math.round(view.width / 2), Math.round(view.height / 2));
      await expect(tip).toHaveAttribute('data-tip-show', '');

      await page.keyboard.press('Escape');

      await expect(tip).not.toHaveAttribute('data-tip-show', '');
      await expect(tip).toHaveAttribute('aria-hidden', 'true');
    });

    test('tabbing to a trigger shows the pill anchored under it', async ({ page }) => {
      await mount(page);
      const trigger = page.locator('#trigger');
      const tip = page.locator('.hah-tip');

      await page.keyboard.press('Tab'); // no mouse involved at all
      await expect(trigger).toBeFocused();
      await expect(tip).toHaveAttribute('data-tip-show', '');
      await settle(page);

      const anchor = await trigger.boundingBox();
      const box = await tip.boundingBox();

      // Element-anchored placement is centred on the anchor, not on a cursor.
      const anchorCentre = anchor.x + anchor.width / 2;
      const pillCentre = box.x + box.width / 2;
      expect(Math.abs(pillCentre - anchorCentre), 'pill is centred on the trigger').toBeLessThanOrEqual(1);
      expect(box.y, 'pill sits below the trigger').toBeGreaterThanOrEqual(anchor.y + anchor.height);
    });

    test('wires aria-describedby on show and restores it on hide', async ({ page }) => {
      await mount(page);
      const trigger = page.locator('#trigger');
      const tip = page.locator('.hah-tip');

      await trigger.hover();
      await expect(tip).toHaveAttribute('data-tip-show', '');

      const tipId = await tip.getAttribute('id');
      expect(tipId, 'the pill needs an id to be referenced by').toBeTruthy();
      // The trigger's own description survives: the pill is appended to it.
      await expect(trigger).toHaveAttribute('aria-describedby', `note ${tipId}`);

      await page.keyboard.press('Escape');
      await expect(trigger).toHaveAttribute('aria-describedby', 'note');
    });

    test('destroy() removes the pill and stops listening', async ({ page }) => {
      await mount(page);
      const view = page.viewportSize();

      await page.mouse.move(Math.round(view.width / 2), Math.round(view.height / 2));
      await expect(page.locator('.hah-tip')).toHaveCount(1);

      await page.evaluate(() => window.tip.destroy());
      await expect(page.locator('.hah-tip')).toHaveCount(0);

      // Listeners went with it: moving over a trigger brings nothing back.
      await page.mouse.move(Math.round(view.width / 3), Math.round(view.height / 3));
      await settle(page);
      await expect(page.locator('.hah-tip')).toHaveCount(0);
      // The stylesheet is shared and inert, so it is documented to stay put.
      await expect(page.locator('#hah-tip-styles')).toHaveCount(1);
    });

    test('prefers-reduced-motion turns the spring off', async ({ page }) => {
      await mount(page);
      const view = page.viewportSize();
      const pill = page.locator('.hah-tip__pill');

      await page.mouse.move(Math.round(view.width / 2), Math.round(view.height / 2));
      await expect(page.locator('.hah-tip')).toHaveAttribute('data-tip-show', '');

      const duration = () =>
        pill.evaluate((el) => getComputedStyle(el).transitionDuration);

      expect(await duration(), 'the pill animates by default').not.toBe('0s');

      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await duration(), 'reduced motion removes the transition').toBe('0s');
    });

    // Light and dark are expressed twice on purpose: the media query, and
    // data-theme on the root for a page with its own switch. A page toggled
    // against the OS used to draw a white pill on a white background.
    test('follows the OS scheme, and a page override when there is one', async ({ page }) => {
      await mount(page);
      const view = page.viewportSize();
      await page.mouse.move(Math.round(view.width / 2), Math.round(view.height / 2));
      await expect(page.locator('.hah-tip')).toHaveAttribute('data-tip-show', '');

      const paint = () =>
        page.locator('.hah-tip__pill').evaluate((el) => {
          const s = getComputedStyle(el);
          return { bg: s.backgroundColor, fg: s.color };
        });

      await page.emulateMedia({ colorScheme: 'light' });
      const light = await paint();
      await page.emulateMedia({ colorScheme: 'dark' });
      const dark = await paint();
      expect(dark.bg, 'the fill inverts with the OS scheme').not.toBe(light.bg);
      expect(dark.fg, 'so does the text').not.toBe(light.fg);

      // OS says dark, the page says light: the page wins.
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      expect((await paint()).bg, 'a page override beats the OS').toBe(light.bg);

      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.emulateMedia({ colorScheme: 'light' });
      expect((await paint()).bg, 'and it works the other way too').toBe(dark.bg);
    });

    // The enter was once pinned at its start transform and never settled,
    // because the rule that parks the from-state tied with the shown rule on
    // specificity and came later in the sheet. Worth a guard: a spring that
    // never reaches rest looks like no animation at all.
    test('the enter springs from a transform and settles at rest', async ({ page }) => {
      await mount(page);
      const pill = page.locator('.hah-tip__pill');

      // #field is a trigger covering the whole viewport, so the cursor is over
      // something wherever it sits. Put the pill away and let the exit finish,
      // or the hover below is a handoff and skips the enter by design.
      await page.mouse.move(1, 1);
      await page.evaluate(() => window.tip.hide());
      await page.waitForTimeout(250);

      await page.locator('#trigger').hover();   // a real move, so a real show
      const mid = await pill.evaluate((el) => getComputedStyle(el).transform);
      expect(mid, 'it starts scaled, not at rest').toMatch(/^matrix\((?!1, 0, 0, 1)/);

      await page.waitForTimeout(400);
      expect(await pill.evaluate((el) => getComputedStyle(el).transform),
        'and it gets all the way to rest').toBe('none');
    });

    // Walking from one trigger onto the next used to blink: the exit started,
    // got a frame in, and the next show yanked the pill back to the enter's
    // start state. Measured at the time - opacity 1 with the old text on one
    // frame, opacity 0 and scale(.85) with the new text on the next. It is the
    // toolbar case, so it is the most common interaction the library has.
    test('walking from one trigger to the next never blinks', async ({ page }) => {
      await mount(page);
      const view = page.viewportSize();
      const box = await page.locator('#trigger').boundingBox();

      // Wait for the enter to actually finish rather than guessing at a
      // duration: under a loaded CI box a fixed timeout can still be mid-spring
      // and the watcher below then records the tail of the enter as a dip.
      await page.locator('#trigger').hover();
      await page.waitForFunction(() => {
        const p = document.querySelector('.hah-tip__pill');
        return p && getComputedStyle(p).opacity === '1'
          && getComputedStyle(p).transform === 'none';
      });

      // Record every frame into the page, and let the assertion below wait on
      // the text actually changing rather than on a wall clock. The first
      // sample is taken synchronously on purpose: requestAnimationFrame does
      // not run for up to a frame, and the mouse move beats it, so a recorder
      // that only samples on rAF never sees the before-state at all.
      await page.evaluate(() => {
        const pill = document.querySelector('.hah-tip__pill');
        const sample = () =>
          window.__seen.push([+getComputedStyle(pill).opacity, pill.textContent]);
        window.__seen = [];
        sample();
        const t0 = performance.now();
        const tick = () => {
          sample();
          if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      // Off the button and onto #field, which is a different trigger.
      await page.mouse.move(Math.round(box.x / 2), Math.round(view.height - 4));
      await page.waitForFunction(() => new Set(window.__seen.map((s) => s[1])).size >= 2);
      await page.waitForTimeout(250);   // and well past where the blink was

      const seen = await page.evaluate(() => window.__seen);
      const dip = Math.min(...seen.map(([o]) => o));
      expect(dip, 'the pill stays up across the handoff').toBeGreaterThan(0.9);
    });

    // Reported from the docs page: hover left, right, centre and each one lands
    // correctly, but walk back and everything stays centred. Carrying `prev`
    // across a handoff carried the resolved side with it, and a remembered
    // "centre" is not a side the flip knows how to leave.
    test('each trigger honours its own data-tip-pos, in any order', async ({ page }) => {
      await mount(page);

      // Built after createTooltip() ran, which also exercises the claim that
      // delegation picks up whatever the page adds later.
      await page.evaluate(() => {
        [['pl', 'left', 240], ['pr', 'right', 520], ['pc', 'center', 800]].forEach(
          ([id, pos, x]) => {
            const b = document.createElement('button');
            b.id = id;
            b.textContent = pos;
            b.setAttribute('data-tip', 'Anchored ' + pos);
            if (pos !== 'left') b.setAttribute('data-tip-pos', pos);
            b.style.cssText = `position:fixed;left:${x}px;top:300px;z-index:9`;
            document.body.appendChild(b);
          },
        );
      });

      /** Where the pill sits relative to the cursor it is following. */
      const sideAt = async (id) => {
        const box = await page.locator('#' + id).boundingBox();
        const cx = Math.round(box.x + box.width / 2);
        await page.mouse.move(cx, Math.round(box.y + box.height / 2), { steps: 4 });
        await page.waitForFunction(
          (want) => {
            const el = document.querySelector('.hah-tip[data-tip-show]');
            return el && el.textContent === want;
          },
          'Anchored ' + { pl: 'left', pr: 'right', pc: 'center' }[id],
        );
        const r = await page.locator('.hah-tip[data-tip-show]').boundingBox();
        return r.x + r.width < cx + 4 ? 'left' : r.x > cx - 4 ? 'right' : 'center';
      };

      // Every ordering of the three, walked as one unbroken hover chain, which
      // is what makes them handoffs rather than fresh shows.
      const ids = ['pl', 'pr', 'pc'];
      const want = { pl: 'left', pr: 'right', pc: 'center' };
      for (const a of ids) {
        for (const b of ids) {
          for (const c of ids) {
            for (const id of [a, b, c]) {
              expect(await sideAt(id), `${a} -> ${b} -> ${c}, at ${id}`).toBe(want[id]);
            }
          }
        }
      }
    });

    test('collapses on the way out instead of just vanishing', async ({ page }) => {
      await mount(page);
      const view = page.viewportSize();
      const tip = page.locator('.hah-tip');
      await page.mouse.move(Math.round(view.width / 2), Math.round(view.height / 2));
      await expect(tip).toHaveAttribute('data-tip-show', '');

      // the fixture's trigger covers the viewport, so there is nowhere to move
      // the cursor that is not over it - dismiss it the way a caller would
      await page.evaluate(() => window.tip.hide());
      await expect(tip).toHaveAttribute('data-tip-out', '');
      const shrunk = await page.locator('.hah-tip__pill').evaluate(
        (el) => getComputedStyle(el).transform !== 'none',
      );
      expect(shrunk, 'the pill scales down as it leaves').toBe(true);

      // and the exit flag clears itself, so the next show is not half-collapsed
      await expect(tip).not.toHaveAttribute('data-tip-out', '', { timeout: 2000 });
    });

    /* ------------------------------------------------------------------------
       The behaviours below need bare page around the triggers, so they mount
       their own markup instead of the viewport-covering fixture. */
    async function mountBare(page, html, options = '{ delay: 0 }') {
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>
        html, body { margin: 0; height: 100%; font: 16px/1.4 system-ui, sans-serif; }
        .t { position: absolute; width: 120px; height: 40px; }
      </style>${html}`);
      await page.addScriptTag({
        type: 'module',
        content: `${SOURCE}\nwindow.tip = createTooltip(${options});\nwindow.__ready = true;`,
      });
      await page.waitForFunction(() => window.__ready === true);
    }
    const shown = (page) => page.evaluate(() => document.querySelector('.hah-tip').hasAttribute('data-tip-show'));

    test('delay waits on a cold hover, and only on a cold one', async ({ page }) => {
      await mountBare(page, `
        <button class="t" id="a" style="left:100px;top:100px" data-tip="A">A</button>
        <button class="t" id="b" style="left:220px;top:100px" data-tip="B">B</button>
        <button class="t" id="c" style="left:100px;top:300px" data-tip="C">C</button>
      `, '{ delay: 200 }');
      const tip = page.locator('.hah-tip');

      // cold: not yet, then yes - and the pill lands under where the cursor
      // ended up, not where it entered
      await page.mouse.move(10, 10);
      await page.mouse.move(110, 110);
      await page.mouse.move(150, 120);
      await page.waitForTimeout(60);
      expect(await shown(page), 'nothing at 60ms').toBe(false);
      await expect(tip).toHaveAttribute('data-tip-show', '');
      await expect(tip).toHaveText('A');

      // handoff: walking onto B while A is up is instant
      await page.mouse.move(230, 120);
      await page.waitForTimeout(30);
      expect(await shown(page), 'B without a wait').toBe(true);
      await expect(tip).toHaveText('B');

      // warm: leave, come straight back inside the delay, instant again
      await page.mouse.move(400, 500);
      await expect(tip).not.toHaveAttribute('data-tip-show', '');
      await page.mouse.move(110, 310);
      await page.waitForTimeout(40);
      expect(await shown(page), 'C inside the warm window').toBe(true);

      // leaving during the wait cancels it
      await page.mouse.move(400, 500);
      await expect(tip).not.toHaveAttribute('data-tip-show', '');
      await page.waitForTimeout(260);           // let the warm window lapse
      await page.mouse.move(110, 110);
      await page.waitForTimeout(80);
      await page.mouse.move(400, 500);
      await page.waitForTimeout(260);
      expect(await shown(page), 'a pass-through never showed').toBe(false);
    });

    test('waits 150ms on a cold hover by default', async ({ page }) => {
      await mountBare(page, `<button class="t" style="left:100px;top:100px" data-tip="A">A</button>`, '{}');
      await page.mouse.move(10, 10);
      await page.mouse.move(150, 120);
      await page.waitForTimeout(60);
      expect(await shown(page), 'nothing at 60ms').toBe(false);
      await page.waitForTimeout(200);
      expect(await shown(page), 'up by 260ms').toBe(true);
    });

    test('re-fills when the trigger changes its words while the pill is up', async ({ page }) => {
      await mountBare(page, `<button class="t" id="a" style="left:100px;top:100px" data-tip="Copy">Copy</button>`);
      const tip = page.locator('.hah-tip');
      await page.mouse.move(150, 120);
      await expect(tip).toHaveText('Copy');
      const before = (await tip.boundingBox()).width;

      await page.evaluate(() => {
        document.getElementById('a').setAttribute('data-tip', 'Copied to the clipboard');
      });
      await expect(tip).toHaveText('Copied to the clipboard');
      await settle(page);
      expect((await tip.boundingBox()).width, 're-measured for the longer text').toBeGreaterThan(before);
      expect(await shown(page), 'and never blinked out').toBe(true);

      // emptying it takes the pill down rather than leaving a blank one
      await page.evaluate(() => document.getElementById('a').setAttribute('data-tip', ''));
      await expect(tip).not.toHaveAttribute('data-tip-show', '');
    });

    test('losing the window takes the pill down', async ({ page }) => {
      await mountBare(page, `<button class="t" style="left:100px;top:100px" data-tip="Stranded?">A</button>`);
      const tip = page.locator('.hah-tip');
      await page.mouse.move(150, 120);
      await expect(tip).toHaveAttribute('data-tip-show', '');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await expect(tip).not.toHaveAttribute('data-tip-show', '');

      await page.mouse.move(400, 500);   // out, then back in: a fresh mouseover
      await page.mouse.move(160, 125);
      await expect(tip).toHaveAttribute('data-tip-show', '');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(tip).not.toHaveAttribute('data-tip-show', '');
    });

    test('data-tip-key renders a chip the screen reader can still read', async ({ page }) => {
      await mountBare(page, `<button class="t" style="left:100px;top:100px" data-tip="Bold" data-tip-key="⌘B">B</button>`);
      const tip = page.locator('.hah-tip');
      await page.mouse.move(150, 120);
      await expect(tip).toHaveAttribute('data-tip-show', '');
      await expect(tip.locator('kbd.hah-tip__key')).toHaveText('⌘B');
      expect(await tip.textContent(), 'a space between the words and the key').toBe('Bold\u00a0⌘B');
      const bg = await tip.locator('kbd').evaluate((k) => getComputedStyle(k).backgroundColor);
      expect(bg, 'the chip is tinted, not transparent').not.toBe('rgba(0, 0, 0, 0)');
    });

    test('data-tip-overflow only speaks up when the text is actually clipped', async ({ page }) => {
      await mountBare(page, `
        <div id="cut" style="position:absolute;left:100px;top:100px;width:80px;height:40px;overflow:hidden;white-space:nowrap" data-tip-overflow>A name that is far too long for the cell</div>
        <div id="fits" style="position:absolute;left:100px;top:200px;width:300px;height:40px;overflow:hidden;white-space:nowrap" data-tip-overflow>Short</div>
        <div id="own" style="position:absolute;left:100px;top:300px;width:80px;height:40px;overflow:hidden;white-space:nowrap" data-tip-overflow data-tip="The full text, spelled out">Truncated too</div>
      `);
      const tip = page.locator('.hah-tip');
      await page.mouse.move(140, 120);
      await expect(tip).toHaveText('A name that is far too long for the cell');
      await page.mouse.move(140, 220);
      await expect(tip).not.toHaveAttribute('data-tip-show', '');
      await page.mouse.move(140, 320);
      await expect(tip).toHaveText('The full text, spelled out');
    });

    test('lifts a native title so the browser never shows its own', async ({ page }) => {
      await mountBare(page, `<img class="t" id="i" style="left:100px;top:100px" title="A caption the page already had" alt="">`,
        "{ selector: '[data-tip], [title]' }");
      const tip = page.locator('.hah-tip');
      await page.mouse.move(150, 120);
      await expect(tip).toHaveText('A caption the page already had');
      const img = page.locator('#i');
      await expect(img).not.toHaveAttribute('title', /./);
      await expect(img).toHaveAttribute('data-tip', 'A caption the page already had');
    });

    test('a disabled button still gets a tooltip', async ({ page }) => {
      await mountBare(page, `<button class="t" style="left:100px;top:100px" disabled data-tip="Pick something first">Save</button>`);
      const tip = page.locator('.hah-tip');
      await page.mouse.move(10, 10);
      await page.mouse.move(150, 120);
      await page.mouse.move(155, 122);
      await expect(tip).toHaveText('Pick something first');
    });

    test('a long press asks, a tap acts', async ({ browser }) => {
      // A phone: no hover, coarse pointer, so the instance takes its touch path.
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      });
      const page = await ctx.newPage();
      await mountBare(page, `
        <button class="t" id="a" style="left:100px;top:300px" data-tip="Share this doc">Share</button>
        <script>window.clicks = 0; document.getElementById('a').addEventListener('click', () => window.clicks++);</script>
      `, "{ touch: 'press' }");
      expect(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)).toBe(false);
      const tip = page.locator('.hah-tip');
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      });

      // hold: nothing at first, then the pill, above the button, and no click
      await touch('touchStart', 160, 320);
      await page.waitForTimeout(150);
      expect(await shown(page), 'not on a short hold').toBe(false);
      await expect(tip).toHaveAttribute('data-tip-show', '');
      await expect(page.locator('#a')).toHaveAttribute('data-tip-press', '');
      await settle(page);
      const box = await tip.boundingBox();
      const anchor = await page.locator('#a').boundingBox();
      expect(box.y + box.height, 'the pill sits above the finger').toBeLessThanOrEqual(anchor.y);
      await touch('touchEnd', 160, 320);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => window.clicks), 'the hold did not press the button').toBe(0);
      await expect(page.locator('#a')).not.toHaveAttribute('data-tip-press', '');
      expect(await shown(page), 'letting go leaves it up').toBe(true);

      // a tap somewhere else takes it down
      await touch('touchStart', 300, 700); await touch('touchEnd', 300, 700);
      await expect(tip).not.toHaveAttribute('data-tip-show', '');

      // a plain tap on the button is a plain tap
      await touch('touchStart', 160, 320); await touch('touchEnd', 160, 320);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => window.clicks), 'the tap reached the button').toBe(1);
      expect(await shown(page), 'and raised no pill').toBe(false);

      // a finger that moves is scrolling, not asking
      await touch('touchStart', 160, 320);
      await touch('touchMove', 160, 360);
      await page.waitForTimeout(500);
      expect(await shown(page), 'a moved finger is a scroll').toBe(false);
      await touch('touchEnd', 160, 360);
      await ctx.close();
    });

    test('show(el) raises the pill by hand, hide() takes it down', async ({ page }) => {
      await mountBare(page, `<button class="t" id="a" style="left:100px;top:300px" data-tip="Copied!">Copy</button>`);
      const tip = page.locator('.hah-tip');
      await page.mouse.move(10, 10);
      await page.evaluate(() => window.tip.show(document.getElementById('a')));
      await expect(tip).toHaveAttribute('data-tip-show', '');
      await expect(tip).toHaveText('Copied!');
      await settle(page);
      const box = await tip.boundingBox();
      const anchor = await page.locator('#a').boundingBox();
      expect(box.y + box.height, 'anchored above, like a tap').toBeLessThanOrEqual(anchor.y);
      await page.evaluate(() => window.tip.hide());
      await expect(tip).not.toHaveAttribute('data-tip-show', '');
    });

    test('by default a long press asks on a button and leaves a link alone', async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      });
      const page = await ctx.newPage();
      await mountBare(page, `
        <button class="t" id="b" style="left:100px;top:300px" data-tip="Share this doc">Share</button>
        <a class="t" id="l" href="#x" style="left:100px;top:500px;display:block" data-tip="The pricing page">Pricing</a>
      `, '{}');
      const tip = page.locator('.hah-tip');
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      });

      await touch('touchStart', 160, 320);
      await expect(tip).toHaveAttribute('data-tip-show', '');
      await touch('touchEnd', 160, 320);
      await touch('touchStart', 300, 700); await touch('touchEnd', 300, 700);
      await expect(tip).not.toHaveAttribute('data-tip-show', '');

      await touch('touchStart', 160, 520);
      await page.waitForTimeout(600);
      expect(await shown(page), 'a link keeps its own long press').toBe(false);
      await touch('touchEnd', 160, 520);
      // and the link still reaches a screen reader without a pill
      await expect(page.locator('#l')).toHaveAttribute('aria-describedby', /hah-tip/);
      await expect(page.locator('#b')).not.toHaveAttribute('aria-describedby', /./);
      await ctx.close();
    });
  });
}

/** @returns {string} a reason to skip, or '' when a browser is available. */
function browsersMissing(chromium) {
  try {
    const bin = chromium.executablePath();
    return existsSync(bin) ? '' : 'Playwright browsers not installed (npx playwright install chromium)';
  } catch (err) {
    return `Playwright browsers unavailable (${err.message.split('\n')[0]})`;
  }
}
