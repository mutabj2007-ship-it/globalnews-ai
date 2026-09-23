import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import ts from 'typescript';

const root = resolve(__dirname, '../..');
const entry = resolve(root, 'components/conflict/ConflictDashboard.tsx');

/** Follow repository imports, including shared barrels, instead of checking only the entry file. */
function conflictGraph(): Map<string, string> {
  const graph = new Map<string, string>();
  const visit = (file: string) => {
    if (graph.has(file)) return;
    const source = readFileSync(file, 'utf8');
    graph.set(file, source);
    for (const imp of ts.preProcessFile(source).importedFiles) {
      const name = imp.fileName;
      const base = name.startsWith('@/')
        ? resolve(root, name.slice(2))
        : name === '@globalnews-ai/shared'
          ? resolve(root, '../../shared/src/index')
          : name.startsWith('.')
            ? resolve(dirname(file), name)
            : null;
      if (!base || /\.(css|json)$/.test(base)) continue;
      const target = [base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'].find(
        existsSync,
      );
      if (!target) throw new Error('Unresolved repository import: ' + name + ' in ' + file);
      visit(target);
    }
  };
  visit(entry);
  return graph;
}

describe('Conflict browser network boundary', () => {
  it('has no localhost backend or environment-origin resolver anywhere in its repository module graph', () => {
    const graph = conflictGraph();
    expect(graph.size).toBeGreaterThan(20);
    for (const [file, source] of graph) {
      expect({
        file,
        forbidden:
          /http:\/\/localhost:4000|resolveApiBaseUrl|NEXT_PUBLIC_API_URL|SERVER_INTERNAL_API_URL/.test(
            source,
          ),
      }).toEqual({ file, forbidden: false });
    }
  });
  it('loads retained evidence through a relative public path without auth or producer clients', () => {
    const source = readFileSync(entry, 'utf8');
    expect(source.match(/\bfetch\(/g)).toHaveLength(1);
    expect(source).toContain("fetch('/conflict-data/observations?limit=500', {");
    expect(source).not.toMatch(
      /credentials:|Authorization|\/api\/|\/analysis|\/news|\/ucdp|provider|producer/i,
    );
  });
});
