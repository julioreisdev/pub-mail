// Minifica os scripts do plugin (assets/src → assets/*.min.js) e mostra os tamanhos.
import { buildSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const A = new URL('../tradutor-invisivel/assets/', import.meta.url).pathname;
for (const [name, target] of [['boot', 'es2015'], ['trinv', 'es2017'], ['warm-admin', 'es2017']]) {
  buildSync({ entryPoints: [`${A}src/${name}.js`], outfile: `${A}${name}.min.js`, minify: true, target, charset: 'ascii', logLevel: 'warning' });
  const buf = readFileSync(`${A}${name}.min.js`);
  console.log(`${name}.min.js: ${buf.length} bytes (gzip ${gzipSync(buf).length})`);
}
if (!readFileSync(`${A}boot.min.js`, 'utf8').includes('__TRINV_CFG__')) throw new Error('boot.min.js perdeu o marcador __TRINV_CFG__');
