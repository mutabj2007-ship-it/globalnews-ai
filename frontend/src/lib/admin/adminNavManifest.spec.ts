import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ALL_NAV_ITEMS, NAV_MANIFEST, navItemForPath, visibleNavGroups } from './adminNavManifest';
import { ADMIN_CAPABILITY_NAMES } from './adminCapabilities';
import { ADMIN_ROUTES } from './adminRoutes';

const COMPONENTS_ADMIN = join(__dirname, '..', '..', 'components', 'admin');

function adminComponentFiles(dir: string = COMPONENTS_ADMIN): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return adminComponentFiles(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('F1.b — capability-driven navigation', () => {
  it('renders the approved group order', () => {
    expect(NAV_MANIFEST.map((group) => group.labelKey)).toEqual([
      'platform',
      'content',
      'intelligence',
      'audience',
      'finance',
      'support',
      'operations',
    ]);
  });

  it('carries fourteen items — the artifact sidebar minus its Information architecture entry, which is the shell', () => {
    expect(ALL_NAV_ITEMS).toHaveLength(14);
    expect(ALL_NAV_ITEMS.map((navItem) => navItem.num)).toEqual([
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
    ]);
  });

  it('every item declares a real capability, a screen code and a state', () => {
    ALL_NAV_ITEMS.forEach((navItem) => {
      expect(ADMIN_CAPABILITY_NAMES).toContain(navItem.capability);
      expect(navItem.screen).toMatch(/^(ADMIN-0[1-8]|SETTINGS)$/);
      expect(['available', 'not_implemented']).toContain(navItem.state);
      expect(navItem.labelKey.length).toBeGreaterThan(0);
    });
  });

  it('AI providers is the only SUPER_ADMIN-gated entry, and news management is the only news.manage pair', () => {
    const byCapability = (capability: string) =>
      ALL_NAV_ITEMS.filter((navItem) => navItem.capability === capability).map(
        (navItem) => navItem.id,
      );

    expect(byCapability('provider.configure')).toEqual(['aiProviders']);
    expect(byCapability('news.manage')).toEqual(['news', 'sources']);
    expect(byCapability('support.handle')).toEqual(['support']);
  });

  describe('capability filtering', () => {
    it('an empty or missing grant yields NO navigation at all — fail closed', () => {
      expect(visibleNavGroups([])).toEqual([]);
      expect(visibleNavGroups(undefined)).toEqual([]);
    });

    it('a capability the caller lacks OMITS the item entirely — it is never returned disabled', () => {
      const groups = visibleNavGroups(['analytics.view']);
      const ids = groups.flatMap((group) => group.items.map((navItem) => navItem.id));

      expect(ids).not.toContain('news');
      expect(ids).not.toContain('aiProviders');
      expect(ids).not.toContain('support');
      expect(ids).toContain('overview');
      expect(ids).toContain('analytics');
    });

    it('a group with no visible item disappears rather than rendering an empty heading', () => {
      const groups = visibleNavGroups(['support.handle']);
      expect(groups.map((group) => group.labelKey)).toEqual(['support']);
    });

    it('a full grant shows every item', () => {
      const groups = visibleNavGroups([...ADMIN_CAPABILITY_NAMES]);
      expect(groups.flatMap((group) => group.items)).toHaveLength(14);
    });

    it('an unknown capability string grants nothing', () => {
      expect(visibleNavGroups(['not.a.capability'])).toEqual([]);
    });
  });

  describe('active route resolution', () => {
    it('a deeper route wins over its parent', () => {
      expect(navItemForPath(ADMIN_ROUTES.newsSources)?.id).toBe('sources');
      expect(navItemForPath(ADMIN_ROUTES.aiProviders)?.id).toBe('aiProviders');
      expect(navItemForPath(ADMIN_ROUTES.paymentsKsef)?.id).toBe('payments');
    });

    it('/admin resolves to Overview', () => {
      expect(navItemForPath('/admin')?.id).toBe('overview');
    });
  });

  describe('the DOM can never express a disabled nav item', () => {
    it('no admin component renders a disabled navigation control', () => {
      const navFiles = adminComponentFiles().filter((file) =>
        /AdminNavItem|AdminSidebar/.test(file),
      );
      expect(navFiles.length).toBeGreaterThanOrEqual(2);

      navFiles.forEach((file) => {
        const source = readFileSync(file, 'utf-8');
        // aria-disabled is permitted ONLY on the not_implemented branch,
        // which the design specifies as a chip. A `disabled` attribute on
        // a nav control would be the "disabled and teasing" pattern the
        // navigation contract forbids.
        expect(source).not.toMatch(/\bdisabled=\{/);
        expect(source).not.toMatch(/\bdisabled\s*\/?>/);
      });
    });
  });

  it('the manifest is frozen — a caller cannot append an item at runtime', () => {
    expect(Object.isFrozen(NAV_MANIFEST)).toBe(true);
    expect(Object.isFrozen(ALL_NAV_ITEMS)).toBe(true);
  });
});
