// The user-named converged implementation is frozen visual authority for this lane.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = 'e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a';
const roots = [
  'frontend/src/components/economy', 'frontend/src/components/delivery',
  'frontend/src/app/imihigo', 'frontend/src/app/economy-visual-preview',
];
const guards = [
  'frontend/src/lib/imihigo/retained.spec.ts',
  'frontend/src/lib/economy/econContract.spec.ts',
  'frontend/src/lib/economy/b4aEconomySubstrate.spec.ts',
  'frontend/src/lib/economy/econContrast.spec.ts',
  'frontend/src/lib/economy/economyConfig.ts',
];
const git = (...args) => execFileSync('git', args);
const paths = git('ls-tree', '-r', '--name-only', base, '--', ...roots, ...guards).toString().trim().split('\n');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = bytes => Buffer.from(bytes.toString().replace(/\r\n/g, '\n'));
const results = paths.map(path => {
  const expected = git('show', `${base}:${path}`);
  const actual = readFileSync(path);
  return { path, exactGitBlob: hash(expected) === hash(normalize(actual)), sha256: hash(normalize(actual)) };
});
const actualPaths = roots.flatMap(root => readdirSync(root, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile()).map(entry => `${entry.parentPath || entry.path}/${entry.name}`.replaceAll('\\', '/')));
const extra = actualPaths.filter(path => !paths.includes(path));
const failed = results.filter(result => !result.exactGitBlob);
console.log(JSON.stringify({ base, files: results.length, drift: failed, extra, results }, null, 2));
if (failed.length || extra.length) process.exitCode = 1;
