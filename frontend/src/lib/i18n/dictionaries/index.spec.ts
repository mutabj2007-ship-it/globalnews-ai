import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from './index';
import { footerLinkGroups } from '@/lib/homeContent';
import { primaryNavLinks } from '@/lib/navigation';

/**
 * Milestone #47 (homepage integration) — these tests exist specifically
 * to prove the homepage Hero localization did not alter a single
 * existing English string. Every `en.hero.*` assertion below is the
 * EXACT original hardcoded string from the pre-Milestone-#47 Hero.tsx,
 * verified against the real component in a companion harness — this
 * file guards the dictionary side of that guarantee permanently.
 */
describe('Milestone #47 (homepage integration) — hero dictionary', () => {
  it('English hero strings are byte-identical to the original hardcoded Hero.tsx text', () => {
    const en = getDictionary('en');
    expect(en.hero.badge).toBe('AI-powered news intelligence');
    expect(en.hero.headline).toBe('Understand today\u2019s world in seconds.');
    expect(en.hero.subhead).toBe(
      'Ask a question about any story and GlobalNews AI reads the coverage across outlets and viewpoints, then gives you a clear, sourced summary you can trust.',
    );
    expect(en.hero.inputPlaceholder).toBe('Ask anything...');
    expect(en.hero.inputAriaLabel).toBe('Ask GlobalNews AI a question');
    expect(en.hero.formAriaLabel).toBe('Ask GlobalNews AI');
    expect(en.hero.submitAriaLabel).toBe('Submit question');
    // Query-limit correction — Hero.tsx's textarea character-limit
    // message, shown when the 1000-character maximum is reached.
    expect(en.hero.questionMaxLengthReached).toBe('Maximum question length reached');
    expect(en.hero.tryPrefix).toBe('Try:');
  });

  it('Polish hero strings are present, non-empty, and distinct from English', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    const keys = Object.keys(en.hero) as Array<keyof typeof en.hero>;
    for (const key of keys) {
      expect(pl.hero[key].length).toBeGreaterThan(0);
      expect(pl.hero[key]).not.toBe(en.hero[key]);
    }
  });

  it('Query-limit correction — questionMaxLengthReached has the exact approved English and Polish text', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.hero.questionMaxLengthReached).toBe('Maximum question length reached');
    expect(pl.hero.questionMaxLengthReached).toBe('Osiągnięto maksymalną długość pytania');
  });

  it('an unimplemented language falls back to the English hero dictionary, not an error or empty object', () => {
    const fallback = getDictionary('sw');
    expect(fallback.hero.badge).toBe('AI-powered news intelligence');
  });

  it('Dictionary type is now a proper shared structural shape (en and pl both satisfy it) — regression guard for the as-const type bug found during homepage integration', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
    expect(Object.keys(en.hero).sort()).toEqual(Object.keys(pl.hero).sort());
  });
});

