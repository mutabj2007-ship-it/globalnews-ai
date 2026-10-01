import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORPUS, MAP_ORIGIN, NON_EQUIVALENT } from './l-corpus/corpus';
import { missingSeams, routeAskR2, type AskR2Route } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { resolveGeography } from '../geo/geo-resolver';
import {
  FORBIDDEN_READING_KEYS,
  normalizeAskQuestion,
  type LanguageCode,
} from './normalization/qualified-reading';
import { PL_DOMAIN_FORMS, PL_DOMAIN_KEY_ALIASES } from './normalization/pl-readings.resources';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — contract §4 final qualification:
 * "rerun L's complete 49-pair corpus through the actual integrated frozen C path →
 * 0 unexplained routing/evidence-intent divergences; intentional asymmetries explicitly
 * justified."
 *
 * The corpus is L's `measurements/corpus.mts`, vendored byte-identical (sha256 pinned
 * below against L's MANIFEST), and re-checked with L's own CT-0 row digest.
 *
 * "Routing/evidence intent" is compared on frozen C's RoutingPlan: class, terminal,
 * refusals, scope rank, geography requirement, model-prior permission, required evidence
 * classes, dropped constraint axes, specialist legs, clarification causes, disclosures.
 * Readers' own words (stated-period text, topic text) legitimately differ by language
 * and are not routing.
 */

const deps = { specialistRegistry: specialistRegistryFixture };
const PRIOR: Record<'en' | 'pl', string> = {
  en: 'What is happening in Rwanda?',
  pl: 'Co dzieje się w Rwandzie?',
};

function routeRow(q: string, lg: 'en' | 'pl', ctx: boolean, id: string): AskR2Route {
  const map = MAP_ORIGIN.has(id);
  return routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lg,
      normalizationLanguage: lg,
      displayLanguage: lg,
      origin: map ? 'MAP' : 'ASK',
      ...(map ? { originCountries: ['RWA'] } : {}),
    },
    { ...(ctx ? { priorQuestion: PRIOR[lg] } : {}), ...(map ? { mapContextCountry: 'RWA' } : {}) },
    deps,
  );
}

function routingKey(r: AskR2Route): Record<string, string> {
  const p = r.plan;
  return {
    questionClass: p.questionClass,
    terminalState: p.terminalState,
    refusals: p.refusals.join('+'),
    scopedBy: p.scopedBy,
    geographyRequired: String(p.geographyRequired),
    modelPriorPermitted: String(p.modelPriorPermitted),
    requiredEvidence: p.evidenceRequests
      .filter((e) => e.required)
      .map((e) => e.evidenceClass)
      .sort()
      .join('+'),
    droppedAxes: [...new Set(p.constraints.filter((c) => !c.carried).map((c) => c.axis))]
      .sort()
      .join('+'),
    specialistLegs: p.specialistLegs.map((l) => `${l.domain}:${l.requiredness}`).join('+'),
    clarification: p.clarification.map((c) => c.code).join('+'),
    disclosures: p.disclosures.join('+'),
  };
}

const rows = CORPUS.map(([cat, id, ctx, en, pl]) => {
  const e = routeRow(en, 'en', ctx, id);
  const p = routeRow(pl, 'pl', ctx, id);
  const ek = routingKey(e);
  const pk = routingKey(p);
  const diff = Object.keys(ek).filter((k) => ek[k] !== pk[k]);
  return { cat, id, en, pl, e, p, ek, pk, diff };
});

afterAll(() => {
  /* The matrix, for the delivery package, when asked for. Never required to pass. */
  const out = process.env.ASK_R2_L_MATRIX_OUT;
  if (out === undefined) return;
  const lines = rows.map(
    (r) =>
      `${r.diff.length ? 'DIVERGENT' : 'converged'}  ${r.id.padEnd(4)} ${r.cat.padEnd(17)} ` +
      `${r.ek.questionClass}/${r.ek.terminalState}` +
      (r.diff.length
        ? `  vs PL ${r.pk.questionClass}/${r.pk.terminalState} [${r.diff.join(',')}]`
        : '') +
      (r.id in NON_EQUIVALENT ? '  [excluded: not equivalent]' : ''),
  );
  writeFileSync(out, lines.join('\n') + '\n');
});

