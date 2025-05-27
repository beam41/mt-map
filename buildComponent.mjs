import * as esbuild from 'esbuild';
import { copyFileSync } from 'fs';
import { minify } from 'terser';
import { writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { gzipSizeFromFile } from 'gzip-size';
import { stat } from 'fs/promises';

const dev = process.argv.some((arg) => {
  return arg === '--dev';
});

const files = ['map'];

const result = await esbuild.build({
  entryPoints: files.map((f) => `./components/${f}.ts`),
  bundle: true,
  platform: 'browser',
  tsconfig: './tsconfig.json',
  write: false,
  format: 'esm',
  sourcemap: false,
  loader: {
    '.svg': 'text',
  },
});

const minified = await Promise.all(
  result.outputFiles.map(async (r) =>
    dev
      ? { code: r.text }
      : await minify(r.text, {
          ecma: 2020,
          sourceMap: false,
          module: true,
          compress: {
            passes: 2,
          },
        }),
  ),
);

minified.forEach((output, i) => {
  writeFileSync(`./dist/${files[i]}.js`, output.code, 'utf8');
});

copyFileSync('./components/map.png', './dist/map.png');
copyFileSync('./components/road.svg', './dist/road.svg');

const resultFile = readdirSync('./dist', {withFileTypes: true})
  .filter((f) => f.isFile())
  .map((f) => f.name);
const longestFileName = resultFile.reduce((a, c) => Math.max(a, c.length), 0);

console.log(`${dev ? 'Dev' : 'Prod'} build complete`);
const fileStat = await Promise.all(
  resultFile.map(async (file) => {
    const [fStat, gzipSize] = await Promise.all([stat(join('./dist', file)), gzipSizeFromFile(join(import.meta.dirname,'./dist', file))]);
    return (
      file.padEnd(longestFileName) + ' ' + (fStat.size / 1024).toFixed(2) + '/' + (gzipSize / 1024).toFixed(2) + ' kb'
    );
  }),
);
console.log(fileStat.join('\n'));