describe('Milestone #48 — homepage below-Hero dictionary sections', () => {
  it('every en homepage-section string matches the current dictionary-driven text', () => {
    const en = getDictionary('en');
    expect(en.newsroomSnapshot.label).toBe('Newsroom snapshot');
    expect(en.newsroomSnapshot.headline).toBe('Top story right now');
    expect(en.featuredStory.unavailable).toBe(
      'Live headlines are temporarily unavailable. Check that the backend is running.',
    );
    expect(en.featuredStory.viewSources).toBe('View sources');
    expect(en.inFocusSidebar.heading).toBe('In focus');
    expect(en.inFocusSidebar.unavailable).toBe('Live headlines are temporarily unavailable.');
    expect(en.categoryCards.label).toBe('Today\u2019s coverage');
    expect(en.categoryCards.headline).toBe('More from today\u2019s coverage');
    expect(en.latestUpdatesFeed.label).toBe('Latest updates');
    expect(en.latestUpdatesFeed.headline).toBe('As it comes in');
    expect(en.howItWorks.label).toBe('How it works');
    expect(en.howItWorks.headline).toBe('From question to clarity, in three steps');
    expect(en.trustSection.label).toBe('Built on trust');
    expect(en.trustSection.headline).toBe('Why trust GlobalNews AI?');
    expect(en.navBar.signIn).toBe('Sign In');
    expect(en.footer.comingSoon).toBe('Coming soon');
    expect(en.footer.copyrightSuffix).toBe('GlobalNews AI. All rights reserved.');
    expect(en.footer.closingTagline).toBe('Built for clarity, not clicks.');
    expect(en.liveStatusStrip.reconnecting).toBe('RECONNECTING');
    expect(en.liveStatusStrip.monitoring).toBe('Monitoring trusted global sources');
  });

  it('howItWorks.steps and trustSection.items are the same length and order in both languages, so array-index alignment with homeContent.ts never mismatches', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.howItWorks.steps.length).toBe(3);
    expect(pl.howItWorks.steps.length).toBe(3);
    expect(en.trustSection.items.length).toBe(5);
    expect(pl.trustSection.items.length).toBe(5);
  });

  it('every Polish homepage-section string is present, non-empty, and distinct from its English counterpart', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    const sections = [
      'newsroomSnapshot',
      'featuredStory',
      'inFocusSidebar',
      'categoryCards',
      'latestUpdatesFeed',
      'liveStatusStrip',
    ] as const;
    for (const section of sections) {
      const enKeys = Object.keys(en[section]) as Array<keyof (typeof en)[typeof section]>;
      for (const key of enKeys) {
        // Milestone #53 regression repair — `en[section][key]` is a
        // doubly-generic indexed access (both `section` and `key`
        // are union types iterated in a loop), which TypeScript's
        // control-flow narrowing does not propagate through
        // correctly: even after `typeof plValue === 'string'` is
        // checked, TS still infers the narrowed type as `never`
        // inside the branch. Cast to `unknown` first (the only
        // type-safe way to widen before re-narrowing) rather than
        // suppressing the check — the runtime `typeof` guard above
        // still does the actual safety work; this only fixes what
        // the type-checker is ABLE to conclude from it.
        const enValue = en[section][key] as unknown;
        const plValue = pl[section][key] as unknown;
        if (typeof enValue === 'string' && typeof plValue === 'string') {
          expect(plValue.length).toBeGreaterThan(0);
          expect(plValue).not.toBe(enValue);
        }
      }
    }
  });

  it('navBar.linkLabels contains entries for the current, real primaryNavLinks routes', () => {
    const en = getDictionary('en');
    expect(en.navBar.linkLabels['/']).toBe('Home');
    expect(en.navBar.linkLabels['/map']).toBe('World Map');
  });

  it('footer.linkLabels retains legacy entries (/about, /careers, etc.) as harmless unused translation data \u2014 Milestone #53 navigation cleanup, updated for B2', () => {
    // Milestone #53 regression repair — this test previously claimed
    // these dictionary keys "match homeContent.ts / navigation.ts
    // routes", which is no longer true: the M53 dead-navigation fix
    // emptied footerLinkGroups to [] (every one of these hrefs was a
    // 404 with no matching page) and reduced primaryNavLinks to just
    // '/' and '/map'. The raw dictionary strings themselves are
    // unchanged and still correct as translation data — deleting them
    // would be unrelated dictionary-coverage removal, which is out of
    // scope here — but the test's own framing was misleading. This
    // version states the current truth plainly: these are retained,
    // presently-unused entries, cross-checked directly against the
    // real (now-empty) footerLinkGroups/primaryNavLinks sources so a
    // future re-wiring of any of these routes is free to happen
    // without this test needing to change again.
    //
    // B2 correction: /privacy became a real route and a real footer
    // destination in the B2 milestone (frontend/src/app/privacy/page.tsx,
    // reintroduced in footerLinkGroups) — it is no longer a "legacy,
    // unused" entry for the FOOTER specifically, so it is removed from
    // the footer-absence check below. It was never added to
    // primaryNavLinks by B2, so that half of the assertion is
    // unchanged and still correct.
    const en = getDictionary('en');
    expect(en.footer.linkLabels['/about']).toBe('About');
    expect(en.footer.linkLabels['/careers']).toBe('Careers');
    expect(en.footer.linkLabels['/privacy']).toBe('Privacy Policy');

    const currentFooterHrefs = footerLinkGroups.flatMap((group) =>
      group.links.map((link) => link.href),
    );
    const currentNavHrefs = primaryNavLinks.map((link) => link.href);
    for (const legacyHref of ['/about', '/careers']) {
      expect(currentFooterHrefs).not.toContain(legacyHref);
      expect(currentNavHrefs).not.toContain(legacyHref);
    }
    // /privacy remains correctly absent from primaryNavLinks (B2 only
    // restored it as a footer destination, not a top-nav destination).
    expect(currentNavHrefs).not.toContain('/privacy');
  });

  it('B2 — /privacy and /terms are real, expected footer destinations; /about, /careers, /contact, and /api remain absent', () => {
    const currentFooterHrefs = footerLinkGroups.flatMap((group) =>
      group.links.map((link) => link.href),
    );
    expect(currentFooterHrefs).toContain('/privacy');
    expect(currentFooterHrefs).toContain('/terms');
    for (const stillDeadHref of ['/about', '/careers', '/contact', '/api']) {
      expect(currentFooterHrefs).not.toContain(stillDeadHref);
    }
  });

  it('Polish footer/nav link labels exist for the same href keys as English', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(Object.keys(en.footer.linkLabels).sort()).toEqual(
      Object.keys(pl.footer.linkLabels).sort(),
    );
    expect(Object.keys(en.navBar.linkLabels).sort()).toEqual(
      Object.keys(pl.navBar.linkLabels).sort(),
    );
  });

  it('an unimplemented language falls back to the full English dictionary, including all M48 sections', () => {
    const fallback = getDictionary('sw');
    expect(fallback.newsroomSnapshot.label).toBe('Newsroom snapshot');
    expect(fallback.footer.copyrightSuffix).toBe('GlobalNews AI. All rights reserved.');
  });

  it('no duplicate i18n mechanism was introduced — every M48 section lives under the SAME getDictionary(language) call as pre-existing M47 sections', () => {
    const en = getDictionary('en');
    const topLevelKeys = Object.keys(en);
    // M47 sections and M48 sections coexist as siblings under one dictionary object.
    expect(topLevelKeys).toEqual(
      expect.arrayContaining([
        'hero',
        'analysisResultView',
        'newsroomSnapshot',
        'featuredStory',
        'inFocusSidebar',
        'categoryCards',
        'latestUpdatesFeed',
        'howItWorks',
        'trustSection',
        'footer',
        'navBar',
        'liveStatusStrip',
      ]),
    );
  });
});

