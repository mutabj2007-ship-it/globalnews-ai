import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * M66.13 — HOMEPAGE LOCALIZATION PREVENTION.
 *
 * WHY THIS FILE EXISTS. Two milestones in a row produced a user-facing English
 * string that reached a Polish session: `SECTIONS`, ported verbatim into NavBar
 * during the M65 header reconstruction, and the root document title, which was
 * a static `export const metadata` that could not read the language cookie.
 * Neither was caught by review, because nothing failed when they were written.
 *
 * The repairs fix those two strings. THIS FILE FIXES THE HABIT: a reconstruction
 * that pastes design copy straight into JSX now fails here, in the pull request
 * that does it, instead of surfacing in a browser weeks later.
 *
 * WHAT IT DOES NOT DO. It cannot prove Polish is good Polish, and it cannot
 * render anything — the repository has no jsdom. It proves that every visible
 * string on the homepage path comes from the dictionary, that both dictionaries
 * agree on shape, and that no second localization mechanism has appeared.
 */

const SRC = join(__dirname, '..', '..');

/**
 * Every component on the homepage render path, plus the shell that wraps it.
 * A new homepage section MUST be added here — that is the point: the list is
 * the contract, and a component missing from it is a component nobody checked.
 */
const HOMEPAGE_COMPONENTS = [
  'app/page.tsx',
  'app/layout.tsx',
  'components/navigation/NavBar.tsx',
  'components/navigation/MobileBottomNav.tsx',
  'components/home/LiveStatusStrip.tsx',
  'components/home/Hero.tsx',
  'components/home/HeroLiveFeedPanel.tsx',
  'components/home/GlobalDevelopments.tsx',
  'components/home/TrendingCard.tsx',
  'components/home/IntelligenceEngineSection.tsx',
  'components/home/IntelligenceEngineRing.tsx',
  'components/home/IntelligenceModuleCard.tsx',
  'components/home/IntelligenceModulePanel.tsx',
  'components/home/HowItWorks.tsx',
  'components/home/TrustSection.tsx',
  'components/ui/DataModeLabel.tsx',
];

/**
 * Components that render NO user-facing text at all — pure SVG geometry and
 * layout. They are allow-listed rather than silently skipped, so that adding a
 * label to one of them is a deliberate act that has to be recorded here.
 */
const NO_TEXT_COMPONENTS = [
  'components/home/HeroHud.tsx',
  'components/home/HeroIntelligenceField.tsx',
  'components/home/HeroWorldVisual.tsx',
  'components/home/HeroWorldVisualMobile.tsx',
  'components/layout/PageCanvas.tsx',
];

/**
 * The only literals permitted to be rendered. Both are the product's own name,
 * which is a proper noun and is never translated — the same rule the footer and
 * the emblem already follow.
 */
const PROPER_NOUNS = ['GlobalNews AI', 'GlobalNews'];

function read(relative: string): string {
  return readFileSync(join(SRC, relative), 'utf-8');
}

function stripComments(text: string): string {
  return text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** JSX text nodes that are plain literals — the thing a reconstruction pastes in. */
function literalTextNodes(code: string): string[] {
  return [...code.matchAll(/>\s*([A-Za-z][^<>{}\n]{2,80}?)\s*</g)]
    .map((match) => match[1].trim())
    .filter((text) => !PROPER_NOUNS.includes(text))
    /*
      Source fragments, not rendered text: a JSX ternary head such as
      `entry.kind === 'unavailable' ? (` sits between a `>` and a `<` too.

      Filtered on `= ; ( )` ONLY, deliberately. An earlier draft of this guard
      also excluded `?`, which silently exempted every legitimate sentence ending
      in a question mark — "Why trust GlobalNews AI?" among them. A mutation test
      caught it: a hardcoded heading passed a guard written to forbid exactly that.
      Punctuation a human writes (? ! . ,) must never be an escape hatch.
    */
    .filter((text) => !/[=;()]/.test(text));
}

/** User-facing attributes carrying a literal instead of a dictionary value. */
function literalUserFacingAttributes(code: string): string[] {
  return [...code.matchAll(/(aria-label|placeholder|title|alt)="([^"]{2,80})"/g)].map(
    (match) => `${match[1]}="${match[2]}"`,
  );
}

