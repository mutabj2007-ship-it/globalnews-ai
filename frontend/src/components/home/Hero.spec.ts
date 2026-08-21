import { readFileSync } from 'fs';
import { join } from 'path';

import tailwindConfig from '../../../tailwind.config';

/**
 * `theme` on a Tailwind `Config` is optional and loosely typed, so released
 * values are read through the same narrowed view M66.2's headerSourcePort.spec
 * established rather than by indexing an optional chain.
 */
type ThemeExtend = Record<string, Record<string, unknown>>;
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;

const source = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
const feedPanelSource = readFileSync(join(__dirname, 'HeroLiveFeedPanel.tsx'), 'utf-8');

/**
 * M66.2 established this helper after three negative guards matched the very
 * documentation that explained why the thing being forbidden was absent. Every
 * `not.toMatch` below runs against comment-stripped source.
 */
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Hero three-zone recomposition (M60 Phase 2 — search/ask left, dominant world visual center, live intelligence right, per CTO-approved reference geometry)', () => {
  it('uses the approved Claude Design fixed-left/flexible-centre/fixed-right grid at the lg breakpoint (minmax(0,470px) minmax(0,1fr) 312px), superseding the earlier proportional-fraction columns', () => {
    // M65 — the earlier 0.31/0.50/0.19 fractions were this codebase's
    // own approximation of the reference proportions. The recovered
    // approved design specifies exact column widths, so the assertion is
    // updated to the real design value rather than dropped.
    // M66.3 — the tracks are unchanged; CTO decision L-1A moved the gate from
    // `lg` (1024px, where the map track computed to 138px) to `cd-hero` (1240px).
    expect(source).toMatch(/cd-hero:grid-cols-\[minmax\(0,470px\)_minmax\(0,1fr\)_312px\]/);
    // The composition-level min-height floor the design specifies, now a token.
    expect(source).toMatch(/cd-hero:min-h-cd-hero-frame/);
    expect((themeExtend.minHeight as unknown as Record<string, string>)['cd-hero-frame']).toBe('428px');
  });

  it('the live-intelligence panel is its own grid column, never absolutely positioned on top of the map', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/absolute bottom-4 right-4 top-4/);
  });

  it('uses HeroIntelligenceField (real country geometry, Natural Earth 1 projection) as the Hero decorative visual — M65 retired HeroWorldVisual from this render site; that assertion is explicitly superseded, not silently dropped', () => {
    expect(source).toMatch(/<HeroIntelligenceField/);
    expect(source).toMatch(/import \{ HeroIntelligenceField \} from '@\/components\/home\/HeroIntelligenceField'/);
    // The retired files are retained in the repository, simply no longer
    // rendered here — they must not be re-imported by accident.
    expect(source).not.toMatch(/import \{ HeroWorldVisual \}/);
  });

  it('the real Ask GlobalNews AI form submission is unchanged — same handler, same /search destination', () => {
    expect(source).toMatch(/onSubmit=\{handleSubmit\}/);
    expect(source).toMatch(/router\.push\(`\/search\?q=/);
  });

  it('does not introduce a second/fake AI input — exactly one <form role="search">', () => {
    const formCount = (source.match(/role="search"/g) ?? []).length;
    expect(formCount).toBe(1);
  });

  it('secondary CTA links to the real /map page', () => {
    expect(source).toMatch(/href="\/map"/);
  });

  it('credibility row uses only dictionary-driven, truthful generic labels', () => {
    expect(source).toMatch(/t\.credibilityLiveSources/);
    expect(source).toMatch(/t\.credibilityAiAnalysis/);
    expect(source).toMatch(/t\.credibilityEvidence/);
  });

  it('does not display an unsupported numeric claim near the credibility row', () => {
    expect(source).not.toMatch(/\d+\s*(reports|sources|alerts)/i);
  });

  it('accepts real HomeFeed articles for the compact live-feed panel — no new fetch introduced', () => {
    expect(source).toMatch(/latestArticles\?:\s*NewsArticle\[\]/);
    expect(source).not.toMatch(/fetch\(/);
  });

  it('the live-feed panel receives the SAME already-fetched array and nothing else — M66.3 moved the panel into HeroLiveFeedPanel.tsx, so the bounded-count contract now lives in that file\u2019s own spec and is asserted here only as a delegation', () => {
    expect(source).toMatch(/<HeroLiveFeedPanel/);
    expect(source).toMatch(/articles=\{latestArticles\}/);
    // Hero must not slice, filter, re-order or otherwise re-derive the feed.
    expect(codeOnly(source)).not.toMatch(/latestArticles\./);
    // And the bound itself must still exist, in the file that now renders it.
    expect(feedPanelSource).toMatch(/const FEED_PANEL_COUNT = 8/);
    expect(feedPanelSource).toMatch(/articles\.slice\(0, FEED_PANEL_COUNT\)/);
  });

  it('the live-feed panel is rendered unconditionally by Hero — never behind a && short-circuit that would delete the surface when the feed is empty', () => {
    // M66.3 — the panel moved to HeroLiveFeedPanel.tsx, so the guard moves with
    // it: what Hero must not do is decide whether the panel exists at all.
    expect(codeOnly(source)).not.toMatch(/&&\s*\(?\s*<HeroLiveFeedPanel/);
    expect(codeOnly(source)).not.toMatch(/\?\s*<HeroLiveFeedPanel/);
    // The honest-state branch itself, still a ternary, in its new home.
    expect(feedPanelSource).toMatch(/hasArticles \? \(/);
    expect(feedPanelSource).toMatch(/\{t\.feedPanelUnavailableHeading\}/);
    expect(feedPanelSource).toMatch(/\{t\.feedPanelUnavailableBody\}/);
  });

  it('the fallback state never fabricates a headline or timestamp', () => {
    const fallbackBlock = feedPanelSource.slice(
      feedPanelSource.indexOf('feedPanelUnavailableHeading'),
      feedPanelSource.indexOf('feedPanelViewMap'),
    );
    expect(fallbackBlock).not.toMatch(/formatRelativeTime/);
  });

  it('the Hero surface declares NO width cap, padding or gap of its own — M66.3 (CTO decision L-9) removed the three Hero-local constraints that were subtracting 104px from the released 606px map track', () => {
    const code = codeOnly(source);
    // `max-w-[1600px]` could never bind inside PageCanvas's 1500px boundary; it
    // was dead code that hid the real constraints below it.
    expect(code).not.toMatch(/max-w-\[1600px\]/);
    expect(code).not.toMatch(/lg:px-8/);
    expect(code).not.toMatch(/lg:gap-5/);
    expect(code).not.toMatch(/border-b border-border/);
    // The released tracks are therefore composed against the full page content
    // box, which PageCanvas already sizes to GN-CD's own 1388px at 1440.
    expect(source).toMatch(/cd-hero:grid-cols-\[minmax\(0,470px\)_minmax\(0,1fr\)_312px\]/);
    expect(source).toMatch(/cd-hero:p-0/);
  });

  // ----- M65 additions: guards for what the reconstruction introduced -----

  it('the desktop DATA STATUS row renders the REAL resolveLiveStatus() output, never a hardcoded LIVE literal or a hardcoded time', () => {
    expect(source).toMatch(/resolveLiveStatus\(isLive, dataMode, language, updatedAt\)/);
    expect(source).toMatch(/\{badgeText\}/);
    expect(source).toMatch(/\{lastUpdated\}/);
    expect(codeOnly(source)).not.toMatch(/>\s*LIVE\s*</);
    expect(source).not.toMatch(/18:07/);
  });

  it('Hero never manufactures its own timestamp — updatedAt is a required prop resolved once by the Server Component', () => {
    expect(source).toMatch(/updatedAt: string;/);
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/new Date\(\)/);
  });

  it('DATA STATUS and LAST UPDATED are dictionary-driven, not hardcoded English prototype chrome', () => {
    expect(source).toMatch(/\{t\.dataStatusLabel\}/);
    expect(source).toMatch(/\{t\.lastUpdatedLabel\}/);
    // Comments legitimately name these labels while documenting them;
    // what must not exist is a rendered English literal.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/DATA STATUS/);
    expect(codeOnly).not.toMatch(/LAST UPDATED/);
  });

  it('the credibility row renders all four approved pillars, including Multi-Perspective', () => {
    expect(source).toMatch(/t\.credibilityMultiPerspective/);
  });

  it('the real /map CTA is RETAINED per explicit CTO decision — working navigation is not deleted for absence of design evidence', () => {
    expect(source).toMatch(/href="\/map"/);
    expect(source).toMatch(/\{t\.exploreMapCta\}/);
  });

  it('Hero renders no language control of its own — the header owns that state, so a second visible control here would be a duplicate', () => {
    expect(source).not.toMatch(/<LanguageSelector/);
    expect(source).not.toMatch(/handleLanguageChange/);
  });

  it('the mount-time language sync stays inside an effect and still refreshes the Server Component feed — no render-time localStorage read', () => {
    expect(source).toMatch(/useEffect\(\(\) => \{\s*\n\s*const effectiveServerLanguage = readLanguageCookie\(\) \?\? 'en';/);
    expect(source).toMatch(/router\.refresh\(\);/);
  });

  it('the Hero category-control strip is deliberately NOT introduced (deferred by explicit CTO decision; re-confirmed as L-6A in M66.3 because no real signal dataset exists behind it)', () => {
    expect(source).not.toMatch(/HeroCategoryControls/);
  });
});

/* ───────────────────────── M66.3 — GN-CD-040 → GN-CD-076 ───────────────────────── */

describe('M66.3 Hero — released composition geometry', () => {
  it('hands off between the console and the authored mobile card at exactly one breakpoint, cd-hero = 1240px (CTO decision L-1A)', () => {
    expect((themeExtend.screens as unknown as Record<string, string>)['cd-hero']).toBe('1240px');
    // One gate, used consistently: no `lg:` or `xl:` composition class survives.
    const code = codeOnly(source);
    expect(code).not.toMatch(/\blg:/);
    expect(code).not.toMatch(/\bxl:/);
    expect(code).not.toMatch(/\bsm:/);
  });

  it('mounts the map at GN-CD-043\u2019s exact percentages, with the max(22%,470px) floor that deleted the designed underlap removed', () => {
    expect(source).toMatch(/left: '22%', right: '13%'/);
    expect(codeOnly(source)).not.toMatch(/max\(22%/);
  });

  it('anchors both scrims to the HERO SURFACE rather than to the map field — the correction GN-CD \u00a7U.2 depends on', () => {
    // Structural, not just value-level: the scrims must be siblings of the map
    // mount, not nested inside it. Anchored to the field they landed ~170px
    // INSIDE the map, banding its body and leaving its real left edge hard-cut.
    const mapMountIndex = source.indexOf("left: '22%', right: '13%'");
    const leftScrimIndex = source.indexOf('bg-cd-scrim-l');
    const rightScrimIndex = source.indexOf('bg-cd-scrim-r');
    expect(mapMountIndex).toBeGreaterThan(0);
    expect(leftScrimIndex).toBeGreaterThan(mapMountIndex);
    expect(rightScrimIndex).toBeGreaterThan(leftScrimIndex);
    // The map mount closes before either scrim opens.
    const mountBlockEnd = source.indexOf('</div>', source.indexOf('<HeroIntelligenceField />'));
    expect(leftScrimIndex).toBeGreaterThan(mountBlockEnd);
    expect(source).toMatch(/left-\[20%\] hidden w-\[16%\] bg-cd-scrim-l/);
    expect(source).toMatch(/right-\[12%\] hidden w-\[12%\] bg-cd-scrim-r/);
    const backgroundImage = themeExtend.backgroundImage as unknown as Record<string, string>;
    expect(backgroundImage['cd-scrim-l']).toBe('linear-gradient(90deg, rgba(4,6,12,.95), rgba(4,6,12,0))');
    expect(backgroundImage['cd-scrim-r']).toBe('linear-gradient(270deg, rgba(4,6,12,.92), rgba(4,6,12,0))');
  });

  it('renders the GN-CD-041 technical grid at its released stroke and spacing, desktop only — the design verifies the mobile hero has none', () => {
    expect(source).toMatch(/hidden bg-cd-grid-hero bg-cd-grid-44 cd-hero:block/);
    const backgroundImage = themeExtend.backgroundImage as unknown as Record<string, string>;
    expect(backgroundImage['cd-grid-hero']).toContain('rgba(56,189,248,.035)');
    expect((themeExtend.backgroundSize as unknown as Record<string, string>)['cd-grid-44']).toBe('44px 44px');
  });

  it('declares no z-index anywhere — GN-CD-072b: order is DOM order', () => {
    expect(codeOnly(source)).not.toMatch(/\bz-\d/);
    expect(codeOnly(source)).not.toMatch(/zIndex/);
  });

  it('mounts the HUD and both map instances — desktop field and mobile bleed', () => {
    expect(source).toMatch(/<HeroHud \/>/);
    // M66.14B — the desktop instance now receives a resolved focus target.
    expect(source).toMatch(/<HeroIntelligenceField focus=\{fieldFocus\} \/>/);
    expect(source).toMatch(/<HeroIntelligenceField compact \/>/);
  });
});

describe('M66.3 Hero — the mobile ladder is authored, not the desktop shrunk', () => {
  it('uses GN-CD-058\u2019s own 26px mobile headline rather than the clamp floor', () => {
    expect(source).toMatch(/text-cd-hero-m\b/);
    expect(source).toMatch(/cd-hero:text-cd-hero\b/);
  });

  it('uses GN-CD-059\u2019s own mobile copy size and measure', () => {
    expect(source).toMatch(/max-w-cd-copy-m/);
    expect(source).toMatch(/cd-hero:max-w-cd-copy/);
    expect(source).toMatch(/text-cd-hero-copy-m/);
    const maxWidth = themeExtend.maxWidth as unknown as Record<string, string>;
    expect(maxWidth['cd-copy']).toBe('340px');
    expect(maxWidth['cd-copy-m']).toBe('300px');
  });

  it('meets the 44px touch floor on the mobile submit control — a real accessibility defect before M66.3, where mobile rendered the 38px desktop button', () => {
    expect(source).toMatch(/h-cd-44 w-cd-44/);
    expect(source).toMatch(/cd-hero:h-cd-38 cd-hero:w-cd-38/);
    const spacing = themeExtend.spacing as unknown as Record<string, string>;
    expect(spacing['cd-44']).toBe('44px');
    expect(spacing['cd-38']).toBe('38px');
  });

  it('gives the mobile card its own released frame rather than reusing the desktop one', () => {
    expect(source).toMatch(/rounded-cd-16 border border-cd-edge-section/);
    expect(source).toMatch(/px-cd-14 pb-cd-15 pt-cd-13/);
    expect(source).toMatch(/bg-cd-hero-m/);
  });

  it('preserves the released mobile map bleed geometry and both GN-CD-026 scrims exactly', () => {
    expect(source).toMatch(/-right-\[16px\] -top-\[10px\] h-\[198px\] w-\[238px\]/);
    expect(source).toMatch(/bg-cd-map-scrim-a/);
    expect(source).toMatch(/bg-cd-map-scrim-b/);
  });
});

describe('M66.3 Hero — honest claims (CTO decisions L-6A, L-7, L-8)', () => {
  const code = codeOnly(source);

  it('fabricates no signal, source, country or scope semantics', () => {
    for (const forbidden of [
      '118 COUNTRIES',
      'ACTIVE SIGNALS',
      'SOURCES',
      'EVIDENCE',
      'INSPECT ANALYSIS',
      'SCOPE_R',
      'RELATED',
      'focusSpot',
      'signalSel',
      'spotCount',
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('names no place and no category on any map element', () => {
    for (const name of ['washington', 'brasilia', 'moscow', 'cairo', 'beijing', 'jakarta', 'nairobi']) {
      expect(code.toLowerCase()).not.toContain(name);
    }
  });

  it('renders no signal preview and no category filter strip', () => {
    expect(code).not.toMatch(/signal[- ]?preview/i);
    expect(code).not.toMatch(/openCategory|activeCat|layers=/);
  });

  it('implements GN-CD-068 EXPAND MAP as a REAL keyboard-reachable link to /map — the prototype\u2019s own control has no role, tabIndex or key handler (DEFECT-004)', () => {
    const overlay = source.slice(source.indexOf('pointer-events-none relative hidden cd-hero:block'));
    expect(overlay).toMatch(/<a\s+href="\/map"/);
    expect(overlay).toMatch(/pointer-events-auto/);
    expect(overlay).not.toMatch(/role="link"/);
    expect(overlay).not.toMatch(/tabIndex/);
  });

  it('keeps column 2 a transparent overlay above the map, so the map stays clickable wherever the overlay has no control (GN-CD \u00a7D, \u00a7U.13)', () => {
    expect(source).toMatch(/pointer-events-none relative hidden cd-hero:block/);
  });

  it('omits GN-CD-063\u2019s decorative caret, which the specification itself records as coexisting with the browser\u2019s real caret (UNRESOLVED-020)', () => {
    expect(code).not.toMatch(/animate-cd-caret/);
  });
});

describe('M66.3 Hero — DATA STATUS overflow correction (CTO decision L-2A)', () => {
  it('moves LAST UPDATED onto its own line and lets the primary row wrap, so the complete provenance pill survives in every state and both languages', () => {
    expect(source).toMatch(/hidden flex-col gap-cd-4 font-cd-mono text-cd-mono-status uppercase cd-hero:flex/);
    expect(source).toMatch(/flex flex-wrap items-center gap-x-cd-10 gap-y-cd-6/);
  });

  it('abbreviates, truncates and hides nothing — the badge text is still the raw resolveLiveStatus() output', () => {
    const code2 = codeOnly(source);
    expect(source).toMatch(/\{badgeText\}/);
    // No line-clamp, truncate or ellipsis anywhere near the status row.
    const statusBlock = source.slice(source.indexOf('t.dataStatusLabel'), source.indexOf('t.badge'));
    expect(statusBlock).not.toMatch(/truncate|line-clamp|text-ellipsis|overflow-hidden/);
    expect(code2).not.toMatch(/substring|slice\(0,\s*\d+\)/);
  });

  it('keeps the released GN-CD-056 pill geometry and the repository\u2019s truthful non-live branch', () => {
    expect(source).toMatch(/rounded-cd-5 border px-cd-9 py-cd-3/);
    expect(source).toMatch(/border-cd-edge-live bg-cd-fill-live text-cd-ink-live/);
    // The amber cached/mock/reconnecting/unknown treatment has no GN-CD
    // equivalent and is production truth. It must not be deleted for fidelity.
    expect(source).toMatch(/rgba\(251,191,36,0\.45\)/);
    expect(source).toMatch(/animate-cd-live-dot/);
  });
});

describe('M66.3 Hero — accessibility and motion', () => {
  it('marks every decorative layer aria-hidden', () => {
    // grid, map mount, both scrims, mobile bleed, the badge bolt, the AI
    // indicator, the submit glyph, every bullet dot.
    const hidden = (source.match(/aria-hidden="true"/g) ?? []).length;
    expect(hidden).toBeGreaterThanOrEqual(8);
  });

  it('keeps exactly one <h1> and the real form semantics', () => {
    expect((source.match(/<h1/g) ?? []).length).toBe(1);
    expect(source).toMatch(/role="search"/);
    expect(source).toMatch(/maxLength=\{QUESTION_MAX_LENGTH\}/);
    expect(source).toMatch(/aria-label=\{t\.submitAriaLabel\}/);
    expect(source).toMatch(/aria-describedby="hero-question-char-count"/);
  });

  it('never lets the breathing ask field suppress its own focus indicator — an animated border-color outranks the focus class, so the breathing stops on focus', () => {
    expect(source).toMatch(/focus-within:animate-none focus-within:border-cd-accent-cyan/);
  });

  it('uses only released cd-* animations, so the M66.1 reduced-motion layer covers every one of them', () => {
    const animations = themeExtend.animation as unknown as Record<string, string>;
    const used = source.match(/animate-[a-z0-9-]+/g) ?? [];
    for (const cls of used) {
      const name = cls.replace('animate-', '');
      if (name === 'none') continue;
      expect(Object.keys(animations)).toContain(name);
    }
  });
});
