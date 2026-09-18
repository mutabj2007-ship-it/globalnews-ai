import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * THE FIXTURE ISOLATION GATE — ALPHA-VISUAL-SUPPORT-FIXTURE-ISOLATION-R2 §3.
 *
 * THE CLAIM UNDER TEST: nothing a live reader of /support can reach imports the
 * fixture adapter, and no fixture publisher name can appear on their screen.
 *
 * WHY THIS IS A REACHABILITY TEST AND NOT A GREP.
 *
 * `createMockConversationAdapter` is ALLOWED to exist. It is allowed to be
 * imported, named and exercised — by the specs in this directory, by stories and
 * by the evidence harness, which are how the fifteen UI states stay reviewable
 * while the transport is unbuilt. A repository-wide grep for the name therefore
 * cannot be the gate: it would fail on legitimate code, and the only way to make
 * it pass again would be to delete the mock or to teach the gate a list of
 * exceptions — a list someone eventually adds a live file to.
 *
 * What is forbidden is not the mock's existence but its REACHABILITY. So this
 * walks the real import graph from the live entry point — `app/support/page.tsx`,
 * the file Next.js renders for the route — resolving every specifier the way the
 * bundler does, and asserts over the closure it arrives at. A file is in the live
 * graph if and only if some chain of imports from that page reaches it.
 *
 * That makes the gate fail for the RIGHT reason. Re-introducing the old default
 * fails it, because `SupportConversation.tsx` would import `mockAdapter.ts` and
 * the mock would enter the closure — which is the defect itself rather than a
 * proxy for it. A spec importing the mock does not fail it, because no live file
 * imports a spec.
 *
 * THE FIRST ASSERTIONS ARE ABOUT THE HARNESS. A walker that silently resolved
 * nothing would pass every prohibition below while proving the opposite of what
 * it claims, so it is made to show it found the surface it is searching.
 */

const FRONTEND_SRC = resolve(__dirname, '..', '..', '..');
const LIVE_ENTRY = join(FRONTEND_SRC, 'app', 'support', 'page.tsx');

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const;

/** Every `from '...'`, plus dynamic `import('...')` and `require('...')`. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function resolveModule(specifier: string, fromFile: string): string | null {
  /*
    `@/` is the alias for `src/`, resolved here exactly as `jest.config.js` and
    `tsconfig.json` resolve it. A relative specifier resolves against its
    importer. Anything else is a package and leaves this repository.
  */
  let base: string;
  if (specifier.startsWith('@/')) {
    base = join(FRONTEND_SRC, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null;
  }

  for (const extension of EXTENSIONS) {
    if (existsSync(base + extension)) return base + extension;
  }
  for (const extension of EXTENSIONS) {
    const indexed = join(base, `index${extension}`);
    if (existsSync(indexed)) return indexed;
  }
  return existsSync(base) && /\.[a-z]+$/.test(base) ? base : null;
}

interface Graph {
  readonly files: readonly string[];
  /** Local-looking specifiers that did not resolve. Must be empty — see below. */
  readonly unresolved: readonly string[];
}

function liveGraph(entry: string): Graph {
  const seen = new Set<string>();
  const unresolved: string[] = [];
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = stripComments(readFileSync(file, 'utf-8'));
    SPECIFIER.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SPECIFIER.exec(source)) !== null) {
      const specifier = match[1];
      const resolved = resolveModule(specifier, file);
      if (resolved === null) {
        /*
          A bare specifier is a package. Anything that LOOKS local and does not
          resolve is REPORTED rather than ignored: a walker that quietly drops
          edges under-reports the graph, and under-reporting is the one failure
          mode that would make this gate lie in the dangerous direction.
        */
        if (specifier.startsWith('.') || specifier.startsWith('@/')) {
          unresolved.push(`${relative(FRONTEND_SRC, file)} -> ${specifier}`);
        }
        continue;
      }
      queue.push(resolved);
    }
  }

  return { files: [...seen], unresolved };
}

const rel = (file: string): string => relative(FRONTEND_SRC, file).split(sep).join('/');

const GRAPH = liveGraph(LIVE_ENTRY);
const LIVE_RELATIVE = GRAPH.files.map(rel);
const LIVE_SOURCE: ReadonlyArray<{ readonly file: string; readonly source: string }> =
  GRAPH.files.map((file) => ({ file: rel(file), source: readFileSync(file, 'utf-8') }));

describe('the walker is a real walker before it is a gate', () => {
  it('the live entry point exists — it is the file Next.js renders for /support', () => {
    expect(existsSync(LIVE_ENTRY)).toBe(true);
  });

  it('the graph actually reached the Support surface it claims to be searching', () => {
    expect(LIVE_RELATIVE).toContain('components/support/SupportScreen.tsx');
    expect(LIVE_RELATIVE).toContain('components/support/conversation/SupportConversation.tsx');
    expect(LIVE_RELATIVE).toContain('components/support/conversation/TranscriptTurn.tsx');
    expect(LIVE_RELATIVE).toContain('lib/support/conversation/projection.ts');
    expect(LIVE_RELATIVE.length).toBeGreaterThan(10);
  });

  it('every local import in the live graph resolved — no edge was silently dropped', () => {
    expect(GRAPH.unresolved).toEqual([]);
  });

  it('no spec file is part of the live graph', () => {
    expect(LIVE_RELATIVE.filter((file) => file.includes('.spec.'))).toEqual([]);
  });
});