describe('Milestone #49 — World Map dictionary section', () => {
  it('every en map string is byte-identical to the original hardcoded component text', () => {
    const en = getDictionary('en');
    expect(en.map.metaTitle).toBe('World Map \u2014 GlobalNews AI');
    expect(en.map.metaDescription).toBe(
      'Explore current news coverage by country on an interactive world map.',
    );
    expect(en.map.exploreLabel).toBe('Explore');
    expect(en.map.headline).toBe('World News Map');
    expect(en.map.loading).toBe('Loading world map\u2026');
    expect(en.map.searchLabel).toBe('Search for a country by name');
    expect(en.map.searchPlaceholder).toBe('Search for a country (e.g. Spain)');
    expect(en.map.categories.all).toBe('All');
    expect(en.map.categories.world).toBe('World');
    expect(en.map.coverageLegendTitle).toBe('Coverage Legend');
    expect(en.map.legendNoStories).toBe('No stories loaded');
    expect(en.map.tooltipLoaded).toBe('LOADED');
    expect(en.map.tooltipReady).toBe('READY');
    expect(en.map.newestStoredArticle).toBe('Newest stored article:');
    expect(en.map.panel.coverageQuality).toBe('Coverage Quality');
    expect(en.map.panel.viewFullCoverage).toBe('View full country coverage');
  });

  /*
    M66.13C — the canonical set is read from shared/src/news.ts as TEXT.
    jest resolves no mapping for '@globalnews-ai/shared', and adding one means
    editing frontend/jest.config.js, which this milestone is not authorized to
    touch. Reading the source also beats importing shared/dist, which is a
    build artifact and can be stale. A failed parse throws rather than
    returning an empty set, so this can never pass vacuously.
  */
  const canonicalCategories = (): string[] => {
    const source = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'shared', 'src', 'news.ts'),
      'utf-8',
    );
    const declaration = /export const NEWS_CATEGORIES: NewsCategory\[\] = \[([\s\S]*?)\];/.exec(source);
    if (!declaration) {
      throw new Error('shared/src/news.ts no longer declares NEWS_CATEGORIES in the expected form');
    }
    const members = [...declaration[1].matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
    if (members.length === 0) {
      throw new Error('NEWS_CATEGORIES parsed as empty — this guard would be vacuous');
    }
    return members;
  };

  const NEWS_CATEGORIES = canonicalCategories();

  /*
    This test's TITLE always claimed parity with the canonical
    NewsCategory set, but its assertion hardcoded a six-key list that was
    NOT that set: 'sports' and 'entertainment' were missing, and the
    backend classifier genuinely emits both. The test could not fail on the
    very drift it was named for.

    It is converted, not deleted: the expectation is now DERIVED from the
    shared NEWS_CATEGORIES constant, so adding a category to the union
    fails this test until the taxonomy is localized. 'all' is not a
    NewsCategory — it is the filter bar's own 'no filter' option — so it is
    named explicitly as the single deliberate addition.
  */
  it('map.categories covers the canonical NewsCategory set exactly, plus the filter-only \'all\' option', () => {
    const en = getDictionary('en');
    const expected = ['all', ...NEWS_CATEGORIES].sort();
    expect(Object.keys(en.map.categories).sort()).toEqual(expected);
    expect(Object.keys(getDictionary('pl').map.categories).sort()).toEqual(expected);
  });

  it('every canonical category has a real, distinct label in BOTH languages — no raw token can reach a user', () => {
    const en = getDictionary('en').map.categories;
    const pl = getDictionary('pl').map.categories;
    for (const category of NEWS_CATEGORIES) {
      expect(typeof en[category]).toBe('string');
      expect(en[category].length).toBeGreaterThan(0);
      expect(typeof pl[category]).toBe('string');
      expect(pl[category].length).toBeGreaterThan(0);
      // A label equal to its own key is the token leaking, not a translation.
      expect(en[category]).not.toBe(category);
      expect(pl[category]).not.toBe(category);
      // Polish must actually differ from English for every one of these.
      expect(pl[category]).not.toBe(en[category]);
    }
  });

  it('map.storyForms is structured for pluralWithForms (a 3-tuple), matching the M48 pluralization architecture, not a second mechanism', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.map.storyForms).toHaveLength(3);
    expect(pl.map.storyForms).toHaveLength(3);
  });

  it('every Polish map string is present, non-empty, and distinct from its English counterpart (top-level string keys)', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    const stringKeys = Object.keys(en.map).filter(
      (key) => typeof (en.map as Record<string, unknown>)[key] === 'string',
    ) as Array<keyof typeof en.map>;
    for (const key of stringKeys) {
      const plValue = pl.map[key] as unknown as string;
      expect(plValue.length).toBeGreaterThan(0);
      expect(plValue).not.toBe(en.map[key]);
    }
  });

  it('map.badge live/delayed prefixes never hardcode "GNews" — the provider name is always interpolated, so a different configured provider still renders correctly', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.map.badge.livePrefix).not.toContain('GNews');
    expect(pl.map.badge.livePrefix).not.toContain('GNews');
  });

  it('an unimplemented language falls back to the full English map dictionary', () => {
    const fallback = getDictionary('sw');
    expect(fallback.map.exploreLabel).toBe('Explore');
    expect(fallback.map.panel.viewFullCoverage).toBe('View full country coverage');
  });

  it('no duplicate i18n mechanism was introduced — map lives under the SAME getDictionary(language) call as every other section', () => {
    const en = getDictionary('en');
    expect(Object.keys(en)).toEqual(
      expect.arrayContaining(['map', 'hero', 'newsroomSnapshot', 'footer']),
    );
  });
});

