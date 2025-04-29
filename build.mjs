import * as esbuild from 'esbuild';
import { load } from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { minify } from 'html-minifier';

const dev = process.argv.some((arg) => {
  return arg === '--dev';
});

const result = await esbuild.build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  minify: !dev,
  platform: 'browser',
  tsconfig: './tsconfig.json',
  treeShaking: !dev,
  write: false,
  external: ['three'],
  format: 'esm',
});

const resultCss = await esbuild.build({
  entryPoints: ['./src/index.css'],
  minify: true,
  write: false,
});

const html = readFileSync('./src/index.html', { encoding: 'utf8', ignoreWhitespace: false });
const $ = load(html);

$('script[type="importmap"]').text($('script[type="importmap"]').text().replace(/\s/g, ''));

result.outputFiles.forEach((out) => {
  $('body').append(`<script type="module">${out.text}</script>`);
});

resultCss.outputFiles.forEach((out) => {
  $('head').append(`<style>${out.text}</style>`);
});

const minHtml = dev
  ? $.html()
  : minify($.html(), {
      html5: true,
      collapseWhitespace: true,
      decodeEntities: true,
      removeComments: true,
    });

if (!existsSync('./dist')) {
  mkdirSync('./dist');
}

writeFileSync('./dist/index.html', minHtml, 'utf8');

const resultFile = readdirSync('./dist');
const longestFileName = resultFile.reduce((a, c) => Math.max(a, c.length), 0);

console.log(`${dev ? 'Dev' : 'Prod'} build complete`);
resultFile.forEach((file) => {
  const fStat = statSync(join('./dist', file));
  console.log(file.padEnd(longestFileName), (fStat.size / 1024).toFixed(2) + ' kb');
});
