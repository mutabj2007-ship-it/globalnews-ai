import { existsSync } from 'fs';
import { join } from 'path';
import {
  ASK_MENU_KINDS,
  ASK_MENU_MODEL,
  ASK_MENU_SECTIONS,
  ASK_MENU_UTILITIES,
  ASK_NAV_EXCLUDED_LABELS,
  ASK_NAV_EXCLUDED_ROUTES,
  ASK_NAV_LIVE_ROUTES,
  ASK_NAV_PENDING_ROUTES,
  askMenuFor,
  askMenuSectionsFor,
  askUtilitiesFor,
  COMPUTE_ENDPOINTS,
  ZERO_COMPUTE_INTERACTIONS,
  type AskMenuAudience,
  type AskMenuEntry,
} from './askNavModel';
import { ASK_NAV_MATRIX, matrixRowIsLive } from './askNavMatrix';
import { askNavStringsFor } from './ask/askNavStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STANDALONE ASK NAVIGATION — THE RULED SET, ASSERTED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SUPERSESSION RECORD. This suite previously asserted the ASK PERSONAL
 * NAVIGATION + TODAY R2 architecture, in which Today, World Map and My
 * Intelligence were menu entries. The ASK GLOBALNEWSAI STANDALONE BETA
 * correction removes all three from the Ask navigation, so the assertions are
 * INVERTED rather than deleted: this file now proves those destinations are
 * ABSENT. An inverted assertion is the only kind that keeps a removal removed.
 *
 * The two properties every case here serves:
 *
 *   NO DEAD CONTROLS — a rendered row's destination exists, proved against the
 *   real app router on disk, not against a list someone maintains by hand.
 *
 *   ABSENCE IS ABSENCE — a signed-out reader gets a SHORTER menu, never a
 *   greyed one. There is no `disabled` flag to assert the absence of, because
 *   the type does not have one.
 */

const ALL_DECLARED_ROUTES: readonly string[] = [...ASK_NAV_LIVE_ROUTES, ...ASK_NAV_PENDING_ROUTES];

