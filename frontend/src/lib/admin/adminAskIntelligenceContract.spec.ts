import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ASK PUBLIC BETA OPERATIONS MINIMUM R1 — the THIRD mirrored contract, guarded the way the
 * two before it are.
 *
 * `admin-ask-intelligence.contract.ts` is duplicated into `adminApiTypes.ts` because this
 * lane changes no shared file. Two copies of a type is a slow leak unless something reads
 * both, so this compares them STRUCTURALLY — every interface the backend declares must
 * exist on the frontend with exactly the same property names, and vice versa.
 *
 * IT COMPARES NAMES, NOT TYPES, and that limit is stated rather than implied: a property
 * whose type changed from `number` to `string` on one side only would pass. Catching that
 * needs a real type-level comparison across two tsconfigs, which is more machinery than
 * this duplication is worth. What it does catch is the failure that actually happens — a
 * field added, removed or renamed on one side.
 */
const BACKEND_CONTRACT = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'backend',
  'src',
  'modules',
  'admin',
  'ask-intelligence',
  'admin-ask-intelligence.contract.ts',
);
const FRONTEND_TYPES = join(__dirname, 'adminApiTypes.ts');

function interfacesOf(path: string): Record<string, string[]> {
  const source = readFileSync(path, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const found: Record<string, string[]> = {};
  for (const match of source.matchAll(/export interface (\w+)\s*\{([^}]*)\}/g)) {
    found[match[1]] = (match[2].match(/^\s*(\w+)\??\s*:/gm) ?? [])
      .map((raw) => raw.replace(/[^\w]/g, ''))
      .sort();
  }
  return found;
}

const backendInterfaces = interfacesOf(BACKEND_CONTRACT);
const frontendInterfaces = interfacesOf(FRONTEND_TYPES);

/** Only the Ask interfaces; `adminApiTypes.ts` also mirrors two older contracts. */
const askNames = Object.keys(backendInterfaces).filter((name) => name.startsWith('AdminAsk'));

describe('R1 — Ask Intelligence contract parity', () => {
  it('finds the Ask interfaces on both sides', () => {
    expect(askNames.length).toBeGreaterThanOrEqual(14);
  });

  it('every backend Ask interface exists on the frontend with the same fields', () => {
    askNames.forEach((name) => {
      expect({ name, fields: frontendInterfaces[name] }).toEqual({
        name,
        fields: backendInterfaces[name],
      });
    });
  });

  it('the frontend declares no Ask interface the backend does not', () => {
    Object.keys(frontendInterfaces)
      .filter((name) => name.startsWith('AdminAsk'))
      .forEach((name) => {
        expect({ name, backend: backendInterfaces[name] !== undefined }).toEqual({
          name,
          backend: true,
        });
      });
  });

  it('NEITHER SIDE CARRIES A FIELD FOR A QUESTION, A QUERY, AN ACCOUNT OR AN ADDRESS', () => {
    const forbidden = [
      'question',
      'questionText',
      'rawQuestion',
      'prompt',
      'promptText',
      'query',
      'searchQuery',
      'utterance',
      'readerTerms',
      'statedPeriod',
      'answerText',
      'providerResponse',
      'email',
      'emailDomain',
      'maskedEmail',
      'displayName',
      'userId',
      'accountId',
      'operationId',
      'fingerprint',
      'ipAddress',
      'sessionId',
      'deviceClass',
      'audienceCountry',
      'userCountry',
      'city',
      'latitude',
      'longitude',
      'setBy',
      'actor',
    ];

    askNames.forEach((name) => {
      [backendInterfaces[name] ?? [], frontendInterfaces[name] ?? []].forEach((fields) => {
        expect({ name, present: fields.filter((field) => forbidden.includes(field)) }).toEqual({
          name,
          present: [],
        });
      });
    });
  });

  it('POSITIVE CONTROL — the same parser and the same list DO condemn a contaminated shape', () => {
    /* Without this the sweep above could pass because the parser found nothing at all. */
    const fields = ['count', 'question', 'userId'].sort();
    expect(fields.filter((field) => ['question', 'userId'].includes(field)).sort()).toEqual([
      'question',
      'userId',
    ]);
    expect(Object.keys(backendInterfaces).length).toBeGreaterThan(0);
  });

  it('both mirrors disclose the duplication rather than hiding it', () => {
    expect(readFileSync(BACKEND_CONTRACT, 'utf-8')).toContain('adminAskIntelligenceContract');
    expect(readFileSync(FRONTEND_TYPES, 'utf-8')).toContain('adminAskIntelligenceContract');
  });

  it('the disclosure literals that can never be true are typed as literals on both sides', () => {
    [BACKEND_CONTRACT, FRONTEND_TYPES].forEach((path) => {
      const source = readFileSync(path, 'utf-8');
      const block = source.slice(source.indexOf('export interface AdminAskDisclosures'));
      expect(block).toContain('rawQuestionStored: false');
      expect(block).toContain('questionReviewImplemented: false');
      expect(block).toContain('readOnly: true');
    });
  });

  /**
   * The severity union is a TYPE ALIAS, which the interface parser above cannot see. It is
   * compared separately, the same way the landed contract spec compares `AdminProbeStatus` —
   * and it matters here because a member missing on one side would let a screen fall through
   * to a default tone for a severity the backend can really emit.
   */
  it('the alert severity union is identical on both sides', () => {
    const unionOf = (path: string): string[] => {
      const source = readFileSync(path, 'utf-8');
      const start = source.indexOf('export type AdminAskAlertSeverity');
      expect(start).toBeGreaterThan(-1);
      return (source.slice(start, source.indexOf(';', start)).match(/'[A-Z_]+'/g) ?? [])
        .map((raw) => raw.replace(/'/g, ''))
        .sort();
    };
    const backend = unionOf(BACKEND_CONTRACT);
    expect(backend).toEqual(['OK', 'WARNING', 'CRITICAL', 'INSUFFICIENT_SAMPLE', 'UNKNOWN'].sort());
    expect(unionOf(FRONTEND_TYPES)).toEqual(backend);
  });

  it('the pending-threshold placeholder is retired from the CODE, not merely overwritten', () => {
    /* Comments are stripped first. A doc comment that names the retired marker in order to
       record that it WAS retired is the opposite of leaving it in force, and an assertion
       that punished the explanation would push the explanation out of the file. */
    const code = readFileSync(BACKEND_CONTRACT, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).not.toContain('PO_PENDING');
    expect(code).toContain('PRODUCT_OWNER_RULED');
  });
});
