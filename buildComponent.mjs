import * as esbuild from 'esbuild';
import { copyFileSync } from 'fs';

const dev = process.argv.some((arg) => {
  return arg === '--dev';
});

await esbuild.build({
  entryPoints: ['./components/map.ts'],
  bundle: true,
  minify: !dev,
  platform: 'browser',
  tsconfig: './tsconfig.json',
  treeShaking: !dev,
  outdir: 'dist',
  format: 'esm',
  loader: {
    '.svg': 'text',
  },
});

copyFileSync('./components/map.png', './dist/map.png');
