// Plan B permits data/copy/interaction binding, not geometry or frozen-guard changes.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const base = 'e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a';
const roots = ['frontend/src/components/economy', 'frontend/src/components/delivery', 'frontend/src/app/imihigo', 'frontend/src/app/economy-visual-preview'];
const guards = ['frontend/src/lib/imihigo/retained.spec.ts', 'frontend/src/lib/economy/econContract.spec.ts', 'frontend/src/lib/economy/b4aEconomySubstrate.spec.ts', 'frontend/src/lib/economy/econContrast.spec.ts', 'frontend/src/lib/economy/economyConfig.ts'];
const bindings = new Set([
  'frontend/src/components/delivery/ImihigoScreen.tsx',
  'frontend/src/components/economy/EconomyScreen.tsx',
  'frontend/src/components/economy/compact/EconomyCompactScreen.tsx',
  'frontend/src/components/economy/Substrate.tsx',
  'frontend/src/components/economy/AlphaVisualPreview.tsx',
  'frontend/src/app/economy-visual-preview/page.tsx',
  'frontend/src/app/economy-visual-preview/compact/page.tsx',
]);
const git = (...args) => execFileSync('git', args).toString().replace(/\r\n/g, '\n');
const hash = text => createHash('sha256').update(text).digest('hex');
const paths = git('ls-tree', '-r', '--name-only', base, '--', ...roots, ...guards).trim().split('\n');
function geometry(text) {
  const source = ts.createSourceFile('frame.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const signature = [];
  function visit(node) {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source);
      if (['style', 'className', 'data-econ', 'data-del'].includes(name)) {
        // The only new text decoration is the existing source row's document link.
        const parent = node.parent.parent;
        const sourceLink = name === 'className' && node.initializer?.getText(source) === '"underline"'
          && (ts.isJsxOpeningElement(parent) || ts.isJsxSelfClosingElement(parent))
          && parent.tagName.getText(source) === 'a';
        if (!sourceLink) signature.push(node.getText(source).replace(/\s+/g, ' '));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return signature;
}
const results = paths.map(path => {
  const expected = git('show', `${base}:${path}`);
  const actual = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const exact = expected === actual;
  const geometryUnchanged = JSON.stringify(geometry(expected)) === JSON.stringify(geometry(actual));
  return { path, exactGitBlob: exact, geometryUnchanged, planBBinding: !exact && bindings.has(path), pass: exact || (bindings.has(path) && geometryUnchanged), sha256: hash(actual) };
});
const actualPaths = roots.flatMap(root => readdirSync(root, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile()).map(entry => `${entry.parentPath || entry.path}/${entry.name}`.replaceAll('\\', '/')));
const extra = actualPaths.filter(path => !paths.includes(path));
const failed = results.filter(result => !result.pass);
console.log(JSON.stringify({ base, files: results.length, forbiddenDrift: failed, extra, results }, null, 2));
if (failed.length || extra.length) process.exitCode = 1;
