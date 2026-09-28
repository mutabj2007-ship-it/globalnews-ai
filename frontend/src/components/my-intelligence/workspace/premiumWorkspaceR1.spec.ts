import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ANALYSIS_WORKSPACE_HREF,
  COLLECTION_PREVIEW,
  DASHBOARD_ROWS,
  ELECTIONS_PREVIEW_HREF,
  FOR_YOU_PREVIEW,
  GOVERNED_ELECTION_COUNTRIES,
  IMIHIGO_HREF,
  INTELLIGENCE_DOMAINS,
  RAIL,
  electionsSupportedFor,
  initialOpenGroups,
  previewCount,
} from './miWorkspaceModel';
import { electionLiveRouteMayOpen } from '@/lib/election/electionPreview';
import { FORBIDDEN_TIER_VIOLET, FORBIDDEN_WATCH_MINT } from '../miPresentation';
import { ExploreModule, GoDeeperCard, SpecialistModule } from './WorkspaceDashboard';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { FOR_YOU_LIMIT } from '../useMyIntelligenceData';

jest.mock('next/link', () => {
  const react = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children, ...rest }: { href: string; children: unknown }) => react.createElement('a', { href, ...rest }, children) };
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE — PREMIUM WORKSPACE R1 · THE COMPOSITION'S RULES, ASSERTED
 * ════════════════════════════════════════════════════════════════════════════
 * Authority: MY-INTELLIGENCE-PREMIUM-WORKSPACE-R1 ("R1 review ZIPs and
 * navigation conflictsCTO.zip", SHA256 4059e9b3…a567ed4).
 */

const DIR = __dirname;
const MI = join(DIR, '..');
const read = (path: string): string => readFileSync(path, 'utf8');
const CLIENT = read(join(MI, 'MyIntelligenceClient.tsx'));
const NAV = read(join(DIR, 'WorkspaceNav.tsx'));
const DASHBOARD = read(join(DIR, 'WorkspaceDashboard.tsx'));
const CHROME = read(join(DIR, 'WorkspaceChrome.tsx'));
const MODEL = read(join(DIR, 'miWorkspaceModel.ts'));
const WORKSPACE = [CLIENT, NAV, DASHBOARD, CHROME, MODEL].join('\n');
const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('IA — the workspace replaces the tablist (D2), and stays client state', () => {
  it('there is no Overview | Saved | Following | Recent tablist any more', () => {
    expect(code(CLIENT)).not.toContain('role="tablist"');
    expect(code(CLIENT)).not.toContain("role=\"tab\"");
  });

  it('views are client state: the URL never carries a view (the sign-in return accepts exactly /my-intelligence)', () => {
    const body = code(WORKSPACE);
    expect(body).not.toMatch(/router\.(push|replace)\(/);
    expect(body).not.toMatch(/searchParams|\?view=|#saved|#for-you/);
    expect(CLIENT).toContain("useState<WorkspaceView>('today')");
  });

  it('only My Intelligence starts open; Intelligence, Specialists, Deep and Account are collapsed', () => {
    expect([...initialOpenGroups()]).toEqual(['mine']);
  });

  it('rail geometry is the SPEC: 64 collapsed · 280 expanded · 360 selection context rail', () => {
    expect(RAIL).toEqual({ collapsedPx: 64, expandedPx: 280, contextPx: 360 });
  });
});

describe('ZERO COMPUTE — navigation never spends', () => {
  it('no workspace file imports the analysis client or calls the selection action', () => {
    for (const source of [NAV, DASHBOARD, CHROME, MODEL]) {
      expect(code(source)).not.toMatch(/analyzeNews|runSelectionAction|analysisApi|fetch\(/);
    }
  });

  it('Analysis Workspace opens Ask AI idle, never /search?q= (which auto-runs analysis)', () => {
    expect(ANALYSIS_WORKSPACE_HREF).toBe('/ask');
    expect(code(WORKSPACE)).not.toMatch(/['"`]\/search\?q=/);
  });

  it('Ask again stages a draft through /ask?q= — the existing contract', () => {
    expect(DASHBOARD).toContain('href={`/ask?q=${encodeURIComponent(entry.query)}`}');
  });

  it('the client still has exactly ONE compute call: the governed runSelectionAction, behind the confirm sheet', () => {
    expect(code(CLIENT).match(/runSelectionAction\(/g)).toHaveLength(1);
    expect(CLIENT).toContain('<ComputeCommitSheet');
  });
});

describe('NO BROWSER STORAGE — the standing rule holds, the rail pin included (D11)', () => {
  it('no workspace file touches localStorage, sessionStorage or IndexedDB', () => {
    expect(code(WORKSPACE)).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });

  it('the pin is page state only', () => {
    expect(CLIENT).toContain('const [railPinned, setRailPinned] = useState(false);');
  });
});

describe('TRUTHFULNESS — nothing unavailable is presented as available', () => {
  it('Elections: no country is supported while the live route is gated and no governed list exists', () => {
    expect(electionLiveRouteMayOpen()).toBe(false);
    expect(GOVERNED_ELECTION_COUNTRIES).toEqual([]);
    for (const iso3 of ['KEN', 'POL', 'RWA', 'USA']) {
      expect(electionsSupportedFor(iso3, electionLiveRouteMayOpen())).toBe(false);
    }
    /* The rule itself: a governed list AND an open route are both required. */
    expect(electionsSupportedFor('KEN', true, ['KEN'])).toBe(true);
    expect(electionsSupportedFor('KEN', false, ['KEN'])).toBe(false);
  });

  it('no country is named as prepared or supported for Elections anywhere in the workspace copy', () => {
    for (const language of ['en', 'pl'] as const) {
      const s = getDictionary(language).myIntelligence.workspace.specialists;
      expect(JSON.stringify(s)).not.toMatch(/Kenya|Kenia|Prepared|Przygotowane/);
    }
  });

  it('Elections is a PREVIEW entry pointing at the preview route; Imihigo at its own route', () => {
    expect(ELECTIONS_PREVIEW_HREF).toBe('/election-visual-preview');
    expect(IMIHIGO_HREF).toBe('/imihigo');
    const html = renderToStaticMarkup(createElement(SpecialistModule, { language: 'en', onView: () => undefined }));
    expect(html).toContain('Preview');
    expect(html).toContain('href="/imihigo"');
  });

  it('Politics and Economy are labelled Preview and link only their preview routes (D5); no tile carries a count', () => {
    const previews = INTELLIGENCE_DOMAINS.filter((d) => d.preview).map((d) => [d.id, d.href]);
    expect(previews).toEqual([
      ['politics', '/politics-visual-preview'],
      ['economy', '/economy-visual-preview'],
    ]);
    const html = renderToStaticMarkup(createElement(ExploreModule, { language: 'en' }));
    expect(html.match(/>Preview</g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).not.toMatch(/>\d+</);
  });

  it('Deep Intelligence: informational, no route, no price, and a NEUTRAL tag — never tier violet (D1)', () => {
    const html = renderToStaticMarkup(createElement(GoDeeperCard, { language: 'en', onSelect: () => undefined }));
    expect(html).toContain('Not in Beta');
    expect(html).toContain('border-[#1d3a5a]');
    expect(WORKSPACE.toLowerCase()).not.toContain(FORBIDDEN_TIER_VIOLET.toLowerCase());
    expect(WORKSPACE.toUpperCase()).not.toContain(FORBIDDEN_WATCH_MINT);
    expect(html).not.toMatch(/€|\$|PLN|credit|kredyt|subscribe|upgrade/i);
  });

  it('Plan & usage is a status line with no paid plan, and no destination (D7)', () => {
    expect(getDictionary('en').myIntelligence.workspace.items.planStatus).toBe('Beta access · no paid plan active');
    expect(NAV).toContain('data-mi-plan-status');
  });
});

describe('DENSITY — the dashboard never renders a full collection', () => {
  it('SPEC bounds: 4 rows desktop / 3 phone; For you 6 / 3; collection previews 3', () => {
    expect(DASHBOARD_ROWS).toEqual({ desktop: 4, phone: 3 });
    expect(FOR_YOU_PREVIEW).toEqual({ desktop: 6, phone: 3 });
    expect(COLLECTION_PREVIEW).toBe(3);
    expect(FOR_YOU_LIMIT).toBe(FOR_YOU_PREVIEW.desktop);
    expect(previewCount(50, 3)).toBe(3);
    expect(previewCount(2, 3)).toBe(2);
  });

  it('phone hides rows past the third with CSS on ONE list, never a second list', () => {
    expect(DASHBOARD).toContain("const PHONE_BOUND_3 = 'max-md:[&>li:nth-child(n+4)]:hidden';");
    expect(DASHBOARD).toContain('stories.slice(0, DASHBOARD_ROWS.desktop)');
    /* INTEREST R1 — the module bounds whichever list it shows (interest-filtered, or the explicit broader list). */
    expect(DASHBOARD).toContain('source.slice(0, FOR_YOU_PREVIEW.desktop)');
  });
});

describe('PRESERVED ENGINEERING — the existing controls are reused, not redrawn', () => {
  it('Following opens the SAME bounded popout (openRequest), not a second list', () => {
    expect(CLIENT).toContain('openRequest={followingRequest}');
    expect(code(WORKSPACE)).not.toContain('<FollowingList');
  });

  it('bookmarks are the universal BookmarkButton; selection pills are the inherited ActionPill', () => {
    expect(DASHBOARD).toContain('<BookmarkButton');
    expect(CHROME).toContain('<ActionPill');
    expect(CHROME).toContain('t.compute.sandNote');
  });

  it('the phone keeps the inherited bottom selection rail; desktop gains the 360px context rail only while selecting', () => {
    expect(CLIENT).toContain('<SelectionRail');
    expect(CLIENT).toMatch(/\{selecting && \(\s*<SelectionContextRail/);
  });
});

describe('EN / PL — every new string exists in both languages', () => {
  const keys = (value: unknown, prefix = ''): string[] =>
    value !== null && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
      : [prefix];

  it('the workspace namespace has identical keys in EN and PL, none empty', () => {
    const en = getDictionary('en').myIntelligence.workspace;
    const pl = getDictionary('pl').myIntelligence.workspace;
    expect(keys(pl).sort()).toEqual(keys(en).sort());
    for (const k of keys(pl)) {
      const v = k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], pl);
      expect(`${k}:${String(v).length > 0}`).toBe(`${k}:true`);
    }
  });

  it('"Intelligence" is "Analiza" in Polish (CTO localisation ruling)', () => {
    expect(getDictionary('pl').myIntelligence.workspace.groups.intelligence).toBe('ANALIZA');
  });
});
