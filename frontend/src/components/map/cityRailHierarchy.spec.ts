import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CityIdentityCard } from '@/components/map/shell/CityIdentityCard';
import type { CitySelection } from '@/lib/map/geography/semanticGeography';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

/**
 * ══ R2-B §2 — THE CITY RAIL STATES A HIERARCHY ════════════════════════════
 *
 * MAP-CITY-RAIL-HIERARCHY
 *
 * The card already held the right two facts apart. What it did not do was make
 * their RANK legible, and it spent its most eye-catching element on the one
 * thing a reader can do nothing with.
 *
 *     WAS                                   IS
 *     City                                  City
 *     Kigali                                Kigali
 *     Evidence geography                    Evidence geography
 *     Rwanda                                Rwanda · Country
 *     This is the country the…              This is the country the…
 *     city:RWA:kigali@30.06,-1.95           (attribute only)
 *
 * TWO CORRECTIONS, AND THEY ARE THE ONES THE RULING NAMES.
 *
 *   THE RAW ID IS NOT READER-FACING COPY. A long monospace identifier in a
 *   small card outweighed both place names, and no reader can act on it. It
 *   moves to `data-gn-geography-id`, the same demotion the region card takes.
 *   The UNRESOLVED state still renders it, because there it is the only true
 *   thing available — §4 pins that it survived.
 *
 *   THE SECONDARY VALUE CARRIES ITS PRECISION. \"Kigali\" sits under a kicker
 *   that already says City. \"Rwanda\" sat under a kicker that says Evidence
 *   geography — a RELATIONSHIP, not a precision — so two place names appeared
 *   at near-equal standing with nothing on the surface saying one was a city
 *   and the other a country. That is the single impression this component was
 *   built to prevent.
 *
 * ── WHY THE TOKEN IS NOT NEW COPY ─────────────────────────────────────────
 *
 * It is `map.spatial.search.kinds.COUNTRY`, the string the search dropdown
 * already badges a country row with. §3 asserts the identity rather than the
 * text, so the two surfaces cannot drift into calling one precision by two
 * names on one screen.
 */

const LOCALES = [
  ['en', en],
  ['pl', pl],
] as const;

const KIGALI: CitySelection = {
  geographyId: 'city:RWA:kigali@30.06,-1.95',
  name: 'Kigali',
  countryIso3: 'RWA',
  extent: null,
  provenance: 'GeoNames',
};

/** Reader-facing text only. Attributes are diagnostics and are excluded. */
const textOf = (html: string): string => html.replace(/<[^>]*>/g, ' ');

const card = (dict: typeof en, city: CitySelection | null, countryName?: string): string =>
  renderToStaticMarkup(
    createElement(CityIdentityCard, {
      city,
      geographyId: KIGALI.geographyId,
      countryName,
      /* Composed exactly as `GlobalMapShell` composes it. */
      labels: {
        ...dict.map.spatial.city,
        evidenceCeilingKindLabel: dict.map.spatial.search.kinds.COUNTRY,
      },
    }),
  );

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE RAW IDENTIFIER IS NO LONGER READER-FACING COPY
   ══════════════════════════════════════════════════════════════════════════ */

