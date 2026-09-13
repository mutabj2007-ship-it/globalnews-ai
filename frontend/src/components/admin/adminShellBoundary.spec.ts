import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * F1.b — the access boundary, asserted against the shipped source.
 *
 * This repository's frontend harness is static source analysis
 * (ts-jest, testEnvironment 'node', no jsdom), so these are structural
 * assertions about the code that will run, not about a rendered DOM.
 * What they can prove is exactly the set of properties that matter here:
 * that there is ONE boundary, that it reaches the server through the
 * existing helper, that every access outcome has a rendering, and that no
 * screen can render before authorization resolves.
 */
const ADMIN_COMPONENTS = __dirname;
const APP_ADMIN = join(__dirname, '..', '..', 'app', 'admin');
const FRONTEND_SRC = join(__dirname, '..', '..');

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const shell = readFileSync(join(ADMIN_COMPONENTS, 'shell', 'AdminShell.tsx'), 'utf-8');
const hook = readFileSync(join(FRONTEND_SRC, 'lib', 'admin', 'useAdminMe.ts'), 'utf-8');
const accessState = readFileSync(join(ADMIN_COMPONENTS, 'shell', 'AdminAccessState.tsx'), 'utf-8');
const layout = readFileSync(join(APP_ADMIN, 'layout.tsx'), 'utf-8');

describe('F1.b — the /admin/me client boundary', () => {
  it('the layout is a Server Component that resolves the dictionary once', () => {
    expect(layout).not.toContain("'use client'");
    expect(layout).toContain('cookies()');
    expect(layout).toContain('getDictionary');
    expect(layout).toContain('AdminShell');
  });

  it('the layout marks the admin surface noindex', () => {
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it('no middleware.ts is introduced — it could not read the backend-origin session cookie anyway', () => {
    expect(existsSync(join(FRONTEND_SRC, 'middleware.ts'))).toBe(false);
    expect(existsSync(join(FRONTEND_SRC, '..', 'middleware.ts'))).toBe(false);
  });

  it('AdminShell is the only client boundary that reads identity', () => {
    expect(shell).toContain("'use client'");
    expect(shell).toContain('useAdminMe');

    const others = files(ADMIN_COMPONENTS)
      .filter((file) => !file.endsWith('AdminShell.tsx') && !file.endsWith('.spec.ts'))
      .filter((file) => readFileSync(file, 'utf-8').includes('useAdminMe'));

    expect(others).toEqual([]);
  });

  it('identity is fetched through the EXISTING accountFetch helper — no second API client', () => {
    expect(hook).toContain("from '@/lib/api/accountFetch'");
    expect(hook).not.toMatch(/\bfetch\s*\(/);

    files(FRONTEND_SRC)
      .filter(
        (file) =>
          file.includes(`${join('src', 'lib', 'admin')}`) ||
          file.includes(`${join('components', 'admin')}`),
      )
      .filter((file) => !file.endsWith('.spec.ts'))
      .forEach((file) => {
        const source = readFileSync(file, 'utf-8');
        expect(source).not.toMatch(/\bnew XMLHttpRequest\b/);
        expect(source).not.toMatch(/\baxios\b/);
      });
  });

  it('all five access outcomes exist, and 403 and 404 collapse into ONE — disabled must stay indistinguishable from unauthorized', () => {
    ['loading', 'authorized', 'unauthenticated', 'forbidden', 'unreachable'].forEach((outcome) => {
      expect(hook).toContain(`'${outcome}'`);
    });

    expect(hook).toMatch(/status === 403 \|\| response\.status === 404/);
    expect(hook).toContain("setOutcome('forbidden')");
  });

  it('an unauthorized or unreachable caller sees NO navigation, NO screen code and NO capability list', () => {
    expect(accessState).not.toContain('AdminSidebar');
    expect(accessState).not.toContain('navItemForPath');
    expect(accessState).not.toContain('capabilities');
  });

  it('the shell renders nothing but an access state until authorization resolves', () => {
    expect(shell).toMatch(/if \(outcome !== 'authorized' \|\| !me\)/);
    const guardIndex = shell.indexOf("outcome !== 'authorized'");
    expect(shell.indexOf('<AdminSidebar')).toBeGreaterThan(guardIndex);
    expect(shell.indexOf('<AdminContextProvider')).toBeGreaterThan(guardIndex);
  });

  it('the shell states plainly that the client gate is convenience, not security', () => {
    expect(shell).toContain('CONVENIENCE, NOT SECURITY');
  });

  it('the admin context throws rather than defaulting when a screen escapes the boundary', () => {
    const context = readFileSync(join(ADMIN_COMPONENTS, 'shell', 'AdminContext.tsx'), 'utf-8');
    expect(context).toContain('throw new Error');
    expect(context).toContain('ADMIN_CONTEXT');
  });

  it('every admin page is a thin Server Component that renders one screen', () => {
    const pages = files(APP_ADMIN).filter((file) => file.endsWith('page.tsx'));
    expect(pages).toHaveLength(20);

    pages.forEach((file) => {
      const source = readFileSync(file, 'utf-8');
      expect(source).not.toContain("'use client'");
      expect(source).toContain("from '@/components/admin/screens/");
      expect(source).not.toContain('accountFetch');
      expect(source).not.toContain('useAdminMe');
    });
  });
});
