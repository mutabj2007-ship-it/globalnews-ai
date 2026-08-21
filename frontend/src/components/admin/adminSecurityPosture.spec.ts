import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { primaryNavLinks } from '@/lib/navigation';
import { NAV_MODEL } from '@/lib/navModel';

/**
 * F1.b — the frontend must not weaken anything F1.a established.
 *
 * F1.a's guarantees live in the backend and F1.b writes no backend file,
 * so the risk is not that the guard changed — it is that the frontend
 * quietly grows a parallel notion of "administrator": a cached role, a
 * client-side permission check, a hardcoded email, a link that advertises
 * the admin surface to anonymous visitors. Each of those is asserted
 * absent here.
 */
const FRONTEND_SRC = join(__dirname, '..', '..');
const ADMIN_DIRS = [
  join(FRONTEND_SRC, 'components', 'admin'),
  join(FRONTEND_SRC, 'lib', 'admin'),
  join(FRONTEND_SRC, 'app', 'admin'),
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const adminFiles = ADMIN_DIRS.flatMap(filesUnder).filter((file) => !file.endsWith('.spec.ts'));

describe('F1.b — security posture', () => {
  it('sweeps the whole admin surface', () => {
    expect(adminFiles.length).toBeGreaterThan(40);
  });

  it('NOTHING about the admin session is persisted in the browser', () => {
    adminFiles.forEach((file) => {
      // Comments stripped: AdminShell's own doc comment names these APIs
      // in order to state that it does not use them.
      const source = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
      expect(source).not.toContain('indexedDB');
      expect(source).not.toMatch(/document\.cookie/);
    });
  });

  it('no administrator identity, email or domain check is hardcoded', () => {
    adminFiles.forEach((file) => {
      const source = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

      const literals = source.match(/'[^']*'|"[^"]*"/g) ?? [];
      literals.forEach((literal) => {
        expect(/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(literal)).toBe(false);
      });

      expect(source).not.toMatch(/endsWith\(\s*['"`]@/);
      expect(source).not.toMatch(/ADMIN_EMAILS?|ALLOWED_ADMINS?/i);
    });
  });

  it('the admin surface is not advertised in the public navigation', () => {
    primaryNavLinks.forEach((link) => {
      expect(link.href.startsWith('/admin')).toBe(false);
    });

    NAV_MODEL.forEach((entry) => {
      expect((entry.href ?? '').startsWith('/admin')).toBe(false);
    });
  });

  it('the admin layout asks crawlers not to index it', () => {
    const layout = readFileSync(join(FRONTEND_SRC, 'app', 'admin', 'layout.tsx'), 'utf-8');
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });

  it('no admin file performs a role comparison to decide behaviour', () => {
    adminFiles.forEach((file) => {
      const source = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

      // Displaying me.role is fine. Branching on it is a second,
      // divergent permission model.
      expect(source).not.toMatch(/role\s*===\s*['"`]/);
      expect(source).not.toMatch(/role\s*!==\s*['"`]/);
      expect(source).not.toMatch(/\.includes\(\s*['"`]SUPER_ADMIN/);
    });
  });

  it('no admin file offers a control that changes the caller’s own role', () => {
    const raw = readFileSync(
      join(FRONTEND_SRC, 'components', 'admin', 'shell', 'AdminTopBar.tsx'),
      'utf-8',
    );
    const topbar = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    // The approved artifact carries a role SELECT in this position. It is
    // a review affordance, and per CTO decision it is not built. The
    // comment saying so must survive; the control must not exist.
    expect(topbar).not.toMatch(/<select/);
    expect(topbar).not.toMatch(/setRole|onRoleChange|switchRole/);
    expect(raw).toContain('NEVER SELECTED');
  });

  it('F1.b ships no mutating admin request', () => {
    adminFiles.forEach((file) => {
      const source = readFileSync(file, 'utf-8');
      expect(source).not.toMatch(/method:\s*'(POST|PUT|PATCH|DELETE)'/);
    });
  });

  it('the two real data surfaces are read through accountFetch and nothing else', () => {
    const resource = readFileSync(
      join(FRONTEND_SRC, 'lib', 'admin', 'useAdminResource.ts'),
      'utf-8',
    );
    expect(resource).toContain("from '@/lib/api/accountFetch'");
    expect(resource).not.toMatch(/\bfetch\s*\(/);
    expect(resource).toContain("setState('error')");
  });

  it('a failed admin request becomes an error state, never empty data', () => {
    const resource = readFileSync(
      join(FRONTEND_SRC, 'lib', 'admin', 'useAdminResource.ts'),
      'utf-8',
    );
    const start = resource.indexOf('if (!response.ok) {');
    const failureBranch = resource.slice(start, resource.indexOf('}', start));

    expect(failureBranch).toContain("setState('error')");
    expect(failureBranch).not.toContain('setData');
  });
});