describe('Milestone #49 Phase B cleanup — remaining hardcoded accessibility strings', () => {
  it('storedReportingNoticeAriaLabel is byte-identical in English and localized in Polish', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.map.storedReportingNoticeAriaLabel).toBe('Stored reporting notice');
    expect(pl.map.storedReportingNoticeAriaLabel).not.toBe(en.map.storedReportingNoticeAriaLabel);
    expect(pl.map.storedReportingNoticeAriaLabel.length).toBeGreaterThan(0);
  });

  it('coverageQualityAriaSuffix reconstructs the original "{country} coverage quality" aria-label pattern in English', () => {
    const en = getDictionary('en');
    expect(`Rwanda ${en.map.coverageQualityAriaSuffix}`).toBe('Rwanda coverage quality');
  });

  it('readFullStoryPrefix reconstructs the original "Read the full story: {title}" aria-label pattern in English', () => {
    const en = getDictionary('en');
    expect(`${en.map.readFullStoryPrefix} Some Title`).toBe('Read the full story: Some Title');
  });

  it('freshness badge values (FRESH/RECENT/AGING/LIMITED) are byte-identical in English — these ARE user-visible, not internal-only', () => {
    const en = getDictionary('en');
    expect(en.map.freshness.fresh).toBe('FRESH');
    expect(en.map.freshness.recent).toBe('RECENT');
    expect(en.map.freshness.aging).toBe('AGING');
    expect(en.map.freshness.limited).toBe('LIMITED');
  });

  it('freshness values are localized in Polish and structurally match English', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(Object.keys(en.map.freshness).sort()).toEqual(Object.keys(pl.map.freshness).sort());
    for (const key of Object.keys(en.map.freshness)) {
      expect(pl.map.freshness[key]).not.toBe(en.map.freshness[key]);
      expect(pl.map.freshness[key].length).toBeGreaterThan(0);
    }
  });
});