describe('the resolved city card does not spell its own identifier', () => {
  for (const [locale, dict] of LOCALES) {
    it(`${locale} — the id is an attribute, not text`, () => {
      const html = card(dict, KIGALI, 'Rwanda');

      expect(html).toContain('data-gn-geography-id="city:RWA:kigali@30.06,-1.95"');
      expect(textOf(html)).not.toContain('city:RWA:kigali');
    });

    it(`${locale} — POSITIVE CONTROL: the unresolved card still shows it`, () => {
      /*
        The demotion must not have made the honest failure state useless. With
        nothing resolved the identifier is all the product truthfully has, and
        a reader reporting the problem needs to be able to read it.
      */
      const html = card(dict, null);

      expect(html).toContain('data-gn-state="unresolved"');
      expect(textOf(html)).toContain('city:RWA:kigali@30.06,-1.95');
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — PRIMARY AND SECONDARY ARE DISTINGUISHABLE
   ══════════════════════════════════════════════════════════════════════════ */

describe('the two geographies are ranked, not merely both present', () => {
  for (const [locale, dict] of LOCALES) {
    it(`${locale} — the chosen place leads, and says what kind of place it is`, () => {
      const html = card(dict, KIGALI, 'Rwanda');

      expect(html).toContain('data-gn="city-name"');
      expect(textOf(html)).toContain('Kigali');
      /* The kicker above the name is the primary's own precision. */
      expect(html).toContain(dict.map.spatial.city.heading);
    });

    it(`${locale} — the evidence country follows it, carrying COUNTRY`, () => {
      const html = card(dict, KIGALI, 'Rwanda');

      expect(html).toContain('data-gn="city-evidence-geography"');
      expect(html).toContain('data-gn="city-evidence-kind"');
      expect(textOf(html)).toContain('Rwanda');
      expect(textOf(html)).toContain(dict.map.spatial.search.kinds.COUNTRY);
    });

    it(`${locale} — and it follows in document order, not merely in styling`, () => {
      const html = card(dict, KIGALI, 'Rwanda');

      expect(html.indexOf('data-gn="city-name"')).toBeLessThan(
        html.indexOf('data-gn="city-evidence-geography"'),
      );
    });

    it(`${locale} — the ceiling sentence is still stated in full beneath them`, () => {
      /*
        The token is a label, not a replacement for the explanation. A reader
        who does not know what \"Country\" means beside Rwanda still gets the
        sentence that says the figures are the country's and not the city's.
      */
      const html = card(dict, KIGALI, 'Rwanda');

      expect(html).toContain(dict.map.spatial.city.evidenceCeilingBody);
    });
  }

  it('the primary name is typographically heavier than the secondary one', () => {
    /*
      Asserted on the emitted classes because that is where this product's
      type scale lives. The point is the RELATIONSHIP between the two, so both
      are read out rather than either being pinned to a number in isolation.
    */
    const html = card(en, KIGALI, 'Rwanda');

    const name = html.slice(html.indexOf('data-gn="city-name"'));
    const country = html.slice(html.indexOf('data-gn="city-evidence-geography"'));

    expect(name).toContain('text-[15px]');
    expect(country).toContain('text-[13px]');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — ONE VOCABULARY, NOT TWO
   ══════════════════════════════════════════════════════════════════════════ */

describe('the precision token is the search vocabulary, not a second copy of it', () => {
  it('the rail badges a country with exactly the string the dropdown badges it with', () => {
    /*
      THE INVARIANT, ASSERTED AS IDENTITY RATHER THAN AS TEXT. If someone adds
      a `kindLabel` to `map.spatial.city` and the two drift, a reader meets the
      same precision under two names on one screen — and a text assertion
      would happily pass while that happened.
    */
    for (const [, dict] of LOCALES) {
      const html = card(dict, KIGALI, 'Rwanda');

      expect(textOf(html)).toContain(dict.map.spatial.search.kinds.COUNTRY);
    }
  });

  it('the token is genuinely localised — PL does not render the English word', () => {
    expect(pl.map.spatial.search.kinds.COUNTRY).toBe('Kraj');
    expect(textOf(card(pl, KIGALI, 'Rwanda'))).not.toContain('Country');
  });

  it('and no second country-kind string was introduced into the city block', () => {
    expect(Object.keys(en.map.spatial.city)).not.toContain('evidenceCeilingKindLabel');
    expect(Object.keys(pl.map.spatial.city)).not.toContain('evidenceCeilingKindLabel');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — THE HONEST STATES SURVIVED
   ══════════════════════════════════════════════════════════════════════════ */

describe('a place with no published country still says so, and claims nothing', () => {
  for (const [locale, dict] of LOCALES) {
    it(`${locale} — no country means no token and no invented ceiling`, () => {
      const nowhere: CitySelection = {
        geographyId: 'city:XXX:nowhere@0,0',
        name: 'Nowhere',
        countryIso3: null,
        extent: null,
        provenance: '',
      };

      const html = renderToStaticMarkup(
        createElement(CityIdentityCard, {
          city: nowhere,
          geographyId: nowhere.geographyId,
          labels: {
            ...dict.map.spatial.city,
            evidenceCeilingKindLabel: dict.map.spatial.search.kinds.COUNTRY,
          },
        }),
      );

      expect(html).toContain(dict.map.spatial.city.noCountryBody);
      expect(html).not.toContain('data-gn="city-evidence-kind"');
      expect(html).not.toContain('data-gn="city-evidence-geography"');
    });
  }
});
