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

  /**
   * S3 — REPLACES "F1.b ships no mutating admin request", which was a
   * true statement about F1.b and stopped being true the moment an
   * administrator could answer a support ticket.
   *
   * NOT A RELAXATION. The old assertion protected one thing: that no
   * admin request could change state without review. The risk it was
   * really guarding against was a mutation that bypasses the platform's
   * session and CSRF handling — a bare `fetch` with a hand-written
   * header, or a second API client. These three assertions state that
   * directly and cover MORE ground than the old one: not one admin file
   * may call `fetch` at all, every mutation must name POST (never PUT,
   * PATCH or DELETE), and only the two sanctioned hooks may issue a
   * request in the first place.
   */
  it('NOT ONE admin file constructs a bare fetch — every request goes through accountFetch', () => {
    adminFiles.forEach((file) => {
      const source = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

      // accountFetch itself lives outside the admin surface, so nothing
      // swept here has a legitimate reason to call fetch directly.
      expect({ file, bareFetch: /(^|[^.\w])fetch\s*\(/.test(source) }).toEqual({
        file,
        bareFetch: false,
      });
      expect(source).not.toMatch(/XMLHttpRequest|navigator\.sendBeacon/);
    });
  });

  it('every mutating admin request is a POST — no PUT, PATCH or DELETE exists on the admin surface', () => {
    adminFiles.forEach((file) => {
      const source = readFileSync(file, 'utf-8');
      expect(source).not.toMatch(/method:\s*'(PUT|PATCH|DELETE)'/);
    });
  });

  it('the ONLY files that issue an admin request are the two sanctioned hooks', () => {
    const issuers = adminFiles.filter((file) =>
      /accountFetch\s*\(/.test(
        readFileSync(file, 'utf-8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1'),
      ),
    );

    expect(issuers.map((file) => file.split(/[\\/]/).pop()).sort()).toEqual([
      'useAdminMe.ts',
      'useAdminMutation.ts',
      'useAdminResource.ts',
    ]);
  });

  it('the real data surfaces are read through accountFetch and nothing else', () => {
    const resource = readFileSync(
      join(FRONTEND_SRC, 'lib', 'admin', 'useAdminResource.ts'),
      'utf-8',
    );
    expect(resource).toContain("from '@/lib/api/accountFetch'");
    expect(resource).not.toMatch(/\bfetch\s*\(/);
    expect(resource).toContain("setState('error')");
  });

  /**
   * S3 — the write hook, held to the same standard as the read hook.
   *
   * A mutation that resolved to success on a non-2xx would let a
   * composer clear itself and imply a reply was sent to a requester when
   * nothing was stored. That is the support-surface equivalent of
   * rendering an error as empty data, and it is asserted absent the same
   * way.
   */
  it('a failed admin mutation NEVER reports success', () => {
    const mutation = readFileSync(
      join(FRONTEND_SRC, 'lib', 'admin', 'useAdminMutation.ts'),
      'utf-8',
    );

    expect(mutation).toContain("from '@/lib/api/accountFetch'");
    expect(mutation).not.toMatch(/\bfetch\s*\(/);

    const start = mutation.indexOf('if (!response.ok) {');
    expect(start).toBeGreaterThan(-1);
    const failureBranch = mutation.slice(start, mutation.indexOf('}', start));

    expect(failureBranch).toContain("setState('error')");
    expect(failureBranch).toContain('return false');
    expect(failureBranch).not.toContain('return true');
  });

  /**
   * S3 — the frontend half of the internal-note boundary.
   *
   * The real protection is server-side: the requester's query filters
   * INTERNAL at the database. This asserts the admin screen cannot
   * undermine it from the other direction by posting a note as PUBLIC —
   * every composer is constructed for ONE audience and sends that
   * visibility on every request. There is no toggle, no default and no
   * position a control could be left in.
   */
  it('the support composers carry a fixed visibility — there is no control that could post a note publicly', () => {
    const screen = readFileSync(
      join(FRONTEND_SRC, 'components', 'admin', 'screens', 'SupportScreen.tsx'),
      'utf-8',
    );

    expect(screen).toContain('visibility="PUBLIC"');
    expect(screen).toContain('visibility="INTERNAL"');

    // A visibility that a control can change would look like one of
    // these. None may exist.
    expect(screen).not.toMatch(/setVisibility|onVisibilityChange|toggleVisibility/);
    expect(screen).not.toMatch(/visibility[^\n]*\?\s*'PUBLIC'\s*:/);
    expect(screen).not.toMatch(/visibility:\s*'PUBLIC'/);
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