describe('L 49-pair corpus — identity', () => {
  it('is L’s corpus, byte-identical (sha256 from L’s RESIDUAL-ADDENDUM MANIFEST)', () => {
    const sha = createHash('sha256')
      .update(readFileSync(join(__dirname, 'l-corpus', 'corpus.ts')))
      .digest('hex');
    expect(sha).toBe('41c883f343de38d5488e7fdfd1ea1b7ce0005e413fbff2c5a94f68d31302a966');
  });

  it('CT-0: 50 rows with L’s row digest 20f015c7610db8f9; 49 equivalent pairs', () => {
    const joined = CORPUS.map(([c, i, x, e, p]) => `${c}|${i}|${x}|${e}|${p}`).join('\n');
    expect(CORPUS).toHaveLength(50);
    expect(createHash('sha256').update(joined).digest('hex').slice(0, 16)).toBe('20f015c7610db8f9');
    expect(CORPUS.filter(([, id]) => !(id in NON_EQUIVALENT))).toHaveLength(49);
  });
});

describe('L 49-pair corpus — through the integrated frozen C path', () => {
  it.each(rows.filter((r) => !(r.id in NON_EQUIVALENT)).map((r) => [r.id, r] as const))(
    '%s: EN and PL twins route identically',
    (_id, r) => {
      expect(r.pk).toEqual(r.ek);
    },
  );

  it('0 unexplained routing/evidence-intent divergences over the 49 pairs', () => {
    expect(
      rows.filter((r) => !(r.id in NON_EQUIVALENT) && r.diff.length > 0).map((r) => r.id),
    ).toEqual([]);
  });

  it('every question in both languages crossed every seam (IC-8)', () => {
    for (const r of rows) {
      expect({ id: r.id, lang: 'en', missing: missingSeams(r.e) }).toEqual({
        id: r.id,
        lang: 'en',
        missing: [],
      });
      expect({ id: r.id, lang: 'pl', missing: missingSeams(r.p) }).toEqual({
        id: r.id,
        lang: 'pl',
        missing: [],
      });
    }
  });

  it('every PL question was READ (QUALIFIED), not waved through the language gate', () => {
    for (const r of rows)
      expect({ id: r.id, status: r.p.outcome.status }).toEqual({ id: r.id, status: 'QUALIFIED' });
  });
});

describe('the one intentional asymmetry, justified', () => {
  it('AM1: EN "Georgia" names two places, PL "Gruzja" names one — not a semantic twin', () => {
    const en = resolveGeography('Georgia');
    expect(en.precision === 'UNKNOWN' || en.provenance === 'CONTESTED').toBe(true);
    const am1 = rows.find((r) => r.id === 'AM1')!;
    expect(am1.p.source.typedGeography?.value).toBe('GEO');
    expect(am1.e.source.typedGeography).toBeUndefined();
    expect(Object.keys(NON_EQUIVALENT)).toEqual(['AM1']);
  });
});