describe('§3 — the production /support graph cannot reach the fixtures', () => {
  it('mockAdapter.ts is NOT reachable from app/support/page.tsx', () => {
    expect(LIVE_RELATIVE).not.toContain('lib/support/conversation/mockAdapter.ts');
    expect(LIVE_RELATIVE.filter((file) => /mock|fixture/i.test(file))).toEqual([]);
  });

  it('no file in the live graph imports or calls createMockConversationAdapter', () => {
    const offenders = LIVE_SOURCE.filter(({ source }) => {
      /*
        The prohibition is on REACHING it. Prose explaining why the live path
        must not reach the mock is the documentation of this rule, not a breach
        of it, so only executable references count.
      */
      const executable = stripComments(source);
      return executable.includes('createMockConversationAdapter');
    }).map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('no fixture publisher name exists anywhere in the live graph', () => {
    for (const name of ['Fixture Wire Service', 'Fixture Regional Daily', 'fixture-operator']) {
      const offenders = LIVE_SOURCE.filter(({ source }) => source.includes(name)).map((f) => f.file);
      expect({ name, offenders }).toEqual({ name, offenders: [] });
    }
  });

  it('the live graph carries exactly one adapter implementation, named in the page', () => {
    const screen = LIVE_SOURCE.find((f) => f.file === 'components/support/SupportScreen.tsx');
    expect(screen).toBeDefined();
    expect(stripComments(screen?.source ?? '')).toContain('createNoTransportAdapter');
    expect(LIVE_RELATIVE).toContain('lib/support/conversation/noTransportAdapter.ts');
  });

  it('the live screen PASSES the adapter at the call site, not merely nearby', () => {
    /*
      CONSTRUCTING the adapter and FORGETTING to hand it over are different
      mistakes, and the second one is the original defect in miniature: before
      this patch `SupportScreen` rendered `<SupportConversation t locale />` and
      the missing prop silently selected the fixtures.

      `tsc` catches it now — the prop is required, so omitting it is TS2741 —
      but this suite does not type-check `SupportScreen.tsx`: no spec imports it
      as a module, only as text. Without the assertion below the jest gate would
      stay green while the live surface lost its adapter, which is precisely the
      class of silence this whole patch exists to remove. So the call site is
      checked here too, and the two gates fail independently.
    */
    const screen = LIVE_SOURCE.find((f) => f.file === 'components/support/SupportScreen.tsx');
    const source = stripComments(screen?.source ?? '');

    const callSites = source.match(/<SupportConversation[\s\S]*?\/>/g) ?? [];
    expect(callSites.length).toBeGreaterThan(0);
    for (const callSite of callSites) {
      expect({ callSite, passesAdapter: /\badapter\s*=\s*\{/.test(callSite) }).toEqual({
        callSite,
        passesAdapter: true,
      });
    }
  });

  it('SupportConversation has no adapter default — an omission cannot select one', () => {
    const surface = LIVE_SOURCE.find(
      (f) => f.file === 'components/support/conversation/SupportConversation.tsx',
    );
    expect(surface).toBeDefined();
    const source = stripComments(surface?.source ?? '');
    expect(source).toContain('adapter: SupportConversationAdapter');
    expect(source).not.toContain('adapter?:');
    expect(source).not.toMatch(/adapter\s*\?\?/);
  });

  it('the boundary is NOT NODE_ENV — no live Support file branches on the environment', () => {
    const supportFiles = LIVE_SOURCE.filter((f) => /support/i.test(f.file));
    expect(supportFiles.length).toBeGreaterThan(3);
    for (const { file, source } of supportFiles) {
      expect({ file, usesNodeEnv: /NODE_ENV/.test(stripComments(source)) }).toEqual({
        file,
        usesNodeEnv: false,
      });
    }
  });

  it('POSITIVE CONTROL — the walker DOES see the mock when something reaches it', () => {
    /*
      Re-run from files that do import the mock. If these closures did not
      contain `mockAdapter.ts` the walker could not see the edge it exists to
      see, and every prohibition above would be passing vacuously.
    */
    const direct = liveGraph(join(FRONTEND_SRC, 'lib', 'support', 'conversation', 'mockAdapter.ts'));
    expect(direct.files.map(rel)).toContain('lib/support/conversation/mockAdapter.ts');

    const viaSpec = liveGraph(join(__dirname, 'conversationSurface.spec.ts')).files.map(rel);
    expect(viaSpec).toContain('lib/support/conversation/mockAdapter.ts');
    expect(viaSpec).toContain('components/support/conversation/SupportConversation.tsx');
  });
});

describe('the mock remains available to harnesses that import it deliberately', () => {
  it('mockAdapter.ts still exists and still exports its factory', () => {
    const mock = join(FRONTEND_SRC, 'lib', 'support', 'conversation', 'mockAdapter.ts');
    expect(existsSync(mock)).toBe(true);
    expect(readFileSync(mock, 'utf-8')).toContain('export function createMockConversationAdapter');
  });
});
