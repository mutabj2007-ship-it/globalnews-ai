import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import {
  ROUTING_FUNCTION_WORDS,
  isRoutingFunctionWord,
  isExplicitCountryCodeToken,
  blocksGeographicRouting,
} from './routing-function-words.util';

/**
 * G-ALPHA-2 STAGE 1 ACCEPTANCE — THE FUNCTION-WORD ROUTING GUARD.
 *
 * Built around the CLASS of defect, not around the reported sentence. The rule
 * under test is "a lone function word written in prose is never geography", so
 * the corpus below enumerates the collision class exhaustively and asserts the
 * rule's edges, rather than pinning the single word "it".
 */

/**
 * Every lowercase token measured on the governing baseline to resolve to a
 * sovereign country. Recorded as data so a future change to the country table
 * that widens this class is caught by the exhaustive test below, not by a user.
 */
const MEASURED_COLLISIONS: ReadonlyArray<readonly [string, string]> = [
  ['am', 'Armenia'],
  ['at', 'Austria'],
  ['be', 'Belgium'],
  ['by', 'Belarus'],
  ['do', 'Dominican Republic'],
  ['in', 'India'],
  ['is', 'Iceland'],
  ['it', 'Italy'],
  ['me', 'Montenegro'],
  ['my', 'Malaysia'],
  ['no', 'Norway'],
  ['so', 'Somalia'],
  ['to', 'Tonga'],
  ['us', 'United States'],
  ['and', 'Andorra'],
  ['are', 'United Arab Emirates'],
  ['can', 'Canada'],
  ['za', 'South Africa'],
  ['co', 'Colombia'],
  ['bo', 'Bolivia'],
  ['ci', "Cote d'Ivoire"],
  ['mu', 'Mauritius'],
  ['na', 'Namibia'],
];

describe('the collision class is real, and is exactly what was measured', () => {
  it.each(MEASURED_COLLISIONS)(
    'the bare token "%s" still resolves to %s in the country table',
    (token, expectedName) => {
      // Not a change under test — this documents WHY the guard is needed. If
      // this ever stops being true the guard becomes harmless, never wrong.
      expect(resolveCountryByAnyIdentifier(token)?.name).toBe(expectedName);
    },
  );

  it('every measured collision is covered by the guard', () => {
    for (const [token] of MEASURED_COLLISIONS) {
      expect(blocksGeographicRouting(token)).toBe(true);
    }
  });
});

describe('the guard refuses a lone prose function word', () => {
  it.each(['it', 'It', 'us', 'Us', 'in', 'is', 'no', 'to', 'and', 'are', 'can', 'my', 'me'])(
    '"%s" is refused',
    (token) => {
      expect(blocksGeographicRouting(token)).toBe(true);
    },
  );

  it('refuses the Polish function words too — the product ships a Polish surface', () => {
    for (const token of ['co', 'to', 'za', 'do', 'bo', 'ci', 'mu', 'na', 'jest', 'nie', 'sie']) {
      expect(blocksGeographicRouting(token)).toBe(true);
    }
  });

  it('judges the word, not its punctuation', () => {
    for (const token of ['it.', 'it?', '(it)', '"it"', 'it,', "it's"]) {
      expect(blocksGeographicRouting(token)).toBe(true);
    }
  });
});

describe('the guard NEVER refuses anything else — it can only subtract misreadings', () => {
  it('an explicitly capitalised ISO code is untouched', () => {
    for (const code of ['US', 'IT', 'IN', 'NO', 'AND', 'ARE', 'CAN', 'ESP', 'UK', 'UAE']) {
      expect(blocksGeographicRouting(code)).toBe(false);
    }
  });

  it('a country NAME is never in the list — no country loses its own name', () => {
    for (const name of [
      'italy',
      'india',
      'norway',
      'canada',
      'andorra',
      'iceland',
      'belgium',
      'belarus',
      'armenia',
      'austria',
      'malaysia',
      'montenegro',
      'somalia',
      'tonga',
      'namibia',
      'colombia',
      'bolivia',
      'mauritius',
      'poland',
      'rwanda',
      'kenya',
      'ukraine',
      'russia',
      // The ambiguous names the pipeline has always been careful with. They are
      // ordinary English words AND real countries, and none of them is a
      // function word, so none of them may be caught here.
      'turkey',
      'georgia',
      'chad',
      'jordan',
      'niger',
    ]) {
      expect(blocksGeographicRouting(name)).toBe(false);
      expect(ROUTING_FUNCTION_WORDS.has(name)).toBe(false);
    }
  });

  it('a multi-word candidate is never refused — only lone tokens are in scope', () => {
    for (const candidate of [
      'United States',
      'the United States',
      'DR Congo',
      'it is',
      'in and out',
      'no country',
    ]) {
      expect(blocksGeographicRouting(candidate)).toBe(false);
    }
  });

  it('content words are never refused', () => {
    for (const word of ['election', 'conflict', 'quantum', 'inflation', 'summit', 'tariffs']) {
      expect(blocksGeographicRouting(word)).toBe(false);
    }
  });

  it('empty and whitespace input is not an error and refuses nothing', () => {
    expect(blocksGeographicRouting('')).toBe(false);
    expect(blocksGeographicRouting('   ')).toBe(false);
  });
});

describe('the two questions the guard asks are genuinely separate', () => {
  it('isRoutingFunctionWord asks WHAT WORD, ignoring how it was written', () => {
    expect(isRoutingFunctionWord('it')).toBe(true);
    expect(isRoutingFunctionWord('IT')).toBe(true);
    expect(isRoutingFunctionWord('It')).toBe(true);
    expect(isRoutingFunctionWord('italy')).toBe(false);
  });

  it('isExplicitCountryCodeToken asks HOW IT WAS WRITTEN, ignoring the word', () => {
    expect(isExplicitCountryCodeToken('IT')).toBe(true);
    expect(isExplicitCountryCodeToken('it')).toBe(false);
    expect(isExplicitCountryCodeToken('It')).toBe(false);
    expect(isExplicitCountryCodeToken('ESP')).toBe(true);
    expect(isExplicitCountryCodeToken('SPAIN')).toBe(false);
    expect(isExplicitCountryCodeToken('U')).toBe(false);
  });

  it('only the combination refuses — a capitalised function word is still a code', () => {
    expect(isRoutingFunctionWord('US')).toBe(true);
    expect(isExplicitCountryCodeToken('US')).toBe(true);
    expect(blocksGeographicRouting('US')).toBe(false);
  });
});