describe('contract §4 — residual EN corrections, without turning every "What is" into news', () => {
  const byId = (id: string) => rows.find((r) => r.id === id)!;

  it.each(['D2', 'DT2', 'NU2', 'P2'])('%s is not reference background (EN and PL)', (id) => {
    expect(byId(id).ek.questionClass).not.toBe('REFERENCE');
    expect(byId(id).pk.questionClass).not.toBe('REFERENCE');
    expect(byId(id).ek.terminalState).not.toBe('REFERENCE_BACKGROUND_ONLY');
  });

  it.each(['R1', 'RF2', 'SC1', 'SC2', 'MA1', 'MA2', 'EG1', 'EG2', 'CP1', 'CP2'])(
    '%s stays stable reference background (EN and PL)',
    (id) => {
      expect(byId(id).ek.questionClass).toBe('REFERENCE');
      expect(byId(id).ek.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
      expect(byId(id).pk).toEqual(byId(id).ek);
    },
  );

  /**
   * FS-3 — A FROZEN-SEAM FINDING, HELD VISIBLY RATHER THAN PATCHED (contract §1).
   * "What is GDP?" reads the landed analytical domain `economic` ("gdp" is one of
   * canonical's 59 keywords), and frozen `deriveEvidenceNeeds` makes ANY read domain want
   * NEWS_REPORTING. So a stable definition routes to SPECIALIST_DOMAIN/EXECUTABLE — in
   * both languages alike (no EN/PL divergence), but against §4 "stable reference
   * definitions stay stable background". No adapter can satisfy it without suppressing a
   * landed reading. Reported with the proposed minimal frozen change in the delivery doc.
   * If frozen C is amended, this assertion flips and must be updated deliberately.
   */
  /*
    FS-3 SUPERSEDED by ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 (CTO ruling: a DOMAIN
    is not FRESHNESS). "What is GDP?" is stable reference; it routes REFERENCE in BOTH languages,
    so the EN/PL twin invariant this row protects still holds.
  */
  it('RF1 "What is GDP?" routes REFERENCE in both languages (domain is not freshness)', () => {
    expect(byId('RF1').ek.questionClass).toBe('REFERENCE');
    expect(byId('RF1').pk).toEqual(byId('RF1').ek);
  });
});

describe('the reading is not a router (L N-1) and fails safe', () => {
  it('a reading carries no route, intent, classification or confidence', () => {
    for (const r of rows) {
      if (r.e.outcome.status === 'NOT_READ') continue;
      const keys = Object.keys(r.e.outcome.reading);
      expect(keys.filter((k) => FORBIDDEN_READING_KEYS.includes(k))).toEqual([]);
    }
  });

  it.each([
    ['unreadable language', 'Nini kinaendelea Nairobi?', 'sw', 'sw'],
    ['declaration conflict', 'Co dzieje się w Polsce?', 'pl', 'en'],
    ['empty', '   ', 'pl', 'pl'],
  ] as const)('%s never reaches retrieval: frozen C clarifies', (_n, q, src, norm) => {
    const r = routeAskR2(
      {
        originalQuestion: q,
        sourceLanguage: src as LanguageCode,
        normalizationLanguage: norm as LanguageCode,
        displayLanguage: 'en',
        origin: 'ASK',
      },
      {},
      deps,
    );
    expect(r.outcome.status).toBe('NOT_READ');
    /* The terminal is the guarantee: a CLARIFICATION_REQUIRED plan executes nothing, so
       no retrieval and no model call follow, whatever evidence the intent would want. */
    expect(r.plan.terminalState).toBe('CLARIFICATION_REQUIRED');
    expect(r.plan.clarification.map((c) => c.code)[0]).toMatch(
      /^LANGUAGE_(UNSUPPORTED|UNCLASSIFIED)$/,
    );
    expect(r.plan.modelPriorPermitted).toBe(false);
    expect(r.envelope.domains.domains).toEqual([]);
    expect(r.seam.landed?.queryIntent).toBe('classifyQueryIntent');
    expect(missingSeams(r)).toEqual([]);
  });

  it('lexicon parity: every PL domain key is one of canonical’s EN keywords (no over-coverage)', () => {
    const src = readFileSync(
      join(__dirname, '..', 'analysis', 'query', 'detect-analytical-domains.util.ts'),
      'utf8',
    );
    const block = /const\s+DOMAIN_KEYWORDS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src)?.[1] ?? '';
    const en = new Set<string>();
    for (const line of block.split('\n')) {
      const m = /^\s*([a-z]+):\s*\[(.*)\],?\s*$/.exec(line);
      if (m) for (const k of m[2]!.match(/'([^']*)'/g) ?? []) en.add(`${m[1]}:${k.slice(1, -1)}`);
    }
    expect(en.size).toBe(59);
    const pl = Object.entries(PL_DOMAIN_FORMS).flatMap(([d, set]) =>
      Object.keys(set).map((k) => `${d}:${k}`),
    );
    expect(pl.filter((k) => !en.has(k) && !en.has(PL_DOMAIN_KEY_ALIASES[k] ?? ''))).toEqual([]);
  });

  it('whole-token matching: "regionie" reads, "regionalizacja" and "ministerialny" do not', () => {
    const domainsOf = (w: string) => {
      const o = normalizeAskQuestion({
        originalQuestion: `Co dzieje się w kontekście ${w}?`,
        sourceLanguage: 'pl',
        normalizationLanguage: 'pl',
        displayLanguage: 'pl',
        origin: 'ASK',
      });
      return o.status === 'NOT_READ' ? [] : o.reading.domains.map((d) => d.value);
    };
    expect(domainsOf('regionie')).toEqual(['regional']);
    expect(domainsOf('regionalizacja')).toEqual([]);
    expect(domainsOf('ministerialny')).toEqual([]);
  });
});
