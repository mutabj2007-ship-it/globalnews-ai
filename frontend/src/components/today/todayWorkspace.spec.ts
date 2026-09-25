import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  ANALYSE_CHROME,
  ANALYSE_FLOOR,
  COLUMN_MIN_IN_PLACE,
  DOCK_H_COMPACT,
  GEO_COL_W,
  GEO_COL_W_M,
  MAP_ASPECT,
  WATCH_COL_W,
  DOCK_RELOCATION_FLOOR,
  HEADER_COLLAPSE_SCROLL,
  DOCK_H_EXPANDED,
  HEADER_H_EXPANDED,
  S_BREAKPOINT,
  TODAY_FRAME_H,
  TODAY_FRAME_H_S,
  resolveDock,
  resolveGeographyColumnLayout,
  resolveGeographyLayout,
  resolveRelocatedGeographyLayout,
  resolveSectionColumnHeight,
} from '@/components/today/todayWorkspaceGeometry';

/**
 * R7 GENERATION 3 — THE TODAY WORKSPACE HOST, AS A SOURCE CONTRACT.
 *
 * A DEDICATED FILE, again. F's GEO-PRECISION-1 append region in
 * `dictionaries/index.spec.ts` is untouched, and so is every other lane's spec.
 *
 * What is proved here divides in two:
 *
 *   ARITHMETIC   the section frame resolves the same way the tier engine's own
 *                1,201-height test already proves, at every combination of the
 *                header and dock tracks.
 *   SOURCE       the honest-cell model, the bounded pulse, the one-CTA rule,
 *                the containment of scrolling, and the ABSENCE of every
 *                mechanism the CTO ruled out — a second analysis fetch, a
 *                fabricated intelligence field, an `html`/`body` override, an
 *                edit to H's Tailwind block.
 */
const dir = __dirname;
const read = (name: string): string => readFileSync(join(dir, name), 'utf-8');
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const workspaceSource = read('TodayWorkspace.tsx');
const workspace = codeOnly(workspaceSource);
const analyse = codeOnly(read('AnalysePanel.tsx'));
const row = codeOnly(read('SituationRow.tsx'));
const watchPanelSource = read('WatchPanel.tsx');
const watchPanel = codeOnly(watchPanelSource);
const dock = codeOnly(read('SourcesDock.tsx'));
const header = codeOnly(read('TodayHeader.tsx'));
const cta = codeOnly(read('WorkspaceCta.tsx'));

const pageSource = readFileSync(
  join(dir, '..', '..', 'app', 'page.tsx'),
  'utf-8',
);
const accountFetchSource = readFileSync(
  join(dir, '..', '..', 'lib', 'api', 'accountFetch.ts'),
  'utf-8',
);
const ribbonSource = readFileSync(
  join(dir, '..', 'presentation', 'PresentationRibbon.tsx'),
  'utf-8',
);
const tailwindConfig = readFileSync(
  join(dir, '..', '..', '..', 'tailwind.config.ts'),
  'utf-8',
);

/* ------------------------------------------------------------------------ */

