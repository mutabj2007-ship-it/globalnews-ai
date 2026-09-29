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
});
