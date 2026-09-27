import { build } from 'esbuild';
import { mkdir, stat } from 'node:fs/promises';
await mkdir('assets', { recursive: true });
await build({ entryPoints: ['src/theme.js'], outfile: 'assets/theme.js', bundle: true, format: 'iife', target: ['es2020'], minify: true, legalComments: 'eof' });
await build({ entryPoints: ['src/configurator.js'], outfile: 'assets/configurator.js', bundle: true, format: 'esm', target: ['es2020'], minify: true, legalComments: 'eof' });
for (const file of ['assets/theme.js', 'assets/configurator.js']) console.log(`${file}: ${(await stat(file)).size.toLocaleString()} bytes`);
