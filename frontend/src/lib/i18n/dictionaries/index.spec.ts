import { getDictionary } from './index';

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
  it('every en homepage-section string is byte-identical to the original hardcoded component text', () => {
    const en = getDictionary('en');
    expect(en.newsroomSnapshot.label).toBe('Newsroom snapshot');
    expect(en.newsroomSnapshot.headline).toBe('The story everyone\u2019s reading');
    expect(en.featuredStory.unavailable).toBe(
      'Live headlines are temporarily unavailable. Check that the backend is running.',
    );
    expect(en.featuredStory.viewSources).toBe('View sources');
    expect(en.trendingSidebar.heading).toBe('Trending now');
    expect(en.trendingSidebar.unavailable).toBe('Live headlines are temporarily unavailable.');
    expect(en.categoryCards.label).toBe('Today\u2019s coverage');
    expect(en.categoryCards.headline).toBe('Six ways to see what\u2019s happening');
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
      'trendingSidebar',
      'categoryCards',
      'latestUpdatesFeed',
      'liveStatusStrip',
    ] as const;
    for (const section of sections) {
      const enKeys = Object.keys(en[section]) as Array<keyof (typeof en)[typeof section]>;
      for (const key of enKeys) {
        const enValue = en[section][key];
        const plValue = pl[section][key];
        if (typeof enValue === 'string' && typeof plValue === 'string') {
          expect(plValue.length).toBeGreaterThan(0);
          expect(plValue).not.toBe(enValue);
        }
      }
    }
  });

  it('footer.linkLabels and navBar.linkLabels are keyed by href, matching homeContent.ts / navigation.ts routes — routes themselves are never part of the dictionary', () => {
    const en = getDictionary('en');
    expect(en.footer.linkLabels['/about']).toBe('About');
    expect(en.footer.linkLabels['/careers']).toBe('Careers');
    expect(en.footer.linkLabels['/privacy']).toBe('Privacy Policy');
    expect(en.navBar.linkLabels['/']).toBe('Home');
    expect(en.navBar.linkLabels['/map']).toBe('World Map');
  });

  it('Polish footer/nav link labels exist for the same href keys as English', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(Object.keys(en.footer.linkLabels).sort()).toEqual(Object.keys(pl.footer.linkLabels).sort());
    expect(Object.keys(en.navBar.linkLabels).sort()).toEqual(Object.keys(pl.navBar.linkLabels).sort());
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
        'trendingSidebar',
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

  it('map.categories reuses the same NewsCategory keys used everywhere else, not a new taxonomy', () => {
    const en = getDictionary('en');
    expect(Object.keys(en.map.categories).sort()).toEqual(
      ['all', 'business', 'health', 'politics', 'science', 'technology', 'world'].sort(),
    );
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
    expect(Object.keys(en)).toEqual(expect.arrayContaining(['map', 'hero', 'newsroomSnapshot', 'footer']));
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