describe('M66.13 — no homepage component may hardcode a user-facing string', () => {
  it('every homepage component renders no literal user-facing text', () => {
    for (const relative of HOMEPAGE_COMPONENTS) {
      const code = stripComments(read(relative));
      // Keyed by path so a failure names the file that hardcoded the string.
      expect({ relative, text: literalTextNodes(code) }).toEqual({ relative, text: [] });
      expect({ relative, attrs: literalUserFacingAttributes(code) }).toEqual({ relative, attrs: [] });
    }
  });

  it('every homepage component either localizes, or is declared to have no text', () => {
    // A component that neither reads the dictionary nor is on the no-text list is
    // exactly where the next hardcoded string will land unnoticed.
    for (const relative of HOMEPAGE_COMPONENTS) {
      const code = stripComments(read(relative));
      // A component localizes if it resolves the dictionary itself, or threads the
      // resolved language down to children that do. app/page.tsx is the latter.
      const localizes = /getDictionary\(/.test(code) || /\blanguage\b/.test(code);
      expect({ relative, localizes }).toEqual({ relative, localizes: true });
    }
  });

  it('the no-text allow-list is honest — those components really do render no text', () => {
    for (const relative of NO_TEXT_COMPONENTS) {
      const code = stripComments(read(relative));
      expect({ relative, text: literalTextNodes(code) }).toEqual({ relative, text: [] });
      expect({ relative, attrs: literalUserFacingAttributes(code) }).toEqual({ relative, attrs: [] });
    }
  });
});

describe('M66.13 — the strings this milestone repaired stay repaired', () => {
  it('the mobile menu heading comes from the dictionary, not a literal', () => {
    const navBar = stripComments(read('components/navigation/NavBar.tsx'));
    expect(navBar).toMatch(/\{t\.sectionsHeading\}/);
    expect(navBar).not.toMatch(/>SECTIONS</);
    for (const language of ['en', 'pl'] as const) {
      expect(getDictionary(language).navBar.sectionsHeading.length).toBeGreaterThan(0);
    }
    expect(getDictionary('pl').navBar.sectionsHeading).not.toBe(
      getDictionary('en').navBar.sectionsHeading,
    );
    // The English surface is unchanged by the repair.
    expect(getDictionary('en').navBar.sectionsHeading).toBe('SECTIONS');
  });

  it('root metadata is request-aware, so it can localize at all', () => {
    const layout = stripComments(read('app/layout.tsx'));
    // `export const metadata` is evaluated without request context and can never
    // read the language cookie. Only the async form can.
    expect(layout).not.toMatch(/export const metadata/);
    expect(layout).toMatch(/export async function generateMetadata\(\)/);
    expect(layout).toMatch(/cookies\(\)\.get\(LANGUAGE_COOKIE_NAME\)/);
    expect(layout).toMatch(/title: t\.homeMetaTitle/);
    expect(layout).toMatch(/description: t\.homeMetaDescription/);
  });

  it('the metadata strings exist in both languages and English is unchanged', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(en.homeMetaTitle).toBe('GlobalNews AI — Understand today’s world in seconds.');
    expect(en.homeMetaDescription).toBe(
      'GlobalNews AI turns the day’s news into clear, sourced, multi-perspective answers you can actually understand.',
    );
    expect(pl.homeMetaTitle).not.toBe(en.homeMetaTitle);
    expect(pl.homeMetaDescription).not.toBe(en.homeMetaDescription);
    expect(pl.homeMetaTitle.length).toBeGreaterThan(0);
    expect(pl.homeMetaDescription.length).toBeGreaterThan(0);
  });

  it('the established request-aware pattern was reused, not reinvented', () => {
    // /search has localized its metadata this way since B2. The root layout now
    // uses the SAME mechanism rather than a second one.
    const searchPage = stripComments(
      readFileSync(join(SRC, 'app', 'search', 'page.tsx'), 'utf-8'),
    );
    expect(searchPage).toMatch(/export async function generateMetadata\(\)/);
  });
});

describe('M66.13 — one localization mechanism, and only one', () => {
  it('no locale context, provider, or third-party i18n library was introduced', () => {
    for (const relative of [...HOMEPAGE_COMPONENTS, ...NO_TEXT_COMPONENTS]) {
      const code = stripComments(read(relative));
      expect(code).not.toMatch(/createContext|useContext|LocaleProvider|I18nProvider/);
      expect(code).not.toMatch(/from 'react-i18next'|from 'next-intl'|from 'i18next'/);
    }
  });

  it('language still flows as a prop from the server, never read from localStorage during render', () => {
    const page = stripComments(read('app/page.tsx'));
    expect(page).toMatch(/cookies\(\)\.get\(LANGUAGE_COOKIE_NAME\)/);
    expect(page).toMatch(/isActiveLanguageCode/);
    for (const relative of HOMEPAGE_COMPONENTS) {
      const code = stripComments(read(relative));
      expect({ relative, reads: /localStorage/.test(code) }).toEqual({ relative, reads: false });
    }
  });
});