describe('Milestone #51 Phase B — homepage semantic correction', () => {
  it('no user-facing "Trending" concept remains in the English dictionary', () => {
    const en = getDictionary('en');
    expect(en).not.toHaveProperty('trendingSidebar');
    expect(en.inFocusSidebar.heading.toLowerCase()).not.toContain('trending');
    expect(en.inFocusSidebar.heading.toLowerCase()).not.toContain('popular');
    expect(en.inFocusSidebar.heading.toLowerCase()).not.toContain('hot');
    expect(en.inFocusSidebar.heading.toLowerCase()).not.toContain('viral');
    expect(en.inFocusSidebar.heading.toLowerCase()).not.toContain('most read');
  });

  it('the new "In Focus" heading exists in English and Polish, with genuinely different text', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.inFocusSidebar.heading.length).toBeGreaterThan(0);
    expect(pl.inFocusSidebar.heading.length).toBeGreaterThan(0);
    expect(pl.inFocusSidebar.heading).not.toBe(en.inFocusSidebar.heading);
  });

  it('the Featured Story headline no longer implies unsupported popularity', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.newsroomSnapshot.headline.toLowerCase()).not.toContain('everyone');
    expect(en.newsroomSnapshot.headline.toLowerCase()).not.toContain('reading');
    expect(pl.newsroomSnapshot.headline).not.toBe('Historia, którą dziś czyta każdy');
  });

  it('CategoryCards headline no longer implies genuine per-category navigation', () => {
    const en = getDictionary('en');
    expect(en.categoryCards.headline.toLowerCase()).not.toContain('six ways');
  });

  it('localized aria-label prefixes exist for every homepage component whose aria-label was previously hardcoded English', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    for (const group of ['featuredStory', 'inFocusSidebar', 'categoryCards'] as const) {
      expect(en[group].readFullStoryPrefix.length).toBeGreaterThan(0);
      expect(pl[group].readFullStoryPrefix.length).toBeGreaterThan(0);
      expect(pl[group].readFullStoryPrefix).not.toBe(en[group].readFullStoryPrefix);
    }
  });

  it('dictionary structural parity holds for every renamed/changed section (en/pl have identical key sets)', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    for (const group of [
      'newsroomSnapshot',
      'featuredStory',
      'inFocusSidebar',
      'categoryCards',
    ] as const) {
      expect(Object.keys(en[group]).sort()).toEqual(Object.keys(pl[group]).sort());
    }
  });
});

