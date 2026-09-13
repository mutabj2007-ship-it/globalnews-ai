import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOSTILITY_EVIDENCE_EN,
  HOSTILITY_EVIDENCE_PL,
  HOSTILITY_KINDS,
  HOSTILITY_MAPPING_PROVENANCE,
  HOSTILITY_MAPPING_V1R3,
  detectHostilityEvidence,
} from './hostility-evidence.v1r3';
import { foldTokens } from '../../geo/geo-normalize.util';

/**
 * THE RATIFIED LEXICON IS DATA, SO A CHANGE TO IT MUST BREAK A TEST — exactly as a change to a
 * candidate breaks a fingerprint. The digest below is pinned for that reason and for no other.
 */
/**
 * Source-text guards must test CODE, not the prose that explains why something is absent.
 * The first cut of these guards failed against this very module, because its comments name
 * `classifyQueryIntent`, `contextCountryIso3` and the Conflict module path in order to say they are
 * NOT used. A guard that a correct file fails is a broken guard, so comments are stripped first.
 */
function codeOnly(file: string): string {
  return readFileSync(join(__dirname, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const LEXICON_DIGEST = '749bd4dead01488b1eff23e413e73ad893fd264f41fce439553e7ad36b104468';

function lexiconDigest(): string {
  const body = `HOSTILITY-EN-PL-v1-R3\n${HOSTILITY_EVIDENCE_EN.join('\n')}\n${HOSTILITY_EVIDENCE_PL.join('\n')}\n`;
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

/** The 32 negatives. Every one must yield NO evidence. */
const NEGATIVE_CONTROLS: readonly string[] = [
  // Polish figurative / non-hostility
  'walki z inflacją',
  'efekty walki z korupcją',
  'w trakcie walki o władzę',
  'pod ostrzałem krytyki',
  'nalot policji',
  'nalot na języku',
  'starcia słowne',
  'starcia kibiców',
  'na pierwszej linii frontu walki z pandemią',
  'ciężkie walki bokserskie',
  'zacięte walki wyborcze',
  'walki uliczne podczas zamieszek',
  'rozejm w sporze politycznym',
  'zbrodnie wojenne przed trybunałem',
  'rebelianci w partii rządzącej',
  'Jaka jest pogoda w Sudanie?',
  // English figurative / non-hostility
  'frontline workers deserve support',
  'the company is at war with itself',
  'a bombardment of emails',
  'a truce in the boardroom',
  'the government is fighting inflation',
  'trade war between the US and China',
  'militant activists blocked the road',
  'the militant wing of the union',
  'war crimes tribunal in The Hague',
  "What's the weather in Sudan?",
  "Why can't I set a ward Watch?",
  // R3 — the four measured figurative bare-`insurgency` negatives
  'a populist insurgency within the party',
  'the backbench insurgency against the leadership',
  'his insurgency in the primaries surprised everyone',
  'a brand insurgency in the coffee market',
  // R3 — reclassified from POSITIVE. Bare `insurgency` is no longer an entry, so this is the
  // accepted recall loss, recorded as a control rather than deleted.
  'a growing insurgency',
];

/** The 29 positives. Every one must yield evidence. */
const POSITIVE_CONTROLS: readonly string[] = [
  'Czy w Sudanie trwa konflikt zbrojny?',
  'w konflikcie zbrojnym w Darfurze',
  'konflikty zbrojne w Afryce',
  'zawieszenie broni w Chartumie',
  'po zawieszeniu broni',
  'działania zbrojne w regionie',
  'podczas działań wojennych',
  'w działaniach zbrojnych',
  'wojna domowa w Sudanie',
  'skutki wojny domowej',
  'przetrwać wojnę domową',
  'ostrzał artyleryjski Chartumu',
  'pod ostrzałem artyleryjskim',
  'ostrzał rakietowy miasta',
  'naloty lotnicze na Chartum',
  'nalot lotniczy na stolicę',
  'starcia zbrojne w Darfurze',
  'po starciach zbrojnych',
  'Is there an armed conflict in Sudan?',
  'a ceasefire was agreed',
  'air strikes overnight',
  'shelling continued',
  'aerial bombardment of the city',
  'artillery bombardment reported',
  'a growing armed insurgency',
  'armed insurgents advanced',
  'armed militants seized the road',
  'civil war in Sudan',
  'inside the war zone',
];

describe('the ratified lexicon is fixed data', () => {
  it('has exactly 19 EN and 41 PL entries', () => {
    expect(HOSTILITY_EVIDENCE_EN).toHaveLength(19);
    expect(HOSTILITY_EVIDENCE_PL).toHaveLength(41);
  });

  it('pins its digest, so a silent edit to ratified data fails the suite', () => {
    expect(lexiconDigest()).toBe(LEXICON_DIGEST);
  });

  it('is ordinal-sorted within each language', () => {
    expect([...HOSTILITY_EVIDENCE_EN].sort()).toEqual([...HOSTILITY_EVIDENCE_EN]);
    expect([...HOSTILITY_EVIDENCE_PL].sort()).toEqual([...HOSTILITY_EVIDENCE_PL]);
  });

  it('stores every entry already folded — the entry equals its own fold', () => {
    for (const entry of [...HOSTILITY_EVIDENCE_EN, ...HOSTILITY_EVIDENCE_PL]) {
      expect(foldTokens(entry).join(' ')).toBe(entry);
    }
  });

  it('contains no uppercase, no apostrophe, and no diacritic other than the stroked l', () => {
    for (const entry of [...HOSTILITY_EVIDENCE_EN, ...HOSTILITY_EVIDENCE_PL]) {
      expect(entry).toBe(entry.toLowerCase());
      expect(entry).not.toContain("'");
      expect(entry).toMatch(/^[a-zł ]+$/);
    }
  });

  it('keeps the stroked l and folds every other Polish diacritic', () => {
    expect(HOSTILITY_EVIDENCE_PL).toContain('ostrzał artyleryjski');
    expect(HOSTILITY_EVIDENCE_PL).toContain('starc zbrojnych');
    expect(HOSTILITY_EVIDENCE_PL).toContain('działan zbrojnych');
  });

  it('covers the instrumental wojna domowa for free — the one case that collapses', () => {
    expect(foldTokens('wojną domową').join(' ')).toBe('wojna domowa');
    expect(HOSTILITY_EVIDENCE_PL).toContain('wojna domowa');
  });

  it('excludes every term rejected during review', () => {
    const all = [...HOSTILITY_EVIDENCE_EN, ...HOSTILITY_EVIDENCE_PL];
    for (const rejected of [
      'fighting', 'war', 'war crimes', 'insurgency', 'insurgents', 'militants', 'truce',
      'bombardment', 'front line', 'frontline', 'at war',
      'walki', 'walkach', 'starcia', 'nalot', 'naloty', 'linia frontu', 'linii frontu',
      'ostrzał', 'bojownicy', 'rebelianci', 'rozejm', 'zbrodnie wojenne',
    ]) {
      expect(all).not.toContain(rejected);
    }
  });

  it('carries `armed insurgency` and not bare `insurgency` (R3)', () => {
    expect(HOSTILITY_EVIDENCE_EN).toContain('armed insurgency');
    expect(HOSTILITY_EVIDENCE_EN).not.toContain('insurgency');
  });
});

describe('evidence detection — positive evidence only', () => {
  it.each(NEGATIVE_CONTROLS)('finds NO evidence in: %s', (control) => {
    expect(detectHostilityEvidence(control)).toBeUndefined();
  });

  it.each(POSITIVE_CONTROLS)('finds evidence in: %s', (control) => {
    expect(detectHostilityEvidence(control)).toBeDefined();
  });

  it('runs all 32 negative and 29 positive controls', () => {
    expect(NEGATIVE_CONTROLS).toHaveLength(32);
    expect(POSITIVE_CONTROLS).toHaveLength(29);
  });

  it('separates the same noun by its qualifier — the qualified-return strategy, proven', () => {
    expect(detectHostilityEvidence('pod ostrzałem artyleryjskim')).toBeDefined();
    expect(detectHostilityEvidence('pod ostrzałem krytyki')).toBeUndefined();
  });

  it('matches by token sequence, never by substring', () => {
    expect(detectHostilityEvidence('walkower w lidze')).toBeUndefined();
    expect(detectHostilityEvidence('the warehouse district')).toBeUndefined();
  });

  it('reports which lexicon matched, for audit', () => {
    expect(detectHostilityEvidence('armed conflict in Sudan')?.lexicon).toBe('EN');
    expect(detectHostilityEvidence('konflikt zbrojny w Sudanie')?.lexicon).toBe('PL');
  });

  it('finds nothing in empty or whitespace input', () => {
    expect(detectHostilityEvidence('')).toBeUndefined();
    expect(detectHostilityEvidence('   ')).toBeUndefined();
  });
});

describe('the mapping version', () => {
  it('is HOSTILITY-EN-PL-v1-R3, approved against P3-CONTRACT-R1', () => {
    expect(HOSTILITY_MAPPING_V1R3.version).toBe('HOSTILITY-EN-PL-v1-R3');
    expect(HOSTILITY_MAPPING_V1R3.approvedAgainstSha256).toBe(
      '50fc18660642bc8e8b8d0f46e597bd5b4f1955789b6a5bd04c86cba36a613072',
    );
  });

  it('requires no structured context, so INSUFFICIENT_CONTEXT is unreachable for it', () => {
    expect(HOSTILITY_MAPPING_V1R3.requiresContext).toEqual([]);
  });

  it('emits all three canonical kinds together on positive evidence', () => {
    expect(HOSTILITY_MAPPING_V1R3.derive({ subjectIsHostility: true })).toEqual([
      'HOSTILITY_SEVERITY',
      'HOSTILITY_PARTICIPANTS',
      'HOSTILITY_ESCALATION',
    ]);
    expect(HOSTILITY_KINDS).toHaveLength(3);
  });

  it('emits nothing without the subject signal, whatever else is present', () => {
    expect(HOSTILITY_MAPPING_V1R3.derive({})).toEqual([]);
    expect(
      HOSTILITY_MAPPING_V1R3.derive({ objectType: 'situation', geographyPrecision: 'COUNTRY' }),
    ).toEqual([]);
  });

  it('is pure — same signals, same kinds', () => {
    const signals = { subjectIsHostility: true as const, objectType: 'situation' };
    expect(HOSTILITY_MAPPING_V1R3.derive(signals)).toEqual(HOSTILITY_MAPPING_V1R3.derive(signals));
  });

  it('records provenance separately, and provenance is not an input to derive', () => {
    expect(HOSTILITY_MAPPING_PROVENANCE.baselineFingerprint).toBe(
      '6B2E35481FB8B1885A0472A260EC1D688D2B05DB8D18B9AB4DD8868C7F4D5654',
    );
    expect(HOSTILITY_MAPPING_PROVENANCE.designAuthoritySha256).toBe(
      '50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd',
    );
    expect(HOSTILITY_MAPPING_PROVENANCE.canonicalKindsAtRatification).toHaveLength(3);
  });
});

describe('the module names no domain and reaches nothing that answers', () => {
  it('contains no domain id and no import from a domain module', () => {
    const code = codeOnly('hostility-evidence.v1r3.ts');
    expect(code).not.toContain('conflict-claim');
    expect(code).not.toContain('domainId');
    expect(code).not.toMatch(/registeredSpecialistDomainId/);
    expect(code).not.toContain('AnalyticalDomain');
    expect(code).not.toContain('classifyQueryIntent');
  });
});