describe('M66.13 — backend content is never translated by the frontend', () => {
  it('no homepage component maps article text through a translation helper', () => {
    // Article titles, summaries, source names and URLs are provider content.
    // NewsArticle.sourceLanguage records the provider's own reported language and
    // is documented as never fabricated; translating that content to make a
    // screenshot look Polish would be exactly that fabrication.
    for (const relative of HOMEPAGE_COMPONENTS) {
      const code = stripComments(read(relative));
      // Narrow deliberately: `translate(` also matches the CSS transform in
      // NavBar's search glyph, which is geometry, not language.
      expect(code).not.toMatch(/\.translate\(|autoTranslate|translateText|i18nTranslate/);
    }
  });
});

/*
  M66.13C — APPLICATION TAXONOMY.

  The block above catches a hardcoded LITERAL. It could never have caught the
  defect this milestone repairs, because `{item.category}` is not a literal: it
  is a dynamic expression whose runtime VALUE is an untranslated application
  token from the shared NewsCategory union. The hero live-feed panel printed
  that token straight into the DOM, so a Polish reader saw `world` and
  `technology` between fully Polish chrome.

  That is a second defect class, and this block is the guard for it. The rule it
  encodes is the CTO's distinction, stated once and asserted from three angles:

      APPLICATION TAXONOMY  -> localize
      ARTICLE / PROVIDER    -> preserve the supplied language

  These tests scan the LIVE homepage components only. Several retired-but-
  on-disk components (LatestNowRail, LatestUpdatesFeed, InFocusSidebar,
  FeaturedStory, CategoryCards, HomepageSituationMap) still render a raw
  category and are deliberately NOT covered: they are imported by nothing, so
  they render to no user. Remounting one puts it in HOMEPAGE_COMPONENTS, and
  this guard then applies to it. That limit is recorded rather than hidden,
  because a test that implies coverage it does not have is worse than none.
*/

/*
  THE CANONICAL CATEGORY SET, READ FROM ITS SINGLE SOURCE.

  This is read as TEXT rather than imported as a value, and that is deliberate.
  jest cannot resolve '@globalnews-ai/shared' from a frontend spec today: the
  workspace link is consumed by webpack and by tsconfig paths, but jest's
  config declares no mapping for it, and no frontend spec has ever imported a
  shared VALUE to discover that. Adding that mapping means editing
  frontend/jest.config.js, which is outside this milestone's authorized scope.

  Reading the source has an independent merit: it checks the real declaration
  rather than shared/dist, which is a build artifact that can be stale. The
  parse is asserted to succeed and to be non-empty, so a moved file or a
  reshaped constant FAILS here instead of quietly emptying every loop below.
*/
const SHARED_NEWS_SOURCE = join(SRC, '..', '..', 'shared', 'src', 'news.ts');

function canonicalCategories(): string[] {
  const source = readFileSync(SHARED_NEWS_SOURCE, 'utf-8');
  const declaration = /export const NEWS_CATEGORIES: NewsCategory\[\] = \[([\s\S]*?)\];/.exec(source);
  if (!declaration) {
    throw new Error('shared/src/news.ts no longer declares NEWS_CATEGORIES in the expected form');
  }
  const members = [...declaration[1].matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
  if (members.length === 0) {
    throw new Error('NEWS_CATEGORIES parsed as empty — every guard below would be vacuous');
  }
  return members;
}

const NEWS_CATEGORIES = canonicalCategories();

/** A JSX expression that prints a category value with nothing in between. */
const RAW_CATEGORY_RENDER = /\{\s*[A-Za-z_$][\w$]*\.category\s*\}/;

const LANGUAGES = ['en', 'pl'] as const;

/**
 * The M66.13C acceptance table, verbatim from the authorization. It lives here
 * rather than only in the dictionary spec because it is the milestone's
 * user-visible contract, not merely a dictionary shape.
 */
const REQUIRED_LABELS: Array<[string, string, string]> = [
  ['world', 'World', 'Świat'],
  ['politics', 'Politics', 'Polityka'],
  ['business', 'Business', 'Biznes'],
  ['technology', 'Technology', 'Technologia'],
  ['science', 'Science', 'Nauka'],
  ['health', 'Health', 'Zdrowie'],
  ['sports', 'Sports', 'Sport'],
  ['entertainment', 'Entertainment', 'Rozrywka'],
];

describe('M66.13C — application taxonomy follows the application locale', () => {
  it('THE CORE RULE — no live homepage component prints a raw category value', () => {
    const offenders = HOMEPAGE_COMPONENTS.filter((relative) =>
      RAW_CATEGORY_RENDER.test(stripComments(read(relative))),
    );
    expect(offenders).toEqual([]);
  });

  it('the hero live-feed panel resolves its label through the canonical mapping', () => {
    const code = stripComments(read('components/home/HeroLiveFeedPanel.tsx'));
    expect(code).toMatch(/const categoryLabels = getDictionary\(language\)\.map\.categories;/);
    expect(code).toMatch(/\{categoryLabels\[item\.category\] \?\? item\.category\}/);
  });

  it('reuses the ONE mapping — no component builds a second category vocabulary', () => {
    /*
      A second mapper is the failure mode this milestone was told to avoid. It
      would look like an object literal keyed by category names living inside a
      component. TrendingCard's CATEGORY_CHANNEL is keyed by category too, but
      its values are RGB COLOUR CHANNELS ('96,165,250'), not labels. It is a
      presentation table, not a translation.

      So the exception is drawn on the VALUE, not on the file name: a
      category-keyed entry is a second vocabulary when its value contains a
      letter. A new colour table stays legal; a new LABEL table does not,
      wherever it is written and whatever it is called.
    */
    const LABEL_MAP =
      /\b(world|politics|business|technology|science|health|sports|entertainment)\s*:\s*'[^']*[A-Za-zÀ-ž][^']*'/;
    for (const relative of HOMEPAGE_COMPONENTS) {
      const code = stripComments(read(relative));
      expect({ relative, hasOwnLabelMap: LABEL_MAP.test(code) }).toEqual({
        relative,
        hasOwnLabelMap: false,
      });
    }
  });

  it('every canonical category renders a real label in BOTH languages — the fallback stays unreachable', () => {
    for (const language of LANGUAGES) {
      const labels = getDictionary(language).map.categories;
      for (const category of NEWS_CATEGORIES) {
        // Exactly the expression the panel evaluates.
        const rendered = labels[category] ?? category;
        // Two ways this can be wrong: the token leaks through, or the label
        // is present but empty — which renders a blank chip, not a category.
        expect({ language, category, leaked: rendered === category, blank: rendered.trim() === '' }).toEqual({
          language,
          category,
          leaked: false,
          blank: false,
        });
      }
    }
  });

  it('matches the M66.13C acceptance table exactly, in both languages', () => {
    const en = getDictionary('en').map.categories;
    const pl = getDictionary('pl').map.categories;
    for (const [category, english, polish] of REQUIRED_LABELS) {
      expect({ category, value: en[category] }).toEqual({ category, value: english });
      expect({ category, value: pl[category] }).toEqual({ category, value: polish });
    }
  });

  it('the acceptance table is the WHOLE canonical set, so it cannot silently cover less', () => {
    expect(REQUIRED_LABELS.map(([category]) => category).sort()).toEqual(
      [...NEWS_CATEGORIES].sort(),
    );
  });
});

describe('M66.13C — article and provider content keeps its supplied language', () => {
  it('the hero panel renders the provider headline verbatim', () => {
    const code = stripComments(read('components/home/HeroLiveFeedPanel.tsx'));
    expect(code).toMatch(/\{item\.title\}/);
    // No mapping, no lookup, no helper between the article and the DOM.
    expect(code).not.toMatch(/\{[A-Za-z_$][\w$]*\[item\.title\]/);
  });

  it('no live homepage component looks an article headline up in a dictionary', () => {
    for (const relative of HOMEPAGE_COMPONENTS) {
      const code = stripComments(read(relative));
      expect({ relative, translatesTitle: /\[(?:item|article|story|lead)\.title\]/.test(code) }).toEqual({
        relative,
        translatesTitle: false,
      });
    }
  });
});
