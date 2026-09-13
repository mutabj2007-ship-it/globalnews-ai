import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { INSTRUMENTED_PRODUCT_EVENT_NAMES } from './admin-analytics.contract';

/**
 * ADMIN-03 — the guard that keeps the instrumentation disclosure TRUE.
 *
 * The analytics contract ships two lists: the product events that have
 * an emitter, and the ones that do not. The screen uses them to say, in
 * as many words, that client interaction telemetry is not fully
 * instrumented and that the recorded events are therefore not a complete
 * picture of feature usage.
 *
 * A HAND-MAINTAINED LIST OF THAT KIND ROTS, AND WHEN IT ROTS IT LIES IN
 * THE OPTIMISTIC DIRECTION. Somebody wires an emitter, nobody edits the
 * contract, and the screen keeps disclosing a gap that has closed --
 * or, far worse, the reverse: an emitter is removed and the screen keeps
 * promising data that stopped arriving. So the list is not trusted. It
 * is RE-DERIVED here from the emitter call sites on every run, and the
 * spec fails until the contract matches the code.
 *
 * This is the same instrument F0 used to correct the design's provenance
 * tags: do not ask what the code is supposed to do, read what it does.
 */
const BACKEND_SRC = join(__dirname, '..', '..', '..');
const REPO_ROOT = join(BACKEND_SRC, '..', '..');
const SCHEMA = join(BACKEND_SRC, '..', 'prisma', 'schema.prisma');

function collect(dir: string, keep: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // The generated Prisma client is machine output, not product code.
      return entry.name === 'generated' || entry.name === 'node_modules' ? [] : collect(full, keep);
    }
    return entry.isFile() && keep(entry.name) ? [full] : [];
  });
}

/** Product source only. A spec may name any event; a spec emits nothing. */
const backendProductFiles = (): string[] =>
  collect(BACKEND_SRC, (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));

/**
 * Every event name passed as a LITERAL to a server-side emitter.
 *
 * The public ingest path is deliberately not counted here: its name
 * argument comes from the request body, so it emits whatever a caller
 * sends and nothing about the source says which names those are. Whether
 * that path contributes anything at all is the separate question the
 * next test asks.
 */
function serverEmittedEventNames(): string[] {
  const found = new Set<string>();
  for (const file of backendProductFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/record(?:Product|Account)Event\(\s*'([a-z_]+)'/g)) {
      found.add(match[1]);
    }
  }
  return [...found].sort();
}

/** The twelve names, read from the schema rather than transcribed. */
function schemaEventNames(): string[] {
  const source = readFileSync(SCHEMA, 'utf8');
  const start = source.indexOf('enum ProductEventName {');
  expect(start).toBeGreaterThan(-1);
  const block = source.slice(start, source.indexOf('}', start));
  return block
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+$/.test(line))
    .sort();
}

describe('ADMIN-03 — the instrumentation disclosure is re-derived, never trusted', () => {
  it('finds backend product source to scan', () => {
    expect(backendProductFiles().length).toBeGreaterThan(50);
  });

  it('the declared instrumented list is EXACTLY the set with a server-side emitter', () => {
    expect(([...INSTRUMENTED_PRODUCT_EVENT_NAMES] as string[]).sort()).toEqual(
      serverEmittedEventNames(),
    );
  });

  it('the schema declares twelve event names, and the disclosure covers all of them', () => {
    const schema = schemaEventNames();
    expect(schema).toHaveLength(12);

    const instrumented = ([...INSTRUMENTED_PRODUCT_EVENT_NAMES] as string[]).sort();
    const uninstrumented = schema.filter((name) => !instrumented.includes(name));

    expect(instrumented.every((name) => schema.includes(name))).toBe(true);
    expect([...instrumented, ...uninstrumented].sort()).toEqual(schema);
    // Seven of twelve. Recorded as a number so that closing the gap has
    // to be a deliberate edit here rather than a silent drift.
    expect(uninstrumented).toHaveLength(7);
  });

  /**
   * THE FINDING THIS SPEC EXISTS TO PIN.
   *
   * POST /events is built, rate limited and privacy reviewed -- and no
   * client calls it. That is why seven event names cannot appear in the
   * table at all, and it is the entire reason the screen may not present
   * recorded events as feature usage.
   *
   * When a client emitter IS wired, this test fails. That failure is the
   * point: it is the moment the disclosure on the screen stops being
   * true, and it should not be possible to reach it quietly.
   */
  it('no frontend source posts to the public ingest endpoint -- the seven client names have no producer', () => {
    const frontendSrc = join(REPO_ROOT, 'frontend', 'src');
    expect(existsSync(frontendSrc)).toBe(true);

    const files = collect(
      frontendSrc,
      (name) => /\.(ts|tsx)$/.test(name) && !name.includes('.spec.'),
    );
    expect(files.length).toBeGreaterThan(50);

    const callers = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /['"`]\/events['"`]|\/events['"`]\s*,|fetch\([^)]*\/events/.test(source);
    });

    expect(callers).toEqual([]);
  });

  it('none of the seven uninstrumented names is referenced anywhere in the frontend either', () => {
    const frontendSrc = join(REPO_ROOT, 'frontend', 'src');
    const files = collect(
      frontendSrc,
      (name) => /\.(ts|tsx)$/.test(name) && !name.includes('.spec.'),
    );

    const instrumented = [...INSTRUMENTED_PRODUCT_EVENT_NAMES] as string[];
    const uninstrumented = schemaEventNames().filter((name) => !instrumented.includes(name));

    const referenced = uninstrumented.filter((name) =>
      files.some((file) => new RegExp(`['"\`]${name}['"\`]`).test(readFileSync(file, 'utf8'))),
    );

    expect(referenced).toEqual([]);
  });
});
