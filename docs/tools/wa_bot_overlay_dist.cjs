// Copia back/dist e transpila (sem checagem de tipos) todo back/src por cima — para testes locais sem `nest build`.
// Uso: node overlay_dist.cjs <repo> <saida>
const fs = require('fs');
const path = require('path');
const repo = process.argv[2];
const out = process.argv[3];
const back = path.join(repo, 'back');
const ts = require(path.join(back, 'node_modules/typescript'));
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(back, 'dist'), out, { recursive: true });
const opts = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true, allowSyntheticDefaultImports: true };
let n = 0;
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (p.endsWith('.ts') && !p.endsWith('.d.ts') && !p.endsWith('.spec.ts')) {
      const rel = path.relative(back, p); // src/...
      const dst = path.join(out, rel.replace(/\.ts$/, '.js'));
      let js = ts.transpileModule(fs.readFileSync(p, 'utf8'), { compilerOptions: opts, fileName: p }).outputText;
      const toRoot = path.relative(path.dirname(dst), out) || '.';
      js = js.replace(/require\("(generated|src)\//g, (_m, w) => `require("${toRoot.split(path.sep).join('/')}/${w}/`);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, js);
      n++;
    }
  }
}
walk(path.join(back, 'src'));
console.log(`overlay: ${n} arquivos transpilados em ${out}`);
