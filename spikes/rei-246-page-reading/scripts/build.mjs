import { cp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const outdir = new URL('../dist/extension/', import.meta.url);
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await build({
  entryPoints: [new URL('../src/content.js', import.meta.url).pathname],
  bundle: true,
  format: 'iife',
  outfile: new URL('../dist/extension/content.js', import.meta.url).pathname,
});
for (const file of ['manifest.json', 'popup.html', 'popup.js', 'popup.css']) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(`../dist/extension/${file}`, import.meta.url));
}
