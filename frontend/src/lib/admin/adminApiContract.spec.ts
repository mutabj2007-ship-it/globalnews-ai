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
