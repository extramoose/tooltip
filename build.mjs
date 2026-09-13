// Two artifacts, one source of truth (index.js):
//   dist/tooltip.global.js - minified IIFE for the single <script> tag. A classic
//     script sets document.currentScript, so index.js auto-initialises and the
//     styles inject themselves; Tooltip.createTooltip() is there for options.
//   dist/tooltip.css - the `css` export written verbatim, for anyone running a
//     strict style-src and passing injectStyles: false.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as esbuild from 'esbuild';
import { css } from './index.js';

const root = import.meta.dirname;
const dist = join(root, 'dist');

await mkdir(dist, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'auto.js')],
  outfile: join(dist, 'tooltip.global.js'),
  bundle: true,
  format: 'iife',
  globalName: 'Tooltip',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
});

await writeFile(join(dist, 'tooltip.css'), css);

console.log('built dist/tooltip.global.js and dist/tooltip.css');
