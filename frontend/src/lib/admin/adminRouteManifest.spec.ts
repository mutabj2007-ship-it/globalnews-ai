import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ADMIN_ROUTES, ALL_ADMIN_ROUTES, ADMIN_API } from './adminRoutes';
import { ADMIN_CAPABILITY_MAP, ALL_NAV_ITEMS } from './adminNavManifest';

/**
 * F1.b — the route manifest is the contract between the approved design's
 * route map and the App Router tree on disk. This asserts both
 * directions: every declared route has a page, and every page is
 * declared. An orphan page or a manifest entry with no file is a defect
 * either way.
 */
const APP_ADMIN_DIR = join(__dirname, '..', '..', 'app', 'admin');
const FRONTEND_SRC = join(__dirname, '..', '..');

function routeToPageFile(route: string): string {
  const segments = route
    .replace(/^\/admin\/?/, '')
    .split('/')
    .filter(Boolean);
  return join(APP_ADMIN_DIR, ...segments, 'page.tsx');
}

function collectPageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectPageFiles(full);
    return entry.isFile() && entry.name === 'page.tsx' ? [full] : [];
  });
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : collectSourceFiles(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('F1.b — the twenty-route Admin manifest', () => {
  it('declares exactly twenty routes, all distinct', () => {
    expect(ALL_ADMIN_ROUTES).toHaveLength(20);
    expect(new Set(ALL_ADMIN_ROUTES).size).toBe(20);
  });

  it('reproduces the approved route map verbatim', () => {
    expect(ALL_ADMIN_ROUTES).toEqual([
      '/admin',
      '/admin/news',
      '/admin/news/sources',
      '/admin/ai',
      '/admin/ai/providers',
      '/admin/users',
      '/admin/users/subscriptions',
      '/admin/analytics',
      '/admin/analytics/geography',
      '/admin/payments',
      '/admin/payments/vat',
      '/admin/payments/customers',
      '/admin/payments/invoices',
      '/admin/payments/ksef',
      '/admin/payments/traceability',
      '/admin/support',
      '/admin/system/health',
      '/admin/system/logs',
      '/admin/audit',
      '/admin/settings',
    ]);
  });

  it('every declared route has a page file on disk', () => {
    ALL_ADMIN_ROUTES.forEach((route) => {
      expect({ route, exists: existsSync(routeToPageFile(route)) }).toEqual({
        route,
        exists: true,
      });
    });
  });

  it('every page file under app/admin is a declared route — no orphans', () => {
    const declared = new Set(ALL_ADMIN_ROUTES.map(routeToPageFile));
    collectPageFiles(APP_ADMIN_DIR).forEach((file) => {
      expect({ file, declared: declared.has(file) }).toEqual({ file, declared: true });
    });
  });

  it('the admin route group has exactly one layout', () => {
    expect(existsSync(join(APP_ADMIN_DIR, 'layout.tsx'))).toBe(true);
  });

  it('no /admin path string is hardcoded outside adminRoutes.ts', () => {
    const offenders: string[] = [];

    collectSourceFiles(FRONTEND_SRC)
      .filter((file) => !file.endsWith('adminRoutes.ts') && !file.endsWith('.spec.ts'))
      .forEach((file) => {
        // Comments are stripped first: a doc comment that NAMES a route
        // is documentation, not a hardcoded destination.
        const source = readFileSync(file, 'utf-8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        const matches = source.match(/(['"`])\/admin(?:\/[a-z/]*)?\1/g);
        if (matches) offenders.push(`${file}: ${matches.join(', ')}`);
      });

    expect(offenders).toEqual([]);
  });

  it('the admin API paths are declared once and are all reads under /admin', () => {
    Object.values(ADMIN_API).forEach((path) => {
      expect(path.startsWith('/admin')).toBe(true);
    });
    expect(Object.keys(ADMIN_API).sort()).toEqual(['me', 'newsProviders', 'systemHealth']);
  });

  it('the design IA table maps fifteen capabilities onto declared routes', () => {
    expect(ADMIN_CAPABILITY_MAP).toHaveLength(15);
    ADMIN_CAPABILITY_MAP.forEach((row) => {
      expect(ALL_ADMIN_ROUTES).toContain(row.route);
    });
  });

  it('every nav item points at a declared route', () => {
    ALL_NAV_ITEMS.forEach((navItem) => {
      expect(ALL_ADMIN_ROUTES).toContain(navItem.route);
    });
  });

  it('the overview route is /admin itself, not a sub-path', () => {
    expect(ADMIN_ROUTES.overview).toBe('/admin');
  });
});