describe('the section frame is bounded, and the homepage keeps its own scroll', () => {
  it('never sets html or body overflow — the CTO ruled that out explicitly', () => {
    for (const [name, code] of Object.entries({ workspace, analyse, watchPanel, dock, header })) {
      expect(`${name}:${code}`).not.toMatch(/document\.(body|documentElement)/);
      expect(`${name}:${code}`).not.toMatch(/overflow:\s*hidden['"]?\s*;?\s*\}\s*$/m);
    }
    expect(workspace).not.toMatch(/document\b/);
  });

  it('scopes overflow:hidden to its own element at a KNOWN height', () => {
    expect(workspace).toMatch(/className="mx-auto w-full max-w-\[1440px\] overflow-hidden/);
    expect(workspace).toMatch(/style=\{\{ height: `\$\{frameHeight\}px` \}\}/);
  });

  it('contains internal scrolling so the page behind it never takes the wheel', () => {
    expect(analyse).toMatch(/overflow-y-auto overflow-x-hidden overscroll-contain/);
    expect(workspace).not.toMatch(/window\.addEventListener\('scroll'/);
  });

  it('leaves the five accepted homepage sections in place', () => {
    for (const section of [
      /* H2 · Issue #29 — BetaHero replaces Hero at this mount point
         (H0 zone Z6-Z9). The ORDER contract this list protects is
         unchanged; only the section's identity moved. */
      '<BetaHero ',
      /* H3 · Issue #29 — the approved R4.1 composition. LiveStatusStrip and
         GlobalDevelopments are retired from Home (files kept on disk), and
         WhatsHappeningNow carries the editorial area plus the degraded-feed
         state the strip used to carry. The ORDER contract is unchanged. */
      '<WhatsHappeningNow',
      /* GATE A · R5.1 — IntelligenceModulesSection supersedes
         IntelligenceEngineSection at this mount point (HOME_R4.1_DELTA.md).
         The engine file is retired, not deleted. The ORDER contract this list
         exists to protect is unchanged; only the section's identity moved. */
      '<IntelligenceModulesSection',
      '<HowItWorks',
      '<TrustSection',
    ]) {
      expect(pageSource).toContain(section);
    }
  });

  it('mounts Today at the released position and adds no route', () => {
    expect(pageSource).toMatch(/<TodayWorkspace/);
    expect(pageSource).not.toMatch(/<TodaySection/);
    expect(pageSource).not.toMatch(/'use client'/);
  });
});

describe('the geometry is arithmetic on known chrome, at every combination', () => {
  it('subtracts exactly the header track and the dock track', () => {
    for (const frameHeight of [TODAY_FRAME_H, TODAY_FRAME_H_S]) {
      for (const headerCollapsed of [false, true]) {
        for (const dockExpanded of [false, true]) {
          const expected =
            frameHeight -
            (headerCollapsed ? 0 : HEADER_H_EXPANDED) -
            (dockExpanded ? DOCK_H_EXPANDED : DOCK_H_COMPACT);
          expect(
            resolveSectionColumnHeight({ frameHeight, headerCollapsed, dockExpanded }),
          ).toBe(Math.max(0, expected));
        }
      }
    }
  });

  it('never returns a negative height, however the tracks are configured', () => {
    for (let frameHeight = 0; frameHeight <= 900; frameHeight += 7) {
      for (const headerCollapsed of [false, true]) {
        for (const dockExpanded of [false, true]) {
          expect(
            resolveSectionColumnHeight({ frameHeight, headerCollapsed, dockExpanded }),
          ).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('hands the resolved height straight to the tier engine', () => {
    /* R4 CORRECTION — geography is its own full-height COLUMN now, so it
       resolves against the whole body rather than a rail it shares. */
    expect(workspace).toMatch(/resolveGeographyColumnLayout\(bodyHeight, geoColumnWidth\)/);
    /* The engine's inputs, and nothing measured. */
    expect(workspace).not.toMatch(/ResizeObserver|getBoundingClientRect|offsetHeight/);
  });

  it('the desktop frame clears tier E at every dock and header combination', () => {
    for (const headerCollapsed of [false, true]) {
      for (const dockExpanded of [false, true]) {
        const column = resolveSectionColumnHeight({
          frameHeight: TODAY_FRAME_H,
          headerCollapsed,
          dockExpanded,
        });
        const layout = resolveGeographyLayout(column);
        /* F15 — the canvas survives whatever the tracks do. */
        expect(layout.canvasHeight).toBeGreaterThanOrEqual(72);
      }
    }
  });
});

describe('the header counters state what WE retrieved, and nothing else', () => {
  it('draws NO COUNTRY even at zero, so absence is never read as completeness', () => {
    expect(header).toMatch(/counters\.unresolved/);
    expect(header).not.toMatch(/counters\.unresolved > 0/);
  });

  it('omits WATCHING for an anonymous visitor rather than showing 0', () => {
    expect(header).toMatch(/counters\.watching !== null &&/);
  });

  it('renders NEW SINCE LAST VISIT only where a real boundary supports it', () => {
    expect(header).toMatch(/counters\.newSinceLastVisit !== null &&/);
    /* The host supplies null when there is NO boundary, and a real count when
       there is. Never a zero standing in for "we do not know". */
    expect(workspace).toMatch(
      /newSinceLastVisit: previousSeenAt === null \? null : missedTotal/,
    );
  });

  it('keeps the bias note beside the counters, not in a tooltip', () => {
    expect(header).toMatch(/\{t\.biasNote\}/);
    expect(header).not.toMatch(/title=|aria-describedby|tooltip/i);
  });
});

describe('③④⑤ stay unavailable — nothing is synthesised to fill them', () => {
  it('binds only what a retrieved article actually carries', () => {
    expect(row).toMatch(/\{ kind: 'what', value: record\.title \}/);
    expect(row).toMatch(/\{ kind: 'why', value: null \}/);
    expect(row).toMatch(/\{ kind: 'who', value: null \}/);
    expect(row).toMatch(/\{ kind: 'evidence', value: null \}/);
  });

  it('never reads sourcesCount or confidence as an evidence claim', () => {
    for (const code of [row, analyse, workspace, dock]) {
      expect(code).not.toMatch(/record\.(sourcesCount|confidence)/);
    }
  });

  it('runs no analysis on mount and adds no second analysis client', () => {
    for (const code of [row, analyse, workspace, dock, watchPanel, header]) {
      expect(code).not.toMatch(/analysisFetch|\/analysis|POST/);
    }
    expect(analyse).not.toMatch(/useEffect/);
  });

  it('② is evidence-resolved at COUNTRY precision, or honestly unresolved', () => {
    expect(row).toMatch(/provenance: 'evidence-resolved'/);
    expect(row).toMatch(/provenance: 'unresolved'/);
    /* No n-of-m corroboration: one record cannot corroborate itself. */
    expect(row).not.toMatch(/corroborat|of \$\{|\bn of m\b/i);
  });
});

describe('the bounded pulse is bounded, and H’s Tailwind block is untouched', () => {
  it('runs exactly three iterations and stops without a timer', () => {
    expect(watchPanelSource).toMatch(/animation: gn-today-watch-pulse [\d.]+s ease-in-out 3;/);
    expect(watchPanel).not.toMatch(/setTimeout|setInterval|infinite/);
  });

  it('is removed outright under prefers-reduced-motion', () => {
    expect(watchPanelSource).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.gn-today-pulse-3 \{ animation: none !important; \}/,
    );
  });

  it('adds no gn-* utility to H’s block — that is why the rule is local', () => {
    expect(tailwindConfig).not.toMatch(/gn-pulse-3/);
    expect(watchPanel).not.toMatch(/animate-gn-/);
  });

  it('lives on the DOT only, and the state is never colour-alone', () => {
    /* Two mentions in the rule (the class and its reduced-motion override),
       and exactly ONE application, on the dot's own span. */
    const applications = watchPanel.match(/pulses \? 'gn-today-pulse-3' : ''/g) ?? [];
    expect(applications).toHaveLength(1);
    const at = watchPanel.indexOf("pulses ? 'gn-today-pulse-3'");
    /* The element carrying it is the 6px dot, and it is aria-hidden. */
    const dot = watchPanel.slice(at - 400, at + 200);
    expect(dot).toContain('h-[6px] w-[6px]');
    expect(dot).toContain('aria-hidden="true"');
    /* The tint is never the only carrier: a text tag rides beside it. */
    expect(watchPanel).toContain('{t.newTag}');
  });

  it('C6 — the host caps the pulse set at three, so the panel cannot exceed it', () => {
    expect(workspace).toMatch(/\.filter\(\(s\) => s\.missed > 0\)\s*\.slice\(0, 3\)/);
  });

  /*
    C10's mark-all-as-seen is deliberately RETIRED, not relocated. The boundary
    is now the server's `User.lastSeenAt`, advanced by the visit and throttled
    to once per 30 minutes: a button could not move it inside that window, and
    moving it outside would need a second endpoint. Its absence is asserted with
    the rest of the return-state contract below.
  */
});

describe('WATCH renders zero truthfully and never drops a followed country', () => {
  it('uses the R4-approved zero sentence, byte-identical in both locales', () => {
    for (const language of ['en', 'pl'] as const) {
      const d = getDictionary(language);
      expect(d.todayWorkspace.watch.zeroRetrieved).toBe(d.today.watchZeroRecords);
    }
  });

  it('maps ISO-3 to ISO-2 through the canonical resolver, never a slice', () => {
    expect(workspace).toMatch(/findCountryByIso3/);
    expect(workspace).not.toMatch(/slice\(0,\s*2\)/);
  });

  it('keeps a followed country with no records, at count 0', () => {
    expect(workspace).toMatch(/count: row\?\.count \?\? 0/);
    expect(workspace).not.toMatch(/\.filter\(\([^)]*\) => [^)]*count > 0\)/);
  });
});

/*
  AMENDED UNDER THE PRODUCT OWNER'S RULING ON THE OBSOLETE LOWER CONTROL.

  This block used to require TWO workspace CTAs that swapped on scroll: the
  header button while `!atEnd`, an inline card carrying "Ask a question and run
  a full analysis." at the foot of the list. The ruling removes the lower
  control and keeps the top filled amber action, so the assertions are inverted
  rather than deleted — the lower card must now be ABSENT, and the header action
  must no longer be gated on `atEnd`, or reaching the end of the list would
  leave no workspace command at all.

  The `inline` variant stays in WorkspaceCta, unimported, so the component's own
  two-position contract is unchanged and this file still checks it.
*/
describe('exactly one Workspace CTA is offered, and it is the header action', () => {
  it('has two positions and one label, from one component', () => {
    expect(cta).toMatch(/variant: 'chrome' \| 'inline'/);
    expect((cta.match(/\{t\.open\}/g) ?? []).length).toBe(2);
  });

  it('mounts the chrome action unconditionally except when empty', () => {
    expect(analyse).toMatch(/\{!empty &&[\s\S]*?variant="chrome"/);
    expect(analyse).not.toMatch(/\{!atEnd && !empty &&[\s\S]*?variant="chrome"/);
  });

  it('does NOT mount the obsolete lower inline control', () => {
    expect(analyse).not.toMatch(/variant="inline"/);
  });

  it('no longer renders the obsolete lower command copy anywhere on this surface', () => {
    expect(analyse).not.toMatch(/Ask a question and run a full analysis/);
  });

  it('relocates from the panel’s own scroll metrics, not a window listener', () => {
    expect(analyse).toMatch(/el\.scrollHeight - el\.scrollTop - el\.clientHeight <= 8/);
    expect(analyse).not.toMatch(/window\.|document\./);
  });

  it('navigates rather than pre-running an analysis', () => {
    expect(workspace).toMatch(/router\.push\('\/search'\)/);
    expect(row).toMatch(/router\.push\(`\/search\?\$\{analysisParams\.toString\(\)\}`\)/);
  });
});

describe('the header collapse cannot oscillate', () => {
  it('uses two thresholds, and the restore point is below the collapse point', () => {
    expect(workspace).toMatch(/current \? scrollTop > 8 : scrollTop > HEADER_COLLAPSE_SCROLL/);
    expect(HEADER_COLLAPSE_SCROLL).toBeGreaterThan(8);
  });
});

describe('the dock says what it holds, and never implies corroboration', () => {
  it('is labelled RETRIEVED ARTICLES in both locales, never SOURCES alone', () => {
    expect(getDictionary('en').todayWorkspace.dock.label).toBe('RETRIEVED ARTICLES');
    expect(getDictionary('pl').todayWorkspace.dock.label).toBe('POBRANE ARTYKUŁY');
  });

  it('states the retrieval caveat in words rather than leaving a bare count', () => {
    expect(dock).toMatch(/record !== null \? t\.retrievalNote : t\.noneSelected/);
    expect(getDictionary('en').todayWorkspace.dock.retrievalNote).toMatch(/not corroboration/i);
  });

  it('takes the height the geometry resolved — it computes none of its own', () => {
    expect(dock).toMatch(/dockHeight: number;/);
    expect(dock).not.toMatch(/DOCK_H_EXPANDED|DOCK_RELOCATION_FLOOR/);
  });

  it('offers the original article, safely', () => {
    expect(dock).toMatch(/rel="noopener noreferrer"/);
    expect(dock).toMatch(/href=\{record\.url\}/);
  });
});

describe('05 §5 — the dock ceiling, and 05 §5.1 relocation', () => {
  it('never leaves ANALYSE below its floor, at any frame or track combination', () => {
    for (let frameHeight = 320; frameHeight <= 1100; frameHeight += 3) {
      for (const headerCollapsed of [false, true]) {
        for (const dockExpanded of [false, true]) {
          for (const smallViewport of [false, true]) {
            const r = resolveDock({ frameHeight, headerCollapsed, dockExpanded, smallViewport });
            expect(r.bodyHeight).toBeGreaterThanOrEqual(ANALYSE_FLOOR);
            expect(r.dockHeight).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('caps the open dock at frame − header − ANALYSE_FLOOR, and no higher', () => {
    for (const frameHeight of [TODAY_FRAME_H, TODAY_FRAME_H_S, 494]) {
      for (const headerCollapsed of [false, true]) {
        const headerH = headerCollapsed ? 0 : HEADER_H_EXPANDED;
        const r = resolveDock({
          frameHeight,
          headerCollapsed,
          dockExpanded: true,
          smallViewport: false,
        });
        expect(r.dockHeight).toBeLessThanOrEqual(
          Math.max(DOCK_RELOCATION_FLOOR, frameHeight - headerH - ANALYSE_FLOOR),
        );
      }
    }
  });

  /*
    §5.1's worked example was computed for the STACKED rail, whose body minimum
    was 274. Under the corrected composition WATCH and GEOGRAPHY are side by
    side and the body minimum is the tallest single floor, 170 — so the same
    494px frame is now SERVED IN PLACE rather than relocated, and the number in
    the specification moves with the composition it described.

    The relocation itself is unchanged; only where it starts. It starts where a
    dock capped for the real minimum would be too short for one source card.
  */
  it('a 494px frame is served in place under the corrected body minimum', () => {
    const r = resolveDock({
      frameHeight: 494,
      headerCollapsed: false,
      dockExpanded: true,
      smallViewport: false,
    });
    expect(COLUMN_MIN_IN_PLACE).toBe(170);
    expect(r.relocated).toBe(false);
    expect(r.dockHeight).toBe(494 - HEADER_H_EXPANDED - COLUMN_MIN_IN_PLACE);
    expect(r.bodyHeight).toBe(COLUMN_MIN_IN_PLACE);
  });

  it('still relocates on height where the cap leaves no usable dock', () => {
    /* ceiling = frame − header − 170; under 180 is where it triggers. */
    const r = resolveDock({
      frameHeight: 440,
      headerCollapsed: false,
      dockExpanded: true,
      smallViewport: false,
    });
    expect(r.relocated).toBe(true);
    expect(r.dockHeight).toBeGreaterThanOrEqual(DOCK_RELOCATION_FLOOR);
    expect(r.bodyHeight).toBeGreaterThanOrEqual(ANALYSE_FLOOR);
  });

  it('relocates on either trigger, into one layout', () => {
    expect(
      resolveDock({
        frameHeight: TODAY_FRAME_H,
        headerCollapsed: false,
        dockExpanded: false,
        smallViewport: true,
      }).relocated,
    ).toBe(true);
    expect(
      resolveDock({
        frameHeight: TODAY_FRAME_H,
        headerCollapsed: false,
        dockExpanded: true,
        smallViewport: false,
      }).relocated,
    ).toBe(false);
  });

  it('B19 — both vacated tracks are REMOVED from the template', () => {
    expect(workspace).toMatch(
      /gridTemplateColumns: dock\.relocated\s*\? 'minmax\(0, 1fr\)'\s*: `\$\{WATCH_COL_W\}px minmax\(0, 1fr\) \$\{geoColumnWidth\}px`/,
    );
    expect(workspace).toMatch(/\{!dock\.relocated && watchPanelAt\(bodyHeight\)\}/);
    expect(workspace).toMatch(/\{!dock\.relocated && geographyPanel\(layout\)\}/);
  });

  it('B20 — exactly one OPEN WORLD MAP owner in every configuration', () => {
    /* Relocated: the dock chrome owns it and geography is pinned to
       `permanent-chrome`, which is the position that renders none. */
    expect(workspace).toMatch(/geographyPanel\(relocatedLayout\)/);
    expect(resolveRelocatedGeographyLayout(300).ctaPosition).toBe('permanent-chrome');
    expect(dock).toMatch(/onClick=\{worldMap\}/);
    /* In place: the tier decides, and at tier E it decides `permanent-chrome`,
       which the region renders as NOTHING — so the dock must take it there too,
       or the count is zero instead of one. The browser pass measures the count
       in every configuration; this is the source-side half. */
    expect(workspace).toMatch(
      /worldMap=\{\s*dock\.relocated \|\| layout\.ctaPosition === 'permanent-chrome' \? openWorldMap : null\s*\}/,
    );
    expect(workspace).toMatch(/geographyPanel\(layout\)/);
  });

  it('gives the relocated region the FULL tab body, not a share of a column', () => {
    expect(resolveRelocatedGeographyLayout(300).watchHeight).toBe(0);
    expect(resolveGeographyColumnLayout(300, GEO_COL_W).watchHeight).toBe(0);
    expect(workspace).toMatch(
      /watchPanel: watchPanelAt\(Math\.max\(0, dock\.dockHeight - DOCK_H_COMPACT\)\)/,
    );
  });

  it('reads a VIEWPORT query, not an element measurement', () => {
    expect(workspace).toMatch(
      new RegExp(`matchMedia\\(\`\\(max-width: \\$\\{S_BREAKPOINT - 1\\}px\\)\`\\)`),
    );
    expect(S_BREAKPOINT).toBe(1024);
  });

  it('removes its own listener', () => {
    expect(workspace).toMatch(/removeEventListener\('change', apply\)/);
  });

  it('uses a real tab pattern, with counts', () => {
    expect(dock).toMatch(/role="tablist"/);
    expect(dock).toMatch(/role="tab"/);
    expect(dock).toMatch(/aria-selected=\{relocation\.tab === name\}/);
    expect(dock).toMatch(/aria-controls=\{BODY_ID\}/);
  });
});

describe('B6 — every primary scroll region declares its 120px floor', () => {
  it('declares it on the element that scrolls, in all three regions', () => {
    for (const code of [analyse, watchPanel, dock]) {
      const at = code.indexOf("minHeight: '120px'");
      expect(at).toBeGreaterThan(-1);
      /* The declaration and the overflow live on the SAME element. The window
         is wide enough to clear ANALYSE's conditional top-fade, which sits
         between the two in the style object. */
      expect(code.slice(at - 300, at + 600)).toMatch(/overflow-y-auto/);
    }
  });

  it('B15 — no bounded region is auto on BOTH axes', () => {
    for (const code of [analyse, watchPanel, dock, workspace]) {
      expect(code).not.toMatch(/overflow-auto|overflow-y-auto overflow-x-auto/);
    }
  });
});

describe('I6/I3 — disclosure and hit areas', () => {
  it('every disclosure control names the region it controls', () => {
    expect(row).toMatch(/aria-expanded=\{expanded\}\s*aria-controls=\{`today-ribbon-\$\{record\.id\}`\}/);
    expect(dock).toMatch(/aria-expanded=\{expanded\}\s*aria-controls=\{BODY_ID\}/);
  });

  it('every interactive element carries a 44px minimum and a 2px focus ring', () => {
    for (const code of [row, analyse, watchPanel, dock, cta, workspace]) {
      const buttons = code.match(/<(?:button|a)\b[\s\S]*?>/g) ?? [];
      for (const button of buttons) {
        if (!button.includes('className')) continue;
        expect(button).toMatch(/min-h-\[44px\]/);
        expect(button).toMatch(/focus-visible:outline-2/);
      }
    }
  });
});

describe('EN and PL are complete and structurally identical', () => {
  it('every todayWorkspace key exists in both dictionaries', () => {
    const en = getDictionary('en').todayWorkspace as unknown as Record<string, Record<string, unknown>>;
    const pl = getDictionary('pl').todayWorkspace as unknown as Record<string, Record<string, unknown>>;
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    for (const region of Object.keys(en)) {
      expect(Object.keys(pl[region]).sort()).toEqual(Object.keys(en[region]).sort());
    }
  });

  it('no PL value is left as its English original', () => {
    const en = getDictionary('en').todayWorkspace as unknown as Record<string, Record<string, string>>;
    const pl = getDictionary('pl').todayWorkspace as unknown as Record<string, Record<string, string>>;
    /* GEOGRAPHY/ANALIZA aside, the acronyms below are the same word in both. */
    const shared = new Set(['countryPrecision']);
    for (const region of Object.keys(en)) {
      for (const key of Object.keys(en[region])) {
        if (shared.has(key)) continue;
        if (typeof en[region][key] !== 'string') continue;
        expect(`${region}.${key}: ${pl[region][key]}`).not.toBe(
          `${region}.${key}: ${en[region][key]}`,
        );
      }
    }
  });
});

/* ------------------------------------------------------------------------ */

describe('R4 CORRECTION — the desktop composition is WATCH | ANALYSE | GEOGRAPHY', () => {
  it('renders the three regions in that order in the DOM, not just on screen', () => {
    const grid = workspace.slice(
      workspace.indexOf('gridTemplateColumns'),
      workspace.indexOf('<SourcesDock'),
    );
    const w = grid.indexOf('watchPanelAt');
    const a = grid.indexOf('{analyse}');
    const g = grid.indexOf('geographyPanel');
    expect(w).toBeGreaterThan(-1);
    expect(a).toBeGreaterThan(w);
    expect(g).toBeGreaterThan(a);
  });

  it('gives WATCH a compact fixed track and GEOGRAPHY the width its map needs', () => {
    expect(WATCH_COL_W).toBe(240);
    /* R4 SIZE CHILD — 420 wide, reverting to 324 below 1280 so ANALYSE stays
       readable. Width is the only honest lever on an undistorted map's size. */
    expect(GEO_COL_W).toBe(420);
    expect(GEO_COL_W_M).toBe(324);
    expect(workspace).toMatch(/const geoColumnWidth = isMedium \? GEO_COL_W_M : GEO_COL_W/);
    /* A proportional WATCH would grow into space it has nothing to put. */
    expect(workspace).not.toMatch(/WATCH_COL_W \* |fr` \+ WATCH/);
  });

  it('serves every column at the FULL body height — none splits a rail', () => {
    expect(workspace).toMatch(/watchPanelAt\(bodyHeight\)/);
    expect(analyse).toMatch(/height: `\$\{height\}px`/);
    for (let body = 170; body <= 900; body += 1) {
      for (const width of [GEO_COL_W, GEO_COL_W_M]) {
        const l = resolveGeographyColumnLayout(body, width);
        expect(l.watchHeight).toBe(0);
        expect(l.regionHeight).toBe(body);
        expect(l.columnScrolls).toBe(false);
        expect(l.canvasHeight).toBeGreaterThanOrEqual(72);
        /* R4 SIZE CHILD — the parts sum to the region EXACTLY, at every
           height and both widths. Never over, so nothing is ever clipped. */
        expect(27 + l.canvasHeight + l.rowsHeight + (l.ctaPosition === 'region-footer' ? 51 : 0))
          .toBe(body);
      }
    }
  });

  it('the canvas is materially larger than it was as half a shared rail', () => {
    /* The released two-column body at a 720 frame, dock closed, was 540: the
       rail gave geography 356 and the canvas resolved to 206. The same body as
       a full column resolves the canvas to 330 and keeps the rows at 132. */
    const rail = resolveGeographyLayout(540);
    const column = resolveGeographyColumnLayout(540, GEO_COL_W);
    expect(rail.canvasHeight).toBe(206);
    expect(rail.rowsHeight).toBe(72);
    /*
      R4 GEOGRAPHY SIZE CHILD — the canvas number went DOWN and the map went
      UP, which is the point. 330 was a box containing a 324×135 map with 98px
      of void above and below it; 175 IS the map, at 420 wide. Area 43,740 →
      73,500 px², and the 155px reclaimed goes to the country list.
    */
    /* R4 ZOOM REVISION — the clipped Mercator frame is 1.937, so the same
       420px column now yields a 217px map instead of the equirectangular 175. */
    expect(column.canvasHeight).toBe(217);
    expect(column.rowsHeight).toBe(245);
    expect(GEO_COL_W * column.canvasHeight).toBeGreaterThan(324 * 135 * 2);
  });

  it('every region still clears its own floor at both production frames', () => {
    for (const frameHeight of [TODAY_FRAME_H, TODAY_FRAME_H_S]) {
      for (const headerCollapsed of [false, true]) {
        for (const dockExpanded of [false, true]) {
          const r = resolveDock({ frameHeight, headerCollapsed, dockExpanded, smallViewport: false });
          expect(r.bodyHeight).toBeGreaterThanOrEqual(ANALYSE_FLOOR);
          expect(r.bodyHeight).toBeGreaterThanOrEqual(154);
          expect(r.bodyHeight).toBeGreaterThanOrEqual(170);
        }
      }
    }
  });

  it('ANALYSE still owns the internal vertical scrolling', () => {
    expect(analyse).toMatch(/overflow-y-auto overflow-x-hidden overscroll-contain/);
    /* WATCH and the dock scroll their own bodies; neither scrolls the frame. */
    expect(workspace).not.toMatch(/overflowY: layout\.columnScrolls/);
  });

  it('the page stays bounded — nothing reaches for the document', () => {
    expect(workspace).not.toMatch(/document\b/);
    expect(workspace).toMatch(/style=\{\{ height: `\$\{frameHeight\}px` \}\}/);
  });
});

describe('R1/T2 — the return boundary comes from the AUTHENTICATED contract', () => {
  const returnSource = read('useReturnState.ts');
  /* Prohibitions are asserted against CODE. A file's own comment naming the
     thing it must not be is documentation, not a violation. */
  const ret = codeOnly(returnSource);

  it('the device-local mechanism is GONE from the tree, not merely unused', () => {
    expect(existsSync(join(dir, 'useLastVisit.ts'))).toBe(false);
  });

  it('no Today file touches browser storage of any kind', () => {
    for (const code of [workspace, watchPanel, analyse, row, dock, header, cta, ret]) {
      expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    }
  });

  it('uses the existing route, the existing client and no new mechanism', () => {
    expect(ret).toMatch(/const SEEN_PATH = '\/users\/me\/seen'/);
    expect(ret).toMatch(/accountFetch\(SEEN_PATH, \{ method: 'POST' \}\)/);
    /* accountFetch IS the CSRF half: it echoes gna_csrf as X-CSRF-Token on
       every POST, so no second CSRF path is introduced here. */
    expect(accountFetchSource).toMatch(/X-CSRF-Token/);
    expect(accountFetchSource).toMatch(/MUTATING_METHODS\.has\(method\)/);
    /* No new route, no new API, no duplicate pipeline. */
    expect(ret).not.toMatch(/fetch\(|XMLHttpRequest|new URL\(/);
    expect((ret.match(/accountFetch\(/g) ?? []).length).toBe(1);
  });

  it('reads the contract exactly once, on mount, with no polling or retry', () => {
    expect(ret).toMatch(/useEffect\(/);
    expect(ret).not.toMatch(/setInterval|setTimeout|retry|WebSocket|EventSource/);
  });

  it('treats firstVisit as NO INTERVAL, never as an interval containing nothing', () => {
    expect(ret).toMatch(/data\.firstVisit \? null : data\.previousSeenAt/);
  });

  it('treats a refusal as absence rather than as an error state', () => {
    expect(ret).toMatch(/if \(!response\.ok\)/);
    expect((ret.match(/setPreviousSeenAt\(null\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('is only called where an account is already proven', () => {
    expect(workspace).toMatch(/useReturnState\(watch\.follows !== null\)/);
  });

  it('counts first OBSERVATION, not publication, and skips records with neither', () => {
    expect(ret).toMatch(/r\.firstSeenAt === undefined\) return false/);
    expect(ret).not.toMatch(/publishedAt/);
  });

  it('no locale string claims a device-local boundary any more', () => {
    for (const language of ['en', 'pl'] as const) {
      const w = getDictionary(language).todayWorkspace.watch;
      for (const value of Object.values(w)) {
        expect(String(value).toLowerCase()).not.toMatch(/this device|tym urządzeniu/);
      }
    }
  });
});

describe('R1/T2 — where there is no boundary, the missed-since claim STOPS', () => {
  it('a boundary requires being signed in AND having an interval', () => {
    expect(watchPanel).toMatch(
      /const hasBoundary = !isAnonymous && previousSeenAt !== null;/,
    );
  });

  it('falls back to naming what IS shown, in both locales', () => {
    expect(watchPanel).toMatch(/: t\.followedHeading}/);
    expect(getDictionary('en').todayWorkspace.watch.followedHeading).toBe(
      'Today’s intelligence from the countries you follow',
    );
    expect(getDictionary('pl').todayWorkspace.watch.followedHeading.length).toBeGreaterThan(10);
    /* The fallback must not smuggle the claim back in as softer wording. */
    for (const language of ['en', 'pl'] as const) {
      const f = getDictionary(language).todayWorkspace.watch.followedHeading.toLowerCase();
      expect(f).not.toMatch(/since|missed|last visit|ostatniej|ominęło/);
    }
  });

  it('MARK ALL AS SEEN is gone — the boundary is server-owned and throttled', () => {
    expect(watchPanel).not.toMatch(/onMarkAllSeen|markAllSeen/);
    expect(workspace).not.toMatch(/onMarkAllSeen|markSeen/);
  });
});

describe('R1/T2 — the signed-out column claims nothing', () => {
  it('is a compact explanation plus the released sign-in action, and no more', () => {
    const block = watchPanel.slice(watchPanel.indexOf('isAnonymous ? ('));
    const anonymous = block.slice(0, block.indexOf('subjects.length === 0'));
    expect((anonymous.match(/<p /g) ?? []).length).toBe(1);
    /*
      M-ALPHA-AUTH — the CONTRACT this line pins changed; the line was updated,
      not removed. It used to require `${resolveApiBaseUrl()}/auth/google`, a
      navigation to the BACKEND's own origin — which is exactly the cross-origin
      shape that made the session cookie cross-site and unusable. CTO
      requirement 8 replaces it across all five sign-in entry points with the
      shared first-party helper. What this test protects is unchanged: the
      signed-out column still offers exactly one real sign-in action and claims
      nothing else.
    */
    expect(anonymous).toMatch(/accountSignInUrl\(/);
    expect(anonymous).not.toMatch(/resolveApiBaseUrl\(\)\}\/auth\/google/);
    /* No count and no interval claim inside the signed-out branch. */
    expect(anonymous).not.toMatch(/missedTotal|missed|Since|hasBoundary/);
  });

  it('the basis line itself is gated on being signed in', () => {
    expect(watchPanel).toMatch(/\{!isAnonymous && !isLoading && \(/);
  });

  it('stays short in both locales', () => {
    for (const language of ['en', 'pl'] as const) {
      expect(
        getDictionary(language).todayWorkspace.watch.anonymousCompact.split(/\s+/).length,
      ).toBeLessThanOrEqual(11);
    }
  });
});

describe('R4 — every compact row exposes an EXPLICIT analysis action', () => {
  it('renders a WORD, not only a chevron', () => {
    expect(row).toMatch(/\{t\.analyse}/);
    expect(getDictionary('en').todayWorkspace.analyse.analyse).toBe('ANALYSE');
    expect(getDictionary('pl').todayWorkspace.analyse.analyse).toBe('ANALIZUJ');
  });

  it('is visibly distinct from row expansion — four ways, not by position', () => {
    const actions = row.slice(row.indexOf('<div className="flex items-start gap-'));
    const analyseBtn = actions.slice(0, actions.indexOf('aria-expanded'));
    const chevronBtn = actions.slice(actions.indexOf('aria-expanded'));
    /* ANALYSE: a word, action amber, bordered, arrowed. */
    expect(analyseBtn).toContain('{t.analyse}');
    expect(analyseBtn).toContain('ACTION_AMBER');
    expect(analyseBtn).toContain('border');
    /* Chevron: a glyph, neutral, unbordered, and a disclosure control. */
    expect(chevronBtn).toContain('aria-expanded={expanded}');
    expect(chevronBtn).toContain('text-[#94a3b8]');
    expect(chevronBtn).not.toContain('ACTION_AMBER');
    /* And each names itself for a screen reader, differently. */
    expect(analyseBtn).toMatch(/aria-label=\{`\$\{t\.analyseStory}/);
    expect(chevronBtn).toMatch(/t\.collapseRow : t\.expandRow/);
  });

  it('amber-means-action agrees with the ribbon, to the hex', () => {
    expect(row).toMatch(/const ACTION_AMBER = '#f59e0b'/);
    expect(ribbonSource).toMatch(/const ACTION_AMBER = '#f59e0b'/);
    /* Uncertainty amber stays a TINT and is untouched by this row. */
    expect(ribbonSource).toMatch(/const UNCERTAIN_AMBER = '#f59e0b'/);
    expect(row).not.toMatch(/UNCERTAIN_AMBER|rgba\(245,158,11,\.0/);
  });

  it('uses the released route and request shape — one pipeline, not two', () => {
    expect(row).toMatch(
      /new URLSearchParams\(\{ q: record\.title, articleId: record\.id \}\)/,
    );
    expect(row).toMatch(/analysisParams\.set\('countryCode', record\.countryCode\)/);
    expect(row).toMatch(/router\.push\(`\/search\?\$\{analysisParams\.toString\(\)}`\)/);
    /* ONE navigation function, shared by the row action and the ribbon's
       DEEP ANALYSIS — so the two can never drift into two contracts. */
    expect((row.match(/router\.push\(/g) ?? []).length).toBe(1);
    expect(row).toMatch(/deepAnalysis=\{\{ onOpen: openAnalysis \}\}/);
    expect(row).not.toMatch(/fetch\(|accountFetch|\/api\//);
  });

  it('keeps the row-expansion interaction and everything it opens', () => {
    expect(row).toMatch(/aria-controls=\{`today-ribbon-\$\{record\.id}`\}/);
    expect(row).toMatch(/<PresentationRibbon/);
    expect(row).toMatch(/sources=\{\{ count: 1, expanded: sourcesExpanded/);
  });

  it('both controls meet the 44px target', () => {
    const actions = row.slice(row.indexOf('<div className="flex items-start gap-'));
    expect((actions.match(/min-h-\[44px\]/g) ?? []).length).toBe(2);
  });
});

/* ------------------------------------------------------------------------ */

describe('R4 CORRECTION 2 — OPEN ANALYSIS WORKSPACE is a filled primary action', () => {
  it('is solid action amber on dark ink at 700, in BOTH positions', () => {
    expect(cta).toMatch(/const ACTION_AMBER = '#f59e0b'/);
    expect(cta).toMatch(/const ACTION_INK = '#05080d'/);
    const fills = cta.match(
      /style=\{\{ backgroundColor: ACTION_AMBER, color: ACTION_INK, fontWeight: 700 \}\}/g,
    );
    expect(fills).toHaveLength(2);
    /* The thin outlined treatment is gone from both. */
    expect(cta).not.toMatch(/border-\[rgba\(125,192,255/);
  });

  it('agrees with the row action and the ribbon on the same hex', () => {
    expect(row).toMatch(/const ACTION_AMBER = '#f59e0b'/);
    expect(ribbonSource).toMatch(/const ACTION_AMBER = '#f59e0b'/);
  });

  it('meets the 44px minimum in both positions', () => {
    expect((cta.match(/min-h-\[44px\]/g) ?? [])).toHaveLength(2);
  });

  it('keeps a visible focus ring that does not sit amber on amber', () => {
    expect((cta.match(/focus-visible:outline-2/g) ?? [])).toHaveLength(2);
    expect((cta.match(/focus-visible:outline-\[#7dc0ff\]/g) ?? [])).toHaveLength(2);
    /* Colour is not the only affordance: hover changes opacity too. */
    expect((cta.match(/hover:opacity-90/g) ?? [])).toHaveLength(2);
  });

  it('lives in the ANALYSE HEADER, outside the scroll region', () => {
    const header = analyse.slice(analyse.indexOf('<header'), analyse.indexOf('</header>'));
    expect(header).toMatch(/<WorkspaceCta variant="chrome"/);
    /* The scrolling body is a SIBLING of the header, so the control can
       neither overlap the scrollbar nor cover the first record. */
    const body = analyse.slice(analyse.indexOf('</header>'));
    expect(body).toMatch(/overflow-y-auto overflow-x-hidden overscroll-contain/);
    expect(body).not.toMatch(/<WorkspaceCta variant="chrome"/);
  });

  it('keeps its released destination and adds no contract', () => {
    expect(workspace).toMatch(/onOpenWorkspace=\{\(\) => router\.push\('\/search'\)\}/);
    expect(cta).not.toMatch(/fetch\(|accountFetch|URLSearchParams/);
  });

  it('reads the same in Polish, and is not English left untranslated', () => {
    const en = getDictionary('en').todayWorkspace.cta;
    const pl = getDictionary('pl').todayWorkspace.cta;
    expect(pl.open).not.toBe(en.open);
    expect(pl.open.length).toBeGreaterThan(0);
    /* One component, one treatment: the styling is not per-locale. */
    expect(cta).not.toMatch(/language === 'pl'/);
  });
});

describe('R4 CORRECTION 2 — the scroll boundary is legible, not sliced', () => {
  it('the ANALYSE header is opaque and stays IN FLOW above the body', () => {
    const header = analyse.slice(analyse.indexOf('<header'), analyse.indexOf('</header>'));
    expect(header).toMatch(/bg-\[#05080d\]/);
    expect(header).toMatch(/border-b border-\[#101923\]/);
    expect(header).toMatch(/relative z-10/);
    /* In flow: never absolute, fixed or sticky — those could put it OVER a
       record instead of above one. */
    expect(header).not.toMatch(/absolute|fixed|sticky/);
  });

  it('fades the top edge only once the list has actually moved', () => {
    expect(analyse).toMatch(/setScrolled\(el\.scrollTop > 4\)/);
    expect(analyse).toMatch(/\.\.\.\(scrolled/);
    expect(analyse).toMatch(/maskImage:/);
    expect(analyse).toMatch(/WebkitMaskImage:/);
  });

  it('gives the header the height a 44px control needs', () => {
    expect(ANALYSE_CHROME).toBe(48);
    expect(analyse).toMatch(/height: `\$\{ANALYSE_CHROME\}px`/);
  });
});

describe('R4 GEOGRAPHY SIZE CHILD — the panel is composed around the picture', () => {
  it('the canvas box IS the map at both widths, so no void band can exist', () => {
    for (const width of [GEO_COL_W, GEO_COL_W_M]) {
      for (let region = 260; region <= 700; region += 1) {
        const l = resolveGeographyColumnLayout(region, width);
        const natural = Math.round(width / MAP_ASPECT);
        /* Either the map's own height, or as much of it as the region allows —
           never MORE, which is what produced the 98px bands at 922fcef. */
        expect(l.canvasHeight).toBeLessThanOrEqual(natural);
      }
    }
  });

  it('the box and the picture stay the same rectangle, and the parts still fit', () => {
    const after = resolveGeographyColumnLayout(540, GEO_COL_W);
    expect(after.canvasHeight).toBe(Math.round(GEO_COL_W / MAP_ASPECT));
    expect(27 + after.canvasHeight + after.rowsHeight + 51).toBe(540);
  });

  it('the map is substantially larger than 922fcef, and undistorted', () => {
    /* 922fcef: 324 wide, equirectangular, 324×135 = 43,740px². */
    const now = GEO_COL_W * Math.round(GEO_COL_W / MAP_ASPECT);
    expect(now / (324 * 135)).toBeGreaterThan(2);
    /* Undistorted: height is a pure function of width and the frame aspect. */
    expect(Math.round(GEO_COL_W / MAP_ASPECT)).toBe(217);
    expect(Math.round(GEO_COL_W_M / MAP_ASPECT)).toBe(167);
  });

  it('the relocated dock tabs actually open the dock', () => {
    /* Regression guard for the 768 defect this child fixes: the relocated
       chrome has no expand control, so a tab must open the body itself. */
    expect(workspace).toMatch(/onSelectTab: \(next\) => \{\s*setDockTab\(next\);\s*setSourcesExpanded\(true\);/);
    expect(dock).toMatch(/aria-expanded=\{expanded\}/);
  });
});
