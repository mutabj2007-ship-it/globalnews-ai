import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../dictionaries/en';
import { pl } from '../dictionaries/pl';
import { ACTIVE_LANGUAGES } from '../languages';
import { ar, de, es, fr, pt } from './recoveredCatalogue';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 §11 — the per-language readiness matrix, MEASURED.
 *
 * UI coverage = the share of today's English leaf strings (by key path) that the locale's
 * catalogue carries as a non-empty value. A locale is never called complete on navigation alone:
 * the matrix also states Ask understanding, retrieval and answer readiness from the code facts
 * pinned below. `LANGUAGE_READINESS_OUT=<file>` writes the matrix for the delivery package.
 */
type Tree = { readonly [key: string]: unknown };

function leaves(tree: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (tree === null || typeof tree !== 'object' || Array.isArray(tree)) return out;
  for (const [key, value] of Object.entries(tree as Tree)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    const isPlural =
      value !== null && typeof value === 'object' && !Array.isArray(value) && 'other' in (value as Tree);
    if (typeof value === 'string' || typeof value === 'function' || isPlural || Array.isArray(value)) {
      out.set(path, value);
    } else {
      for (const [p, v] of leaves(value, path)) out.set(p, v);
    }
  }
  return out;
}

const present = (value: unknown): boolean =>
  (typeof value === 'string' && value.trim().length > 0) ||
  typeof value === 'function' ||
  Array.isArray(value) ||
  (value !== null && typeof value === 'object');

const english = leaves(en);
const namespaces = [...new Set([...english.keys()].map((k) => k.split('.')[0]))].sort();

function coverage(catalogue: unknown) {
  const own = leaves(catalogue);
  const byNamespace: Record<string, { covered: number; total: number }> = {};
  let covered = 0;
  for (const [path] of english) {
    const ns = path.split('.')[0];
    byNamespace[ns] ??= { covered: 0, total: 0 };
    byNamespace[ns].total += 1;
    if (present(own.get(path))) {
      byNamespace[ns].covered += 1;
      covered += 1;
    }
  }
  return { covered, total: english.size, byNamespace };
}

const CATALOGUES: Record<string, unknown> = { pl, fr, de, es, pt, ar, sw: {}, rw: {} };
const matrix = Object.fromEntries(
  Object.entries(CATALOGUES).map(([lang, catalogue]) => [lang, coverage(catalogue)]),
);

/* Code facts, read from the source so the matrix cannot drift from the system. */
const backend = (...p: string[]) =>
  readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'backend', 'src', ...p), 'utf8');
const askDtoLanguages = /@IsIn\(\[([^\]]*)\]\)/.exec(backend('modules', 'ask-v2', 'ask-v2.dto.ts'))?.[1] ?? '';
const knowledgeLanguages = /language !== 'en' && language !== 'pl'/.test(
  backend('modules', 'ask-router', 'knowledge-requirement.ts'),
);

describe('§11 — recovered catalogues are measured, never trusted, and never widen the offer', () => {
  it('English/Polish stay the only selectable languages', () => {
    expect(ACTIVE_LANGUAGES).toEqual(['en', 'pl']);
    const index = readFileSync(join(__dirname, '..', 'dictionaries', 'index.ts'), 'utf8');
    expect(index).not.toMatch(/recovered/);
  });

  it('Polish is complete against today’s English (the regression floor)', () => {
    expect(matrix.pl.covered).toBe(matrix.pl.total);
  });

  it('each recovered catalogue covers a large, measured share — and none is complete today', () => {
    for (const lang of ['fr', 'de', 'es', 'pt', 'ar']) {
      expect(matrix[lang].covered / matrix[lang].total).toBeGreaterThan(0.4);
      expect(matrix[lang].covered).toBeLessThan(matrix[lang].total);
    }
    expect(matrix.sw.covered).toBe(0);
    expect(matrix.rw.covered).toBe(0);
  });

  it('Ask itself understands and answers only English and Polish today (code fact)', () => {
    expect(askDtoLanguages.replace(/\s/g, '')).toBe("'en','pl'");
    expect(knowledgeLanguages).toBe(true);
  });

  afterAll(() => {
    const out = process.env.LANGUAGE_READINESS_OUT;
    if (out === undefined) return;
    const pct = (c: { covered: number; total: number }) =>
      `${((100 * c.covered) / c.total).toFixed(1)}% (${c.covered}/${c.total})`;
    const rows = Object.entries(matrix).map(([lang, c]) => {
      const nsGaps = Object.entries(c.byNamespace)
        .filter(([, n]) => n.covered < n.total)
        .map(([ns, n]) => `${ns} ${n.covered}/${n.total}`)
        .join('; ');
      const askReady = lang === 'pl' ? 'YES (EN/PL governed)' : 'NO — Ask DTO accepts en/pl only';
      return `| ${lang} | ${pct(c)} | ${askReady} | ${lang === 'pl' ? 'YES' : 'NOT VERIFIED'} | ${lang === 'pl' ? 'YES' : 'NOT EVALUATED'} | ${nsGaps || '—'} |`;
    });
    writeFileSync(
      out,
      [
        `# Language readiness matrix (measured ${new Date().toISOString().slice(0, 10)})`,
        '',
        `English leaf strings: ${english.size} across ${namespaces.length} namespaces.`,
        '',
        '| Locale | UI coverage | Ask understanding + answer language | Retrieval | Answer quality | Namespaces with gaps |',
        '|---|---|---|---|---|---|',
        ...rows,
        '',
      ].join('\n'),
    );
  });
});