describe('Milestone #51 consolidated round — Latest Now / World Map Gateway localization', () => {
  it('latestNowRail copy exists in EN and PL, with genuinely different text, and implies no popularity signal', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.latestNowRail.label.length).toBeGreaterThan(0);
    expect(pl.latestNowRail.label.length).toBeGreaterThan(0);
    expect(pl.latestNowRail.label).not.toBe(en.latestNowRail.label);
    for (const forbidden of ['trending', 'popular', 'most read', 'viral', 'hot']) {
      expect(en.latestNowRail.label.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('latestNowRail previous/next control labels exist and are localized', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.latestNowRail.previousLabel).not.toBe(pl.latestNowRail.previousLabel);
    expect(en.latestNowRail.nextLabel).not.toBe(pl.latestNowRail.nextLabel);
    expect(pl.latestNowRail.previousLabel.length).toBeGreaterThan(0);
    expect(pl.latestNowRail.nextLabel.length).toBeGreaterThan(0);
  });

  it('worldMapGateway copy exists in EN and PL with a real CTA in both', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.worldMapGateway.cta.length).toBeGreaterThan(0);
    expect(pl.worldMapGateway.cta.length).toBeGreaterThan(0);
    expect(pl.worldMapGateway.cta).not.toBe(en.worldMapGateway.cta);
  });

  it('latestUpdatesFeed gained a localized readFullStoryPrefix (rows are now real links)', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.latestUpdatesFeed.readFullStoryPrefix.length).toBeGreaterThan(0);
    expect(pl.latestUpdatesFeed.readFullStoryPrefix).not.toBe(
      en.latestUpdatesFeed.readFullStoryPrefix,
    );
  });

  it('every new Milestone #51 dictionary section has identical EN/PL key sets', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    for (const group of ['latestNowRail', 'worldMapGateway'] as const) {
      expect(Object.keys(en[group]).sort()).toEqual(Object.keys(pl[group]).sort());
    }
  });
});

