import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { declaredRegionSelection } from '@/lib/map/region/regionSelection';
import { GOVERNED_EAST_AFRICA_ID } from '@/lib/map/navigation/breadcrumbs';
import { RegionIdentityCard } from '@/components/map/shell/RegionIdentityCard';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';
import type { RegionSelection } from '@/lib/map/region/regionSelection';

/**
 * ══ R2-B §7 — A DECLARATION IS NOT A PUBLISHED DEFINITION ═════════════════
 *
 * MAP-GOVERNED-REGION-COPY-CLASSIFICATION
 *
 * One row carried two different kinds of claim under one heading:
 *
 *     STATISTICAL   "UN Statistics Division … (M49)"        an outside standard
 *     GOVERNED      "GlobalNews AI Alpha regional coverage   this product's own
 *                    baseline (alpha-1)"                     declaration
 *
 * Labelled "Definition", the second borrows the authority of the first. A
 * reader has no way to tell that the body which defined East Africa here is
 * the product they are reading. The type line above the row already classifies
 * it correctly — "Product coverage region · membership declared by GlobalNews
 * AI for this deployment" — and this makes the row beneath it agree.
 *
 * ── AND A SECOND LINE WAS SAYING SOMETHING FALSE ──────────────────────────
 *
 * "No definition is asserted" is RSC-1.1's way of saying NO ONE OF THE
 * PUBLISHED ALTERNATIVES HAS BEEN SELECTED. That needs alternatives to be
 * true, and G-REG-3 supplies them only for supranational regions an outside
 * authority admitted.
 *
 * A governed region carries an explicit declared member list and has nothing
 * to choose between. An ADMINISTRATIVE one is a single ISO 3166-2 subdivision
 * — there is no second reading of what Kigali Province is. Printing the line
 * for either told the reader something was missing when nothing was.
 */

const LOCALES = [
  ['en', en],
  ['pl', pl],
] as const;

const card = (region: RegionSelection | null, dict: typeof en): string =>
  renderToStaticMarkup(
    createElement(RegionIdentityCard, {
      region,
      geographyId: region?.geographyId ?? GOVERNED_EAST_AFRICA_ID,
      labels: dict.map.spatial.region,
    }),
  );

const governed = (): RegionSelection => {
  const region = declaredRegionSelection(GOVERNED_EAST_AFRICA_ID, null);

  if (region === null) throw new Error('East Africa is no longer a declared product region');

  return region;
};

/** A published statistical region, as G serves it. The control for every row. */
const published = (): RegionSelection => ({
  geographyId: 'region:eastern-africa',
  name: 'Eastern Africa',
  regionType: 'STATISTICAL',
  scale: 'SUPRANATIONAL',
  withinCountryIso3: null,
  definition: 'UN Statistics Division, Standard Country or Area Codes for Statistical Use (M49)',
  extent: [22.67926, -25.96553, 63.41667, 15.77792],
  memberCount: 18,
  definitionId: null,
});

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE BASIS ROW SAYS WHICH KIND OF CLAIM IT IS MAKING
   ══════════════════════════════════════════════════════════════════════════ */

describe('a product-governed region is labelled as declared, not as defined', () => {
  for (const [locale, dict] of LOCALES) {
    it(`${locale} — the governed card heads the row "declared by"`, () => {
      const html = card(governed(), dict);

      expect(html).toContain(dict.map.spatial.region.declaredByHeading);
      expect(html).not.toContain(dict.map.spatial.region.definitionHeading);
    });

    it(`${locale} — POSITIVE CONTROL: a published region still heads it "definition"`, () => {
      /*
        Without this the change could have relabelled every region and passed.
        An outside standard IS a definition, and that row is unchanged.
      */
      const html = card(published(), dict);

      expect(html).toContain(dict.map.spatial.region.definitionHeading);
      expect(html).not.toContain(dict.map.spatial.region.declaredByHeading);
    });

    it(`${locale} — the type line already classified it, and still does`, () => {
      const html = card(governed(), dict);

      expect(html).toContain('data-gn-region-type="GOVERNED"');
      expect(html).toContain(dict.map.spatial.region.types.GOVERNED);
    });
  }

  it('the declared basis is named exactly, version included', () => {
    /*
      Pinned because the ruling names this string. The version is what makes a
      change to the baseline visible as a change rather than as a silent edit.
    */
    expect(governed().definition).toBe(
      'GlobalNews AI Alpha regional coverage baseline (alpha-1)',
    );
    expect(card(governed(), en)).toContain(
      'GlobalNews AI Alpha regional coverage baseline (alpha-1)',
    );
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — "NO DEFINITION IS ASSERTED" ONLY WHERE THERE IS SOMETHING TO CHOOSE
   ══════════════════════════════════════════════════════════════════════════ */

describe('an absence is only stated where it is real', () => {
  for (const [locale, dict] of LOCALES) {
    it(`${locale} — a governed region does not claim a missing definition`, () => {
      const html = card(governed(), dict);

      expect(html).not.toContain('data-gn="region-definition-absent"');
      expect(html).not.toContain(dict.map.spatial.region.noDefinitionSelected);
    });

    it(`${locale} — nor does an ISO 3166-2 subdivision`, () => {
      const kigali: RegionSelection = {
        geographyId: 'admin1:RW-01',
        name: 'Kigali',
        regionType: 'ADMINISTRATIVE',
        scale: 'SUBNATIONAL',
        withinCountryIso3: 'RWA',
        definition: 'iso3166-2-db@2.3.11',
        extent: [30.05885, -1.94995, 30.1697, -1.9495],
        memberCount: null,
        definitionId: null,
      };

      expect(card(kigali, dict)).not.toContain('data-gn="region-definition-absent"');
    });

    it(`${locale} — POSITIVE CONTROL: a published region still states it`, () => {
      /*
        RSC-1.1's rule is untouched where it applies. G-REG-3 will land
        attributed definitions for regions like this one, and until a reader
        chooses among them the absence is real and is stated.
      */
      expect(card(published(), dict)).toContain('data-gn="region-definition-absent"');
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — THE COPY EXISTS IN BOTH LANGUAGES AND IS TRANSLATED
   ══════════════════════════════════════════════════════════════════════════ */

describe('the new heading is real copy in both languages', () => {
  it('EN and PL still carry exactly the same region keys', () => {
    expect(Object.keys(pl.map.spatial.region).sort()).toEqual(
      Object.keys(en.map.spatial.region).sort(),
    );
  });

  it('and the Polish is Polish, not an English string copied across', () => {
    /*
      NOT A DIACRITIC TEST, deliberately. A first draft asserted the Polish
      contained one of ąćęłńóśźż and failed against "Zadeklarowane przez" —
      which is correct Polish that happens to use none. The heuristic is sound
      for a sentence and useless for a two-word heading.

      What is actually checked is the failure this guards against: a new key
      added to `pl` with an English value in it. So the Polish heading must
      differ from its own English counterpart AND must not be any other English
      string from the same block, which catches a wrong paste as well as a
      missing translation.
    */
    const polish = pl.map.spatial.region.declaredByHeading;
    const english = Object.values(en.map.spatial.region).filter(
      (value): value is string => typeof value === 'string',
    );

    expect(polish).not.toBe(en.map.spatial.region.declaredByHeading);
    expect(english).not.toContain(polish);
  });

  it('the two headings are distinct, which is the entire point', () => {
    for (const [, dict] of LOCALES) {
      expect(dict.map.spatial.region.declaredByHeading).not.toBe(
        dict.map.spatial.region.definitionHeading,
      );
    }
  });
});