/** src/app/<segment>/page.tsx for a route, the way the App Router resolves it. */
function pageFileFor(route: string): string {
  const segments = route === '/' ? [] : route.replace(/^\//, '').split('/');
  return join(__dirname, '..', 'app', ...segments, 'page.tsx');
}

function labelsOf(entries: readonly AskMenuEntry[]): string[] {
  return entries.map((entry) => entry.label);
}

/** The full ruled order a reader meets: sections first, then utilities. */
function rulesFor(audience: AskMenuAudience, liveRoutes: readonly string[]): string[] {
  return [
    ...labelsOf([...askMenuFor(audience, liveRoutes)]),
    ...labelsOf([...askUtilitiesFor(audience)]),
  ];
}

describe('STANDALONE ASK NAVIGATION — the Product Owner ruled set', () => {
  it('declares exactly the signed-in set, in the ruled order', () => {
    expect(rulesFor('signed-in', ALL_DECLARED_ROUTES)).toEqual([
      'New question',
      'Recent',
      'Saved',
      'Help & feedback',
      'Settings',
      'Language',
      'Sign out',
    ]);
  });

  it('declares exactly the signed-out set, in the ruled order', () => {
    expect(rulesFor('signed-out', ALL_DECLARED_ROUTES)).toEqual([
      'New question',
      'Help & feedback',
      'Language',
      'Sign in',
    ]);
  });

  it('gives the signed-out reader a SHORTER menu, not a greyed one', () => {
    const out = askMenuFor('signed-out', ALL_DECLARED_ROUTES);
    const inn = askMenuFor('signed-in', ALL_DECLARED_ROUTES);
    expect(out.length).toBeLessThan(inn.length);
    for (const entry of [...ASK_MENU_MODEL, ...ASK_MENU_UTILITIES]) {
      expect(Object.keys(entry)).not.toContain('disabled');
      expect(Object.keys(entry)).not.toContain('unavailable');
    }
  });
});

describe('STANDALONE ASK NAVIGATION — the correction removal list', () => {
  it('carries none of the nineteen excluded labels', () => {
    expect(ASK_NAV_EXCLUDED_LABELS).toHaveLength(19);
    const carried = [...ASK_MENU_MODEL, ...ASK_MENU_UTILITIES].flatMap((entry) => [
      entry.label,
      entry.labelKey,
    ]);
    for (const excluded of ASK_NAV_EXCLUDED_LABELS) {
      expect(carried).not.toContain(excluded);
    }
  });

  it('names Today, World Map and My Intelligence as removed — the R2 entries this supersedes', () => {
    for (const gone of ['Today', 'World Map', 'My Intelligence']) {
      expect(ASK_NAV_EXCLUDED_LABELS).toContain(gone);
    }
  });

  it('points at none of the excluded routes, including the legacy /history', () => {
    const hrefs = [...ASK_MENU_MODEL, ...ASK_MENU_UTILITIES]
      .map((entry) => entry.href)
      .filter((href): href is string => href !== undefined);
    for (const excluded of ASK_NAV_EXCLUDED_ROUTES) {
      expect(hrefs).not.toContain(excluded);
    }
    expect(ASK_NAV_EXCLUDED_ROUTES).toContain('/history');
  });

  it('keeps DISCOVER and YOUR INTELLIGENCE out of the section union entirely', () => {
    expect(ASK_MENU_SECTIONS).toEqual(['ask', 'support']);
    expect(ASK_MENU_SECTIONS as readonly string[]).not.toContain('discover');
    expect(ASK_MENU_SECTIONS as readonly string[]).not.toContain('yourIntelligence');
  });

  it('cannot express a dead control: there is no "unavailable" kind', () => {
    expect(ASK_MENU_KINDS).toEqual(['route', 'action']);
    expect(ASK_MENU_KINDS as readonly string[]).not.toContain('unavailable');
  });
});

describe('STANDALONE ASK NAVIGATION — no dead controls, proved against the app router', () => {
  it('every route the shell may render exists on disk', () => {
    for (const route of ASK_NAV_LIVE_ROUTES) {
      expect(existsSync(pageFileFor(route))).toBe(true);
    }
  });

  /**
   * HANDOFF TRIPWIRE — CLAUDE H.
   *
   * Recent and Saved are ruled INTO the signed-in navigation but are H's routes
   * and do not exist yet. Rendering them today would ship two 404s as menu
   * rows, so `askMenuFor` suppresses them.
   *
   * WHEN H LANDS EITHER ROUTE THIS CASE FAILS ON PURPOSE. The fix is one line:
   * move that path from ASK_NAV_PENDING_ROUTES to ASK_NAV_LIVE_ROUTES in
   * askNavModel.ts and set its matrix row `live: true`. The row then appears
   * with no change to the model, the renderer or any other test.
   */
  /**
   * ONE-CONTRACT ACTIVATION. CTO requires the convergence with Claude H to be a
   * deterministic one-line change. `ASK_NAV_LIVE_ROUTES` is that single switch:
   * the renderer filters on it and the matrix derives liveness from it, so no
   * second edit exists to forget.
   */
  it('activation is ONE array — the matrix stores no second copy of liveness', () => {
    for (const row of ASK_NAV_MATRIX) {
      expect(Object.keys(row)).not.toContain('live');
    }
    const pendingRows = ASK_NAV_MATRIX.filter((row) => !matrixRowIsLive(row));
    expect(pendingRows.map((row) => row.route).sort()).toEqual([...ASK_NAV_PENDING_ROUTES].sort());
  });

  /*
    STANDALONE PUBLIC BETA CONVERGENCE R1 — the H handoff is COMPLETE: its two pages exist in
    the app router and ASK_NAV_LIVE_ROUTES carries them (the one-array switch this model was
    built around). Nothing is pending, the signed-in menu is full, and signed-out still never
    shows a signed-in continuity row.
  */
  it('HANDOFF COMPLETE: Claude H routes exist and are live; nothing is pending', () => {
    expect(ASK_NAV_PENDING_ROUTES).toEqual([]);
    for (const route of ['/ask/recent', '/saved']) {
      expect(existsSync(pageFileFor(route))).toBe(true);
      expect(ASK_NAV_LIVE_ROUTES).toContain(route);
    }
    expect(labelsOf([...askMenuFor('signed-in')])).toEqual([
      'New question',
      'Recent',
      'Saved',
      'Help & feedback',
      'Settings',
    ]);
    const signedOut = labelsOf([...askMenuFor('signed-out')]);
    expect(signedOut).not.toContain('Recent');
    expect(signedOut).not.toContain('Saved');
  });

  it('the same model yields the full menu the moment H lands, with no code change', () => {
    const after = labelsOf([...askMenuFor('signed-in', ALL_DECLARED_ROUTES)]);
    expect(after).toEqual(['New question', 'Recent', 'Saved', 'Help & feedback', 'Settings']);
  });

  it('the rows owned by Claude H are exactly its two routes, and both are now live', () => {
    const owned = ASK_MENU_MODEL.filter((entry) => entry.ownedElsewhere === 'claude-h');
    expect(owned.map((entry) => entry.href).sort()).toEqual(['/ask/recent', '/saved']);
    for (const entry of owned) expect(ASK_NAV_LIVE_ROUTES).toContain(entry.href);
  });

  it('every visible route entry carries an href, and every action carries an action', () => {
    for (const audience of ['signed-in', 'signed-out'] as const) {
      for (const entry of askMenuFor(audience, ALL_DECLARED_ROUTES)) {
        expect(entry.kind).toBe('route');
        expect(typeof entry.href).toBe('string');
      }
      for (const entry of askUtilitiesFor(audience)) {
        expect(entry.kind).toBe('action');
        expect(typeof entry.action).toBe('string');
        expect(entry.href).toBeUndefined();
      }
    }
  });
});

describe('STANDALONE ASK NAVIGATION — destructive rows', () => {
  it('Sign out is the only destructive entry', () => {
    const destructive = [...ASK_MENU_MODEL, ...ASK_MENU_UTILITIES].filter(
      (entry) => entry.destructive === true,
    );
    expect(destructive.map((entry) => entry.id)).toEqual(['sign-out']);
  });

  it('no destructive row sits in the navigation row itself', () => {
    for (const entry of ASK_MENU_MODEL) {
      expect(entry.destructive).toBeUndefined();
    }
  });

  it('Sign in and Sign out name no static route — /login does not exist', () => {
    for (const id of ['sign-in', 'sign-out']) {
      const entry = ASK_MENU_UTILITIES.find((candidate) => candidate.id === id);
      expect(entry?.href).toBeUndefined();
    }
    expect(existsSync(pageFileFor('/login'))).toBe(false);
  });
});

describe('STANDALONE ASK NAVIGATION — the matrix agrees with the model', () => {
  it('lists exactly the destinations the model declares, in the same order', () => {
    const declared = [...labelsOf([...ASK_MENU_MODEL]), ...labelsOf([...ASK_MENU_UTILITIES])];
    expect(ASK_NAV_MATRIX.map((row) => row.destination)).toEqual(declared);
  });

  it('agrees on visibility, route and liveness for every row', () => {
    for (const row of ASK_NAV_MATRIX) {
      const entry = [...ASK_MENU_MODEL, ...ASK_MENU_UTILITIES].find(
        (candidate) => candidate.label === row.destination,
      );
      expect(entry).toBeDefined();
      if (entry === undefined) continue;
      expect(entry.audiences.includes('signed-in')).toBe(row.signedIn === 'visible');
      expect(entry.audiences.includes('signed-out')).toBe(row.signedOut === 'visible');
      expect(entry.href ?? null).toEqual(row.route);
      const live = entry.href === undefined || ASK_NAV_LIVE_ROUTES.includes(entry.href);
      expect(matrixRowIsLive(row)).toBe(live);
    }
  });

  it('states 0 AI and 0 provider for every row', () => {
    for (const row of ASK_NAV_MATRIX) {
      expect(row.aiCost).toBe('0');
      expect(row.providerCost).toBe('0');
    }
  });
});

describe('STANDALONE ASK NAVIGATION — EN and PL', () => {
  it('resolves every labelKey in both languages, with no empty and no untranslated label', () => {
    const en = askNavStringsFor('en') as unknown as Record<string, string | undefined>;
    const pl = askNavStringsFor('pl') as unknown as Record<string, string | undefined>;
    for (const entry of [...ASK_MENU_MODEL, ...ASK_MENU_UTILITIES]) {
      const enLabel = en[entry.labelKey];
      const plLabel = pl[entry.labelKey];
      expect(typeof enLabel).toBe('string');
      expect(typeof plLabel).toBe('string');
      expect(enLabel?.length ?? 0).toBeGreaterThan(0);
      expect(plLabel?.length ?? 0).toBeGreaterThan(0);
      expect(plLabel).not.toEqual(enLabel);
    }
  });

  it('the English label in the model matches the English string, so provenance is one wording', () => {
    const en = askNavStringsFor('en') as unknown as Record<string, string | undefined>;
    for (const entry of [...ASK_MENU_MODEL, ...ASK_MENU_UTILITIES]) {
      expect(en[entry.labelKey]).toBe(entry.label);
    }
  });

  it('translates every chrome string too, not only the rows', () => {
    const en = askNavStringsFor('en');
    const pl = askNavStringsFor('pl');
    expect(Object.keys(pl)).toEqual(Object.keys(en));
    for (const key of Object.keys(en)) {
      const value = (pl as unknown as Record<string, string>)[key];
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('STANDALONE ASK NAVIGATION — zero compute', () => {
  it('names every navigation interaction as zero-compute', () => {
    for (const entry of [...ASK_MENU_MODEL, ...ASK_MENU_UTILITIES]) {
      if (entry.id === 'sign-out') continue;
      expect(ZERO_COMPUTE_INTERACTIONS).toContain(entry.id);
    }
    expect(ZERO_COMPUTE_INTERACTIONS).toContain('open-menu');
    expect(ZERO_COMPUTE_INTERACTIONS).toContain('close-menu');
  });

  it('no entry destination is a compute endpoint', () => {
    const hrefs = [...ASK_MENU_MODEL, ...ASK_MENU_UTILITIES]
      .map((entry) => entry.href)
      .filter((href): href is string => href !== undefined);
    for (const endpoint of COMPUTE_ENDPOINTS) {
      expect(hrefs).not.toContain(endpoint);
    }
  });
});

describe('STANDALONE ASK NAVIGATION — section projection', () => {
  it('omits empty sections rather than rendering an empty heading', () => {
    const groups = askMenuSectionsFor('signed-out');
    for (const group of groups) {
      expect(group.entries.length).toBeGreaterThan(0);
    }
    expect(groups.map((group) => group.section)).toEqual(['ask', 'support']);
  });

  it('projects sections in the ruled order for every audience', () => {
    for (const audience of ['signed-in', 'signed-out'] as const) {
      const order = askMenuSectionsFor(audience, ALL_DECLARED_ROUTES).map((g) => g.section);
      expect(order).toEqual([...ASK_MENU_SECTIONS].filter((s) => order.includes(s)));
    }
  });
});