describe('B2 — Public Legal Surfaces dictionary sections', () => {
  // M66.10B — the policy-page tuple. Extending THIS constant is how a new legal
  // surface inherits every structural guarantee below at once, rather than each
  // test being remembered individually. sourcePolicyPage joins privacyPage and
  // termsPage here; no existing coverage of the first two is weakened.
  const POLICY_PAGES = ['privacyPage', 'termsPage', 'sourcePolicyPage'] as const;

  it('every policy page exists in both English and Polish with non-empty titles and intros', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    for (const page of POLICY_PAGES) {
      expect(en[page].title.length).toBeGreaterThan(0);
      expect(en[page].intro.length).toBeGreaterThan(0);
      expect(pl[page].title.length).toBeGreaterThan(0);
      expect(pl[page].intro.length).toBeGreaterThan(0);
      expect(pl[page].title).not.toBe(en[page].title);
      expect(pl[page].intro).not.toBe(en[page].intro);
    }
  });

  it('every policy page has the SAME number of sections in English and Polish, so no section is missing in either language', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    for (const page of POLICY_PAGES) {
      expect(pl[page].sections.length).toBe(en[page].sections.length);
      // A policy page with no sections would satisfy the equality above.
      expect(en[page].sections.length).toBeGreaterThan(0);
    }
  });

  it('every section in every policy page has a non-empty heading and body in both languages, and the Polish text is genuinely different from the English text', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    for (const page of POLICY_PAGES) {
      en[page].sections.forEach((section, index) => {
        const plSection = pl[page].sections[index];
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.body.length).toBeGreaterThan(0);
        expect(plSection.heading.length).toBeGreaterThan(0);
        expect(plSection.body.length).toBeGreaterThan(0);
        expect(plSection.heading).not.toBe(section.heading);
        expect(plSection.body).not.toBe(section.body);
      });
    }
  });

  it('does not fabricate legal entity facts — no invented company name, registration number, address, jurisdiction, legal email, DPO, regulator, or VAT details appear in the legal copy', () => {
    const en = getDictionary('en');
    const forbiddenPatterns = [
      /\bltd\b/i,
      /\binc\.\b/i,
      /\bregistration number\b/i,
      /\bcompany number\b/i,
      /\bvat\b/i,
      /\bdata protection officer\b/i,
      /\bregistered office\b/i,
      /governed by the laws of/i,
    ];
    // M66.10B — driven off POLICY_PAGES, so sourcePolicyPage is covered by the
    // same guard and any future legal page is covered automatically.
    const allText = POLICY_PAGES.flatMap((page) => [
      en[page].intro,
      ...en[page].sections.flatMap((s) => [s.heading, s.body]),
    ]).join(' ');
    for (const pattern of forbiddenPatterns) {
      expect(allText).not.toMatch(pattern);
    }
  });

  it('B2 pre-commit correction — no dictionary string contains a literal, unescaped-looking double-backslash Unicode escape sequence (e.g. "\\\\u201c"), which renders as literal backslash-u text in the browser instead of a real character', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    // M66.10B — both languages, every policy page.
    const allText = POLICY_PAGES.flatMap((page) => [
      en[page].intro,
      ...en[page].sections.flatMap((s) => [s.heading, s.body]),
      pl[page].intro,
      ...pl[page].sections.flatMap((s) => [s.heading, s.body]),
    ]).join(' ');
    // If a double-backslash escape had survived, the RUNTIME STRING
    // value itself would contain a literal backslash character
    // followed by "u201c"/"u2019"/etc. — checked directly on the
    // resolved string, not the source text, so this proves the
    // actual rendered value is correct.
    expect(allText).not.toMatch(/\\u[0-9a-fA-F]{4}/);
  });

  it('B2 pre-commit correction — the terms "General disclaimer" section renders real curly quotation marks around "as is", not literal escape text', () => {
    const en = getDictionary('en');
    const disclaimer = en.termsPage.sections.find((s) => s.heading === 'General disclaimer');
    expect(disclaimer?.body).toContain('\u201cas is\u201d');
  });

  it('every policy page defines a static, non-empty lastUpdatedDate in both languages, distinct between EN and PL', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    for (const page of POLICY_PAGES) {
      expect(en[page].lastUpdatedDate.length).toBeGreaterThan(0);
      expect(pl[page].lastUpdatedDate.length).toBeGreaterThan(0);
      expect(pl[page].lastUpdatedDate).not.toBe(en[page].lastUpdatedDate);
      expect(en[page].lastUpdatedLabel.length).toBeGreaterThan(0);
      expect(pl[page].lastUpdatedLabel.length).toBeGreaterThan(0);
    }
  });

  it('B2 pre-commit correction — the exact approved publication date is used verbatim: "17 August 2026" (EN) and "17 sierpnia 2026" (PL)', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    // DELIBERATELY NOT driven off POLICY_PAGES. This assertion pins the B2
    // publication date, and the Source Policy has its OWN approved date (CTO
    // M66.10B: "Do not reuse the Privacy/Terms publication date"). Extending
    // this tuple would have forced a false shared date onto the new page.
    for (const page of ['privacyPage', 'termsPage'] as const) {
      expect(en[page].lastUpdatedDate).toBe('17 August 2026');
      expect(pl[page].lastUpdatedDate).toBe('17 sierpnia 2026');
    }
  });

  it('M66.10B — the Source Policy carries its OWN approved publication date: "20 August 2026" (EN) and "20 sierpnia 2026" (PL)', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.sourcePolicyPage.lastUpdatedDate).toBe('20 August 2026');
    expect(pl.sourcePolicyPage.lastUpdatedDate).toBe('20 sierpnia 2026');
    // And it is genuinely its own date, not the B2 one copied forward.
    expect(en.sourcePolicyPage.lastUpdatedDate).not.toBe(en.privacyPage.lastUpdatedDate);
    expect(pl.sourcePolicyPage.lastUpdatedDate).not.toBe(pl.privacyPage.lastUpdatedDate);
  });

  it('M66.10B — the Source Policy makes no claim the repository cannot support', () => {
    // The six claims M66.10A evaluated and REJECTED, asserted as absences over
    // the real runtime strings in both languages. This is the test that stops a
    // future copy edit from quietly reintroducing an unsupportable claim.
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    const enText = [
      en.sourcePolicyPage.title,
      en.sourcePolicyPage.intro,
      ...en.sourcePolicyPage.sections.flatMap((s) => [s.heading, s.body]),
    ].join(' ');

    // 1. No accuracy, completeness or real-time GUARANTEE. The page may say what
    //    it does NOT guarantee — hence the negative-lookahead on "not".
    expect(enText).not.toMatch(/(?<!not )guarantees?\s+(that\s+)?(accuracy|completeness|coverage|complete)/i);
    expect(enText).not.toMatch(/always\s+(up[- ]to[- ]date|current|accurate|complete)/i);
    expect(enText).not.toMatch(/real[- ]time/i);
    expect(enText).not.toMatch(/nothing hidden/i);

    // 2. No source-authority claim. OFFICIAL_SOURCES is empty and consumed by
    //    nothing; sourceAuthorityClass is never populated.
    expect(enText).not.toMatch(/source authority (is|are)|authoritative sources|trust score|credibility score/i);
    expect(enText).not.toMatch(/official source registry/i);

    // 3. No per-story source count. GNews hardcodes sourcesCount: 1.
    expect(enText).not.toMatch(/number of (distinct )?sources reporting|sources? count/i);

    // 4. No geographic/evidence precision claim. Both fields are declared in
    //    shared/src/news.ts and never written or read anywhere.
    expect(enText).not.toMatch(/geographic precision|evidence precision/i);

    // 5. No staffing claim (CTO wording correction A) — the repository cannot
    //    prove organizational staffing either way.
    expect(enText).not.toMatch(/employ(s|ed)? (reporters|journalists)|our (reporters|journalists|newsroom)/i);

    // 6. No universal sentence-level citation guarantee (CTO wording
    //    correction B) — validate-analysis-result.ts grounds ENTRIES, not
    //    every sentence.
    expect(enText).not.toMatch(/every (sentence|statement|claim) (in an analysis )?(must )?(cite|is cited)/i);

    // The claims the repository DOES support are present, so this test fails on
    // deletion as well as on overreach.
    expect(enText).toMatch(/24-hour/);
    expect(enText).toMatch(/does not guarantee/i);
    expect(enText).toMatch(/unknown/i);

    // Polish must not be stronger than English: same structural absences.
    const plText = [
      pl.sourcePolicyPage.title,
      pl.sourcePolicyPage.intro,
      ...pl.sourcePolicyPage.sections.flatMap((s) => [s.heading, s.body]),
    ].join(' ');
    expect(plText).not.toMatch(/real[- ]time/i);
    expect(plText).not.toMatch(/(?<!nie )gwarantuje, że/i);
    expect(plText).toMatch(/nie gwarantuje/i);
    expect(plText).toMatch(/24-godzinnego/);
  });
});
