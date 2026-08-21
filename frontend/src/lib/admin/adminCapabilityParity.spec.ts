import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ADMIN_CAPABILITY_NAMES, ADMIN_ROLE_NAMES, hasCapability } from './adminCapabilities';

/**
 * F1.b — THE SPEC THAT KEEPS F1.a's SECURITY MODEL WHERE IT BELONGS.
 *
 * The role -> capability matrix is a backend concern. The frontend is
 * allowed to know the capability NAMES (so a nav entry can name one) and
 * is allowed to read the capability LIST the server returned. It is not
 * allowed to know, or reconstruct, which role holds which capability.
 *
 * Two assertions: the name lists must match the backend's exactly, and no
 * frontend file may contain a role-keyed permission map.
 */
const BACKEND_CAPABILITIES = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'backend',
  'src',
  'modules',
  'admin',
  'rbac',
  'capabilities.ts',
);

const FRONTEND_SRC = join(__dirname, '..', '..');

function frontendFiles(dir: string = FRONTEND_SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return frontendFiles(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('F1.b — frontend/backend capability parity', () => {
  const backendSource = readFileSync(BACKEND_CAPABILITIES, 'utf-8');

  it('the backend capability module is where this spec expects it', () => {
    expect(backendSource).toContain('export const CAPABILITIES');
    expect(backendSource).toContain('export function capabilitiesFor');
  });

  it('the frontend name list is identical to the backend CAPABILITIES values', () => {
    const block = backendSource.slice(
      backendSource.indexOf('export const CAPABILITIES'),
      backendSource.indexOf('} as const;', backendSource.indexOf('export const CAPABILITIES')),
    );
    const backendNames = (block.match(/'([a-z]+\.[a-z]+)'/g) ?? []).map((raw) =>
      raw.replace(/'/g, ''),
    );

    expect(backendNames.length).toBe(9);
    expect([...ADMIN_CAPABILITY_NAMES].sort()).toEqual([...backendNames].sort());
  });

  it('the frontend role name list is identical to the backend ADMIN_ROLES', () => {
    const block = backendSource.slice(backendSource.indexOf('export const ADMIN_ROLES'));
    const backendRoles = (block.slice(0, block.indexOf(';')).match(/'([A-Z_]+)'/g) ?? []).map(
      (raw) => raw.replace(/'/g, ''),
    );

    expect([...ADMIN_ROLE_NAMES]).toEqual(backendRoles);
  });

  it('NO frontend file derives a capability from a role', () => {
    const offenders: string[] = [];

    frontendFiles()
      .filter((file) => !file.endsWith('adminCapabilityParity.spec.ts'))
      .forEach((file) => {
        const source = readFileSync(file, 'utf-8');
        // A role name used as an object KEY is the shape of a permission
        // map. Reading `me.role` for display is fine; keying behaviour off
        // it is not.
        if (/(SUPER_ADMIN|ANALYST|SUPPORT)\s*:/.test(source)) {
          offenders.push(file);
        }
        if (/capabilitiesFor\s*\(/.test(source)) {
          offenders.push(`${file} (capabilitiesFor)`);
        }
      });

    expect(offenders).toEqual([]);
  });

  it('hasCapability is fail-closed', () => {
    expect(hasCapability(undefined, 'analytics.view')).toBe(false);
    expect(hasCapability([], 'analytics.view')).toBe(false);
    expect(hasCapability(['news.manage'], 'analytics.view')).toBe(false);
    expect(hasCapability(['analytics.view'], 'analytics.view')).toBe(true);
  });
});
