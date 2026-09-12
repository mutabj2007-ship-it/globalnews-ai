import { readFileSync } from 'fs';
import { join } from 'path';
import { ADMIN_HEALTH_COMPONENTS } from './adminApiTypes';

/**
 * F1.b — the frontend mirror of the admin API contract must not drift
 * from the backend's.
 *
 * F1.b is authorized to change no file under shared/**, which is where a
 * shared contract would normally live, so the health literals exist in
 * two places. That duplication is disclosed in both files and guarded
 * here: if either side gains, loses or renames a member, this fails.
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
  'system',
  'admin-system.contract.ts',
);

const backend = readFileSync(BACKEND_CONTRACT, 'utf-8');

function literalsOf(constName: string): string[] {
  const start = backend.indexOf(`export const ${constName}`);
  expect(start).toBeGreaterThan(-1);
  const block = backend.slice(start, backend.indexOf('] as const;', start));
  return (block.match(/'([A-Z_]+)'/g) ?? []).map((raw) => raw.replace(/'/g, ''));
}

describe('F1.b — admin API contract parity', () => {
  it('the health component list is identical on both sides, in the same order', () => {
    expect([...ADMIN_HEALTH_COMPONENTS]).toEqual(literalsOf('ADMIN_HEALTH_COMPONENTS'));
    expect(ADMIN_HEALTH_COMPONENTS).toHaveLength(8);
  });

  it('the probe status union is identical on both sides', () => {
    const backendUnion = backend
      .slice(backend.indexOf('export type AdminProbeStatus'))
      .split(';')[0];

    ['HEALTHY', 'DEGRADED', 'FAILING', 'UNKNOWN', 'NOT_IMPLEMENTED'].forEach((status) => {
      expect(backendUnion).toContain(`'${status}'`);
    });
  });

  it('the probe detail union is identical on both sides', () => {
    const backendUnion = backend
      .slice(backend.indexOf('export type AdminProbeDetail'))
      .split(';')[0];

    const frontend = readFileSync(join(__dirname, 'adminApiTypes.ts'), 'utf-8');
    const frontendUnion = frontend
      .slice(frontend.indexOf('export type AdminProbeDetail'))
      .split(';')[0];

    const keys = (backendUnion.match(/'[a-z-]+'/g) ?? []).sort();
    expect(keys.length).toBeGreaterThanOrEqual(8);
    expect((frontendUnion.match(/'[a-z-]+'/g) ?? []).sort()).toEqual(keys);
  });

  it('the backend never returns prose in `detail` — every value is a machine key', () => {
    const backendUnion = backend
      .slice(backend.indexOf('export type AdminProbeDetail'))
      .split(';')[0];

    (backendUnion.match(/'[^']+'/g) ?? []).forEach((raw) => {
      expect(raw.replace(/'/g, '')).toMatch(/^[a-z][a-z0-9-]*$/);
    });
  });

  it('both mirrors disclose the duplication rather than hiding it', () => {
    expect(backend).toContain('shared');
    expect(readFileSync(join(__dirname, 'adminApiTypes.ts'), 'utf-8')).toContain(
      'adminApiContract.spec.ts',
    );
  });
});

/**
 * ADMIN-03 — the SECOND mirrored contract, guarded the same way.
 *
 * `admin-analytics.contract.ts` is duplicated into `adminApiTypes.ts`
 * for the same reason the health literals are: this lane changes no
 * shared file. Two copies of a type is a slow leak unless something
 * reads both, so this compares them STRUCTURALLY -- every interface the
 * backend declares must exist on the frontend with exactly the same
 * property names, and vice versa.
 *
 * It compares NAMES, NOT TYPES, and that limit is stated rather than
 * implied: a property whose type changed from `number` to `string` on
 * one side only would pass. Catching that needs a real type-level
 * comparison across two tsconfigs, which is more machinery than this
 * duplication is worth. What it does catch is the failure that actually
 * happens -- a field added, removed or renamed on one side.
 */
const ANALYTICS_CONTRACT = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'backend',
  'src',
  'modules',
  'admin',
  'analytics',
  'admin-analytics.contract.ts',
);

const FRONTEND_TYPES = join(__dirname, 'adminApiTypes.ts');

/**
 * Property names of every `export interface` in a source file.
 *
 * Comments are stripped first. These contracts are heavily commented
 * and a doc comment that names a field in order to explain why it is
 * ABSENT would otherwise be read as a declaration of it -- which would
 * turn the explanation into a false positive and push the explanation
 * out of the file.
 */
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

describe('ADMIN-03 — analytics contract parity', () => {
  const backendInterfaces = interfacesOf(ANALYTICS_CONTRACT);
  const frontendInterfaces = interfacesOf(FRONTEND_TYPES);

  it('finds the analytics interfaces on both sides', () => {
    expect(Object.keys(backendInterfaces).length).toBeGreaterThanOrEqual(12);
  });

  it('every backend analytics interface exists on the frontend with the same fields', () => {
    Object.entries(backendInterfaces).forEach(([name, fields]) => {
      expect({ name, fields: frontendInterfaces[name] }).toEqual({ name, fields });
    });
  });

  it('the response shapes carry no field for audience geography, an address, or an identity', () => {
    const responses = [
      'AdminAnalyticsUsageResponse',
      'AdminCoverageGeographyResponse',
      'AdminUsersResponse',
      'AdminAccountRecord',
      'AdminCoverageCountry',
      'AdminFollowedCountry',
    ];

    const forbidden = [
      'email',
      'emailDomain',
      'maskedEmail',
      'displayName',
      'query',
      'userId',
      'providerAccountId',
      'tokenHash',
      'ipAddress',
      'audienceCountry',
      'userCountry',
      'city',
      'region',
      'latitude',
      'longitude',
    ];

    responses.forEach((name) => {
      const fields = backendInterfaces[name] ?? [];
      expect({ name, present: fields.filter((field) => forbidden.includes(field)) }).toEqual({
        name,
        present: [],
      });
      const mirrored = frontendInterfaces[name] ?? [];
      expect({ name, present: mirrored.filter((field) => forbidden.includes(field)) }).toEqual({
        name,
        present: [],
      });
    });
  });

  it('the account record is exactly the four approved columns', () => {
    expect(backendInterfaces.AdminAccountRecord).toEqual([
      'adminRole',
      'createdAt',
      'id',
      'lastSeenAt',
    ]);
  });
});
