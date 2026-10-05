import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { ASK_SOCIAL_PREVIEW } from '@/lib/seo/socialPreview';

/**
 * STANDALONE PUBLIC BETA CONVERGENCE R1 — `/` is the standalone Ask entry surface.
 */
const SRC = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the root switch', () => {
  it('standalone Ask by default; the platform Home only when GNA_PUBLIC_ROOT=platform', () => {
    expect(standaloneAskRoot({})).toBe(true);
    expect(standaloneAskRoot({ GNA_PUBLIC_ROOT: 'ask' })).toBe(true);
    expect(standaloneAskRoot({ GNA_PUBLIC_ROOT: 'platform' })).toBe(false);
    expect(standaloneAskRoot({ GNA_PUBLIC_ROOT: ' Platform ' })).toBe(false);
  });

  it('is server-only — never a NEXT_PUBLIC_ variable', () => {
    expect(code(read('lib', 'ask', 'standaloneRoot.ts'))).not.toMatch(/NEXT_PUBLIC_/);
  });

  it('the root page branches BEFORE any Home data is fetched, and its metadata follows', () => {
    const page = code(read('app', 'page.tsx'));
    const branch = page.indexOf('if (standaloneAskRoot())', page.indexOf('export default'));
    expect(branch).toBeGreaterThan(-1);
    expect(page.indexOf('getHomeFeed(', branch)).toBeGreaterThan(
      page.indexOf('<AskStandaloneRoot', branch),
    );
    expect(page).toMatch(
      /if \(standaloneAskRoot\(\)\) \{\s*return buildPageMetadata\(\{\s*path: '\/'/,
    );
  });
});

describe('the standalone root carries no wider-platform surface', () => {
  const root = code(read('components', 'ask-nav', 'AskStandaloneRoot.tsx'));
  it.each([
    ['platform NavBar', /navigation\/NavBar/],
    ['bottom navigation', /MobileBottomNav/],
    ['Today / Home discovery', /components\/home|components\/today/],
    ['Map', /components\/map/],
    ['My Intelligence', /my-intelligence/i],
    [
      'specialist dashboards',
      /economy|election|energy|politics|security|humanitarian|market|imihigo|conflict/i,
    ],
  ])('no %s', (_label, pattern) => {
    expect(root).not.toMatch(pattern);
  });

  it('is the G shell over the D25 frame, plus truthful structured data', () => {
    expect(root).toContain('<AskNavShell');
    expect(root).toContain('<AskShellFrame');
    expect(root).toContain('<SiteStructuredData />');
  });
});

describe('the global Ask dock is not a second Ask control on the root', () => {
  const dock = code(read('components', 'ask', 'AskAiDock.tsx'));
  const layout = code(read('app', 'layout.tsx'));
  it('unmounts on / when the root is standalone, and on /ask as before', () => {
    expect(dock).toMatch(/if \(pathname === ASK_CANONICAL_ROUTE\) return null;/);
    expect(dock).toMatch(/if \(props\.standaloneRoot === true && pathname === '\/'\) return null;/);
    /* R4 · CTO dock-direction ruling — the mount also carries the reader's DisplayLocale */
    expect(layout).toMatch(
      /<AskAiDock\s+language=\{language\}\s+displayLocale=\{resolveAskLocale\(languageCookie\)\}\s+standaloneRoot=\{standaloneAskRoot\(\)\}\s*\/>/,
    );
  });
});

describe('the social preview asset', () => {
  it('is a real 1200×630 PNG at the path the metadata names', () => {
    const png = readFileSync(
      join(SRC, '..', 'public', ...ASK_SOCIAL_PREVIEW.path.split('/').filter(Boolean)),
    );
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(ASK_SOCIAL_PREVIEW.width);
    expect(png.readUInt32BE(20)).toBe(ASK_SOCIAL_PREVIEW.height);
    expect([ASK_SOCIAL_PREVIEW.width, ASK_SOCIAL_PREVIEW.height]).toEqual([1200, 630]);
  });
});
