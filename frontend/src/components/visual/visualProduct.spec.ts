import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EAST_AFRICA_MEMBERS, EU27_MEMBERS, MIDDLE_EAST_MEMBERS, productCoverageScope } from '@globalnews-ai/shared';
import { routeGateDecision, STANDALONE_ALLOWLIST } from '@/lib/routing/standaloneRouteGate';
import { VISUAL_CLICK_CONTRACT } from '@/lib/visual/visualClickContract';
import { VISUAL_REGIONS } from '@/lib/visual/visualRegions';
import { VISUAL_NAV_NOT_ACTIVE, VISUAL_PHONE_NAV, VISUAL_TOP_NAV } from '@/lib/visual/visualNav';
import { visualEn } from '@/lib/i18n/dictionaries/visualEn';
import { visualPl } from '@/lib/i18n/dictionaries/visualPl';
import { VisualBriefStateView, type VisualBriefActions } from './VisualBriefStateView';
import type { EvidenceRevision, StoredBriefContent, StoryBriefView, StoryId } from '@/lib/storyBrief/storyBriefView';

/**
 * COMPACT VISUAL PRODUCT R1 — `/visual` qualification spec. Fixtures exist ONLY here (S-7).
 */
const SRC = join(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
const stripComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function filesUnder(rel: string): string[] {
  const root = join(SRC, rel);
  if (!existsSync(root)) return [];
  if (statSync(root).isFile()) return [rel];
  return readdirSync(root).flatMap((name) => filesUnder(join(rel, name)));
}
const VISUAL_RUNTIME = [
  ...filesUnder('components/visual'),
  ...filesUnder('lib/visual'),
  ...filesUnder('lib/storyBrief'),
  'lib/api/storyBriefApi.ts',
  'app/visual/page.tsx',
].filter((f) => !/\.spec\.tsx?$/.test(f));

describe('the route: Alpha-only by construction, never indexed', () => {
  it('Standalone (Production) redirects /visual to / before any page runs; platform (Alpha) serves it', () => {
    expect(routeGateDecision(true, '/visual')).toBe('REDIRECT_ROOT');
    expect(routeGateDecision(true, '/visual/')).toBe('REDIRECT_ROOT');
    expect(routeGateDecision(false, '/visual')).toBe('PASS');
    expect(STANDALONE_ALLOWLIST.pages).not.toContain('/visual');
  });
  it('the page is noindex, refuses Standalone itself, and is absent from the sitemap', () => {
    const page = read('app/visual/page.tsx');
    expect(page).toContain('robots: { index: false, follow: false }');
    expect(page).toContain('if (standaloneAskRoot()) notFound();');
    expect(read('app/sitemap.ts')).not.toContain('/visual');
  });
  it('`/` and `/ask` are untouched by this lane', () => {
    expect(read('app/page.tsx')).not.toMatch(/visual/i);
    expect(read('app/ask/page.tsx')).not.toMatch(/components\/visual/);
  });
});

describe('the click contract: only Read Original leaves GlobalNewsAI', () => {
  it.each(VISUAL_CLICK_CONTRACT.map((row) => [row.id, row] as const))('%s — evidence holds', (_id, row) => {
    const code = read(row.evidence.file);
    if (row.evidence.contains !== undefined) expect(code).toContain(row.evidence.contains);
    if (row.evidence.lacks !== undefined) expect(code).not.toContain(row.evidence.lacks);
  });
  it('the only rows that leave are the explicit Read Original controls', () => {
    expect(VISUAL_CLICK_CONTRACT.filter((r) => r.leavesGlobalNewsAI).map((r) => r.id).sort()).toEqual(['brief.evidence-read-original', 'card.read-original']);
  });
  it('the story card holds exactly ONE anchor (Read Original) and no handler on the card, image, title or publisher', () => {
    const feed = stripComments(read('components/visual/VisualStoryFeed.tsx'));
    const card = feed.slice(feed.indexOf('export function VisualStoryCard'));
    expect(card.match(/<a\b/g)).toHaveLength(1);
    expect(card).toMatch(/<a\s+href=\{href\}\s+target="_blank"\s+rel="noopener noreferrer"\s+data-visual-action="read-original"/);
    expect(card).not.toMatch(/<article[^>]*onClick/);
    expect(card).not.toMatch(/<h3[^>]*onClick/);
    expect(card).toContain('<div aria-hidden="true" data-visual-card-image="" className="pointer-events-none select-none">');
  });
});

describe('the seven Story Brief states render only what the server supplied', () => {
  const STORY = '2f1c6a8e-1b3d-4c5e-9f00-112233445566' as StoryId;
  const REV = 'rev' as EvidenceRevision;
  const stored: StoredBriefContent = {
    version: 3,
    conclusion: 'READY',
    evidenceRevision: REV,
    asOf: '2026-10-05T10:00:00.000Z',
    generatedAt: '2026-10-05T10:00:01.000Z',
    summary: 'FIXTURE summary.',
    keyFacts: [{ claim: 'FIXTURE fact.', sourceArticleIds: ['a', 'b'] }],
    background: null,
    evidence: [{ id: 'a', url: 'https://outlet.invalid/a', title: 'FIXTURE evidence', publisher: 'FIXTURE outlet', publishedAt: null }],
    coverageGaps: ['FIXTURE gap'],
    uncertainty: [],
  };
  const base = { storyId: STORY, currentEvidenceRevision: REV, versions: 3 };
  const none: VisualBriefActions = { prepare: null, refresh: null, retry: null, recheck: null, signInHref: null, busy: false, onPreviewEvidence: () => undefined };
  const render = (view: StoryBriefView, actions: VisualBriefActions = none): string =>
    renderToStaticMarkup(h(VisualBriefStateView, { view, language: 'en', actions }));

  it('NONE without generation: says so and offers NO control (no teaser, no disabled button)', () => {
    const html = render({ ...base, state: 'NONE', generationAvailable: false });
    expect(html).toContain(visualEn.brief.noneUnavailableBody);
    expect(html).not.toContain('<button');
    expect(html).not.toContain(visualEn.brief.signInToPrepare);
  });
  it('NONE with generation: a signed-in reader gets Prepare; a guest gets only the sign-in line', () => {
    expect(render({ ...base, state: 'NONE', generationAvailable: true }, { ...none, prepare: () => undefined })).toContain(visualEn.brief.prepare);
    const guest = render({ ...base, state: 'NONE', generationAvailable: true }, { ...none, signInHref: '/api/auth/google' });
    expect(guest).toContain(visualEn.brief.signInToPrepare);
    expect(guest).not.toContain(visualEn.brief.prepare);
  });
  it('CHECKING: the generic line only — no stage list, no percentage, no counter', () => {
    const html = render({ ...base, state: 'CHECKING', generationAvailable: true, inspectable: null });
    expect(html).toContain(visualEn.brief.checking);
    expect(html).not.toMatch(/%|<ol/);
  });
  it('READY: the saved version, "reopened, no new check", and internal evidence rows', () => {
    const html = render({ ...base, state: 'READY', generationAvailable: false, brief: stored });
    expect(html).toContain('reopened, no new check');
    expect(html).toContain('FIXTURE summary.');
    expect(html).toContain(visualEn.brief.previewEvidence);
    expect(html).not.toContain('href='); /* no exit from the Brief body: evidence previews first */
  });
  it('STALE: "evidence has changed" — never a count, never a materiality claim', () => {
    const html = render({ ...base, state: 'STALE', generationAvailable: false, brief: stored, lastAttemptFailure: null });
    expect(html).toContain(visualEn.brief.staleTitle);
    expect(html).not.toMatch(/\bnewer reports?\b|material/i);
    expect(html).not.toContain(visualEn.brief.refresh); /* no refresh control unless the panel supplies one */
  });
  it('PARTIAL names the server’s gaps; INSUFFICIENT and FAILED share no sentence', () => {
    expect(render({ ...base, state: 'PARTIAL', generationAvailable: false, brief: { ...stored, conclusion: 'PARTIAL' } })).toContain('FIXTURE gap');
    const insufficient = render({ ...base, state: 'INSUFFICIENT', generationAvailable: false, brief: { ...stored, conclusion: 'INSUFFICIENT' } });
    const failed = render({ ...base, state: 'FAILED', generationAvailable: false, failureKind: 'PROVIDER_DEGRADED' });
    expect(insufficient).toContain(visualEn.brief.insufficientTitle);
    expect(failed).toContain(visualEn.brief.failedKinds.PROVIDER_DEGRADED);
    for (const s of [visualEn.brief.insufficientTitle, visualEn.brief.insufficientNote]) expect(failed).not.toContain(s);
    for (const s of [visualEn.brief.failedTitle, visualEn.brief.failedNote]) expect(insufficient).not.toContain(s);
    expect(failed).not.toContain('FIXTURE summary.');
  });
});

describe('prototype runtime, SAMPLE data and browser storage are excluded (H0/21, S-4, S-8)', () => {
  const FORBIDDEN: readonly RegExp[] = [
    /support\.js/,
    /@babel\/standalone/,
    /unpkg\.com|cdn\.jsdelivr|cdnjs\./,
    /fonts\.googleapis/,
    /example\.org/,
    /global-map\.js/,
    /from ['"]d3/,
    /topojson/,
    /world-atlas/,
    /localStorage|sessionStorage|indexedDB/,
    /setInterval|requestAnimationFrame/,
    /\bSAMPLE\b/,
  ];
  it.each(VISUAL_RUNTIME.map((f) => [f]))('%s', (file) => {
    const code = stripComments(read(file));
    for (const pattern of FORBIDDEN) expect(code).not.toMatch(pattern);
  });
  it('no runtime module imports a spec or fixture', () => {
    for (const file of VISUAL_RUNTIME) expect(read(file)).not.toMatch(/from ['"][^'"]*(\.spec|fixture)/i);
  });
  it('the scan covers every visual runtime file', () => {
    expect(VISUAL_RUNTIME.length).toBeGreaterThanOrEqual(14);
    expect(VISUAL_RUNTIME.map((f) => relative('.', f))).toContain(join('components', 'visual', 'VisualBriefPanel.tsx'));
  });
});

describe('regions carry their DECLARED meaning (PUBLIC-ENGINEERING-BASELINE-R1)', () => {
  const region = (id: string) => VISUAL_REGIONS.find((r) => r.id === id)!;
  it('counts are read from the shared product-governed lists, not restated', () => {
    expect(region('eastAfrica').memberCount).toBe(EAST_AFRICA_MEMBERS.length);
    expect(region('middleEast').memberCount).toBe(MIDDLE_EAST_MEMBERS.length);
    expect(region('eu').memberCount).toBe(EU27_MEMBERS.length);
    expect(region('eac').memberCount).toBeNull();
    expect(region('europe').memberCount).toBeNull();
  });
  it('Ask retrieval scopes are EAC and East Africa, separately — matching the backend source (CTO R-1)', () => {
    expect(VISUAL_REGIONS.filter((r) => r.askRetrieval).map((r) => r.id).sort()).toEqual(['eac', 'eastAfrica']);
    const backend = readFileSync(join(SRC, '..', '..', 'backend', 'src', 'modules', 'analysis', 'region', 'declared-regions.ts'), 'utf8');
    expect(backend).toContain('export const DECLARED_REGIONS: readonly DeclaredRegion[] = [EAST_AFRICAN_COMMUNITY, EAST_AFRICA];');
  });
  it('product scopes speak with the shared authority: English label + disclosure ARE PRODUCT_COVERAGE_SCOPES (CTO R-2)', () => {
    const pairs = [
      ['eastAfrica', 'region:east-africa'],
      ['middleEast', 'region:middle-east'],
      ['eu', 'region:european-union'],
    ] as const;
    for (const [id, scopeId] of pairs) {
      const scope = productCoverageScope(scopeId)!;
      expect(region(id).productScope).toBe(scopeId);
      expect(region(id).membership).toBe('PRODUCT_GOVERNED');
      expect(visualEn.map.regionScopeLabel[id]).toBe(scope.scopeLabel);
      expect(visualEn.map.regionMeaning[id]).toBe(scope.disclosure);
    }
    expect(visualEn.map.regionScopeLabel.middleEast).toBe('GlobalNewsAI Middle East monitoring scope');
    expect(visualEn.map.regionMeaning.middleEast).toMatch(/no agreed geographic membership/);
  });
  it('Europe is M49 and not the EU; the EAC is its treaty members, not the East Africa scope; no stale f0e08de copy', () => {
    expect(region('europe').membership).toBe('UN_M49');
    expect(region('eac').productScope).toBeNull();
    expect(visualEn.map.regionMeaning.europe).toMatch(/Not the European Union/);
    expect(visualEn.map.regionMeaning.eac).toMatch(/different group from the GlobalNewsAI East Africa scope/);
    const all = JSON.stringify([visualEn.map, visualPl.map]);
    expect(all).not.toMatch(/no separate EAC scope|over its East Africa scope|nie ma osobnego zakresu EAC/);
  });
  it('no region Watch is offered: the unavailable state is said', () => {
    expect(visualEn.map.regionWatch).toMatch(/not available/);
    expect(stripComments(read('components/visual/VisualHeroMap.tsx'))).not.toMatch(/openAlertSetup|watch\(/i);
  });
});

describe('navigation is capability-driven over REAL destinations (H0/28)', () => {
  it('every destination is a real route or a real section; no invented route', () => {
    const hrefs = [...VISUAL_TOP_NAV, ...VISUAL_PHONE_NAV].map((n) => n.href);
    for (const href of hrefs) {
      if (href.startsWith('#')) continue;
      expect(existsSync(join(SRC, 'app', ...href.split('/').filter(Boolean), 'page.tsx'))).toBe(true);
    }
    expect(hrefs).not.toEqual(expect.arrayContaining(['/watches']));
    expect(hrefs.some((h) => /\/(watches|updates|explore)$/.test(h))).toBe(false);
    expect(Object.keys(VISUAL_NAV_NOT_ACTIVE)).toEqual(['myWatches', 'more']);
  });
  it('the Saved Ask briefings label is never shortened to the ambiguous "Briefings" (H0 ruling 1)', () => {
    expect(visualEn.nav.savedAskBriefings).toBe('Saved Ask briefings');
    expect(visualEn.nav.savedAskBriefingsShort).not.toBe('Briefings');
  });
});

describe('copy: EN and PL carry the same keys', () => {
  const shape = (o: unknown): unknown =>
    typeof o === 'object' && o !== null ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)])) : typeof o;
  it('identical shape', () => {
    expect(shape(visualPl)).toEqual(shape(visualEn));
  });
});

describe('the shared WorldMap change is additive and defaulted', () => {
  it('frame and trackHostResize default to today’s behaviour and only /visual passes them', () => {
    const map = read('components/map/WorldMap.tsx');
    expect(map).toContain('  frame,\n  trackHostResize = false,');
    const callers = filesUnder('components').filter((f) => f.endsWith('.tsx') && !f.startsWith(join('components', 'visual')));
    for (const file of callers) expect(read(file)).not.toMatch(/<WorldMap[\s\S]{0,400}?\b(frame|trackHostResize)=/);
  });
});

describe('Alpha Admin linkage: "Inspect in Admin" is Admin-only and canonical', () => {
  const panel = stripComments(read('components/visual/VisualBriefPanel.tsx'));
  const hook = stripComments(read('lib/visual/visualAdminInspect.ts'));
  it('renders ONLY when the Admin identity check allows it — never for an ordinary reader', () => {
    expect(panel).toMatch(/\{adminInspect && \(\s*<a\s/);
    expect(panel).toContain("useVisualAdminInspect(panel.kind === 'brief' && !isLoading && user !== null)");
    expect(hook).toContain("hasCapability(me.capabilities, 'news.manage')");
    expect(hook).toMatch(/if \(!response\.ok\) return false;/);
    expect(hook).toContain('return active && allowed;');
  });
  it('uses the existing Admin identity read and the declared Admin route — no hardcoded /admin path', () => {
    expect(hook).toContain('accountFetch(ADMIN_API.me)');
    expect(hook).toContain('ADMIN_ROUTES.newsStories');
    expect(hook).not.toMatch(/['"\x60]\/admin/);
  });
  it('links with the canonical id the panel holds (storyId, else articleRef) and the panel carries all four', () => {
    expect(panel).toContain('adminStoryHref({ storyId, articleRef: story.articleRef })');
    for (const attr of ['data-article-ref', 'data-story-id', 'data-material-version', 'data-evidence-revision', 'data-brief-version']) expect(panel).toContain(attr);
  });
});

describe('Admin story inspection lives in the EXISTING Admin application', () => {
  it('a thin Server Component page under the Admin shell, reading only through the sanctioned hook', () => {
    const page = read('app/admin/news/stories/page.tsx');
    const screen = stripComments(read('components/admin/screens/StoryInspectionScreen.tsx'));
    expect(page).not.toContain("'use client'");
    expect(page).toContain("from '@/components/admin/screens/StoryInspectionScreen'");
    expect(screen).toContain('useAdminResource<StoryInspectionData>(`${ADMIN_API.stories}/${storyId}/brief`)');
    expect(screen).toContain('useAdminResource<{ story: { storyId: string } | null }>(`${ADMIN_API.stories}/by-article/${articleRef}`)');
    expect(screen).toContain("can('news.manage')");
    expect(screen).not.toMatch(/accountFetch|method:\s*'POST'/);
  });
});
