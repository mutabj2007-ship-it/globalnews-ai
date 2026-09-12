import {
  SUPPORT_AUTHOR_TYPES,
  SUPPORT_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
} from '@globalnews-ai/shared';
import { supportEn } from '@/lib/i18n/dictionaries/supportEn';
import { supportPl } from '@/lib/i18n/dictionaries/supportPl';

/**
 * S4 — EN/PL parity for the user Support surface.
 *
 * Two things to prove, exactly as `adminLocalization.spec.ts` proves them for
 * the admin namespace. First structural parity, so a Polish user never meets
 * an undefined label. Second that the Polish is REAL — genuinely different
 * text rather than English copied across — with a deliberate, enumerated
 * exception.
 *
 * THE EXCEPTION IS IDENTIFIERS AND PROTOCOL TOKENS. Nothing here currently
 * needs to be identical in both languages, and the list below is empty on
 * purpose rather than absent: when a token that must NOT be translated is
 * added, it goes in this set with a reason, and the reader can see that the
 * decision was made rather than overlooked.
 */
const IDENTICAL_BY_DESIGN = new Set<string>([]);

type Pair = [string, string];

function flatten(value: unknown, prefix = ''): Pair[] {
  if (typeof value === 'string') return [[prefix, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

const enPairs = flatten(supportEn);
const plPairs = flatten(supportPl);
const enMap = new Map(enPairs);
const plMap = new Map(plPairs);

describe('S4 — Support localisation', () => {
  it('carries a real namespace, not a token effort', () => {
    expect(enPairs.length).toBeGreaterThan(40);
  });

  it('every English key exists in Polish', () => {
    for (const [key] of enPairs) {
      expect(plMap.has(key)).toBe(true);
    }
  });

  it('every Polish key exists in English — no orphan strings either direction', () => {
    for (const [key] of plPairs) {
      expect(enMap.has(key)).toBe(true);
    }
  });

  it('the two dictionaries have exactly the same shape', () => {
    expect(plPairs.map(([key]) => key).sort()).toEqual(enPairs.map(([key]) => key).sort());
  });

  it('THE POLISH IS REAL — no English string survives untranslated', () => {
    const copied: string[] = [];
    for (const [key, english] of enPairs) {
      if (IDENTICAL_BY_DESIGN.has(key)) continue;
      if (plMap.get(key) === english) copied.push(key);
    }
    expect(copied).toEqual([]);
  });

  it('no Polish value is empty', () => {
    for (const [, value] of plPairs) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('S4 — every shared vocabulary member has a label in BOTH languages', () => {
  it('all seven categories, enumerated from the shared array rather than a local list', () => {
    for (const member of SUPPORT_CATEGORIES) {
      expect(typeof supportEn.categories[member]).toBe('string');
      expect(typeof supportPl.categories[member]).toBe('string');
      expect(supportEn.categories[member].length).toBeGreaterThan(0);
      expect(supportPl.categories[member].length).toBeGreaterThan(0);
    }
    expect(Object.keys(supportEn.categories).sort()).toEqual([...SUPPORT_CATEGORIES].sort());
  });

  it('all four statuses', () => {
    for (const member of SUPPORT_TICKET_STATUSES) {
      expect(supportEn.statuses[member].length).toBeGreaterThan(0);
      expect(supportPl.statuses[member].length).toBeGreaterThan(0);
    }
    expect(Object.keys(supportEn.statuses).sort()).toEqual([...SUPPORT_TICKET_STATUSES].sort());
  });

  it('all three author types, INCLUDING SYSTEM_AI', () => {
    // Nothing writes SYSTEM_AI today. The label exists so that if machine
    // output ever reaches a ticket it arrives already labelled as machine
    // output, rather than being presented as a human reply until somebody
    // notices.
    for (const member of SUPPORT_AUTHOR_TYPES) {
      expect(supportEn.authors[member].length).toBeGreaterThan(0);
      expect(supportPl.authors[member].length).toBeGreaterThan(0);
    }
    expect(Object.keys(supportEn.authors).sort()).toEqual([...SUPPORT_AUTHOR_TYPES].sort());
    expect(supportEn.authors.SYSTEM_AI).not.toBe(supportEn.authors.ADMIN);
    expect(supportPl.authors.SYSTEM_AI).not.toBe(supportPl.authors.ADMIN);
  });
});

describe('S4 — the 429 message is truthful about BOTH conditions it can mean', () => {
  it('names the rate limit and the open-request cap together, and claims neither specifically', () => {
    // The backend returns 429 for two different reasons and they are not
    // distinguishable without parsing an English error string from the API.
    // Stating the wrong one is worse than stating both, so the copy covers
    // both and asserts neither. Accepted for MVP; a machine-readable error
    // code is the long-term fix.
    for (const dictionary of [supportEn, supportPl]) {
      expect(dictionary.errors.sendFailedBody.length).toBeGreaterThan(60);
      expect(dictionary.errors.sendFailedTitle.length).toBeGreaterThan(0);
    }
    expect(supportEn.errors.sendFailedBody.toLowerCase()).toContain('maximum number of open');
    expect(supportEn.errors.sendFailedBody.toLowerCase()).toContain('too soon');
  });

  it('tells the person plainly that nothing was sent', () => {
    expect(supportEn.errors.sendFailedBody.toLowerCase()).toContain('nothing was sent');
    expect(supportEn.errors.genericBody.toLowerCase()).toContain('nothing was sent');
  });
});
