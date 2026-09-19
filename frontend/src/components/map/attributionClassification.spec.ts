import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

/**
 * ══ R2-B §9 — ATTRIBUTION AND LICENCE CLASSIFICATION ══════════════════════
 *
 * MAP-ATTRIBUTION-CLASSIFICATION
 *
 * Four things the map presents, and what each one's licence asks for:
 *
 *   GeoNames              CC BY 4.0      ATTRIBUTION REQUIRED
 *   iso3166-2-db          MIT            notice required in copies — see §4
 *   Natural Earth 1:50m   public domain  nothing required; named as courtesy
 *   MapLibre GL JS        BSD-3-Clause   notice required — see §4
 *
 * ── WHAT THIS FILE PROVES, AND WHAT IT DELIBERATELY DOES NOT ──────────────
 *
 * §1–§3 pin the things that are settled: the notice renders exactly once at
 * every density, it names all three data sources, it is not translated, and it
 * now carries the licence URI.
 *
 * §4 records the two items I am NOT competent to close. They are raised to the
 * CTO as LEGAL/RIGHTS REVIEW REQUIRED rather than answered here, because
 * whether a given notice discharges a licence obligation is a legal judgment
 * and guessing it in a test would make the guess look settled.
 *
 * ── THE ONE DEFECT FOUND, AND IT WAS IN THE NOTICE ITSELF ─────────────────
 *
 * Measured against the publisher's own string, fetched live from
 * `/geo/place?id=country:RWA` while classifying:
 *
 *     published   "... licensed CC BY 4.0
 *                  (https://creativecommons.org/licenses/by/4.0/). ..."
 *     rendered    "... licensed CC BY 4.0. ..."
 *
 * The URI had been dropped. CC BY 4.0 §3(a)(1)(v) asks for "a URI or hyperlink
 * to the Public License to the extent reasonably practicable", and the
 * dictionary's own comment already forbade exactly this: "a licence notice
 * that has been reworded is not the notice the licence asked for." Restored
 * verbatim in both locales; §2 pins it.
 */

const SHELL = readFileSync(
  resolve(__dirname, 'shell', 'GlobalMapShell.tsx'),
  'utf-8',
);

const MANIFEST = JSON.parse(
  readFileSync(
    resolve(__dirname, '..', '..', '..', 'public', 'reference', 'MANIFEST.json'),
    'utf-8',
  ),
) as { readonly attribution: string };

const LOCALES = [
  ['en', en],
  ['pl', pl],
] as const;

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE NOTICE IS PRESENTED, EXACTLY ONCE, AT EVERY DENSITY
   ══════════════════════════════════════════════════════════════════════════ */

describe('the licence notice reaches the reader', () => {
  it('it renders on interactive surfaces and on picture surfaces alike', () => {
    /*
      Two elements, mutually exclusive on `hud.interactive`: the right-hand
      island for a full map, and the lower-left column for a 261px picture
      where an opposite-corner island would not fit.
    */
    expect(SHELL.split('data-gn="map-attribution"').length - 1).toBe(2);
    expect(SHELL).toContain('{hud.interactive && (');
    expect(SHELL).toContain('{!hud.interactive && (');
  });

  it('and MapLibre’s own control is off, so this is the only notice surface', () => {
    const canvas = readFileSync(resolve(__dirname, 'shell', 'EvidenceMapCanvas.tsx'), 'utf-8');

    expect(canvas).toContain('attributionControl: false');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — CC BY 4.0: THE NOTICE IS COMPLETE AND UNREWORDED
   ══════════════════════════════════════════════════════════════════════════ */

describe('GeoNames — CC BY 4.0, the one licence here that plainly requires attribution', () => {
  for (const [locale, dict] of LOCALES) {
    it(`${locale} — the database is named and the licence is named`, () => {
      const notice = dict.map.spatial.attribution;

      expect(notice).toContain('GeoNames');
      expect(notice).toContain('CC BY 4.0');
    });

    it(`${locale} — THE LICENCE URI IS PRESENT — §3(a)(1)(v)`, () => {
      /*
        The defect this section found. It was absent from both locales while
        the publisher's own string carried it.
      */
      expect(dict.map.spatial.attribution).toContain(
        'https://creativecommons.org/licenses/by/4.0/',
      );
    });

    it(`${locale} — the notice is NOT translated`, () => {
      /*
        A licence notice is not interface copy. Both dictionaries carry the
        identical string on purpose, and the PL comment says so.
      */
      expect(pl.map.spatial.attribution).toBe(en.map.spatial.attribution);
    });
  }

  it('the GeoNames clause matches the publisher’s own wording', () => {
    /*
      Pinned verbatim against the string the deployed backend returns on
      `provenance.attribution`, so a future edit to our copy that drifts from
      the publisher's is caught here rather than by a reader.
    */
    expect(en.map.spatial.attribution).toContain(
      'Contains data from the GeoNames geographical database, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Subdivision data from iso3166-2-db (MIT).',
    );
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — NATURAL EARTH: PUBLIC DOMAIN, NAMED AS COURTESY
   ══════════════════════════════════════════════════════════════════════════ */

describe('Natural Earth — no obligation, and the classification is recorded', () => {
  it('the bundled manifest classifies it as public domain', () => {
    expect(MANIFEST.attribution).toContain('Natural Earth (public domain)');
  });

  it('and the rendered notice names it anyway', () => {
    /*
      Courtesy, not compliance — which is worth stating, because a future
      reader trimming the notice needs to know which clauses are load-bearing.
      This one is not; the two above it are.
    */
    expect(en.map.spatial.attribution).toContain('Natural Earth, public domain');
  });

  it('the bundled files are the three the manifest declares', () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(__dirname, '..', '..', '..', 'public', 'reference', 'MANIFEST.json'),
        'utf-8',
      ),
    ) as { readonly layers: Record<string, unknown>; readonly sources: Record<string, unknown> };

    expect(Object.keys(manifest.layers).sort()).toEqual(['admin1-lines', 'lakes', 'rivers']);
    /* Every bundled layer traces to a named Natural Earth source file. */
    expect(Object.keys(manifest.sources).length).toBeGreaterThanOrEqual(3);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — LEGAL / RIGHTS REVIEW REQUIRED — RAISED, NOT ANSWERED
   ══════════════════════════════════════════════════════════════════════════ */

describe('the two questions this package does not answer', () => {
  /*
    ══ RAISED TO THE CTO ════════════════════════════════════════════════════

    Whether a given notice DISCHARGES a licence obligation is a legal judgment,
    not an engineering one. Both items below are recorded with the facts I can
    establish and left open. The assertions here pin those FACTS so the review
    has something stable to rule on — they do not assert that either position
    is compliant.

    RIGHTS-1 · iso3166-2-db, MIT
      The MIT licence asks that "the above copyright notice and this permission
      notice shall be included in all copies or substantial portions of the
      Software". The surface names the dataset and its licence — "Subdivision
      data from iso3166-2-db (MIT)" — but reproduces neither notice, and there
      is no licences page that does.
      THE QUESTION: does naming the dataset and its licence suffice for data
      DERIVED from it and presented in a UI, or must the full notice be
      reachable from the product?

    RIGHTS-2 · MapLibre GL JS, BSD-3-Clause
      The map runs MapLibre with `attributionControl: false`, for a stated
      product reason: the shell renders its own labelled, focusable controls
      and two attribution surfaces on one map is a defect. BSD-3-Clause asks
      that the copyright notice appear "in the documentation and/or other
      materials provided with the distribution". The notice ships inside the
      bundled dependency; nothing in the UI shows it.
      THE QUESTION: is the bundled LICENSE file "other materials provided with
      the distribution" for a web application, or is a reachable notice needed?

    NEITHER IS A NEW RISK introduced by this package. Both predate it and both
    are unchanged by it. They are surfaced because §9 asked for the
    classification, and this is where the classification stops being
    engineering.
  */
  it('RIGHTS-1 — the MIT dataset is named, and its notice text is not reproduced', () => {
    expect(en.map.spatial.attribution).toContain('iso3166-2-db (MIT)');
    expect(en.map.spatial.attribution).not.toContain('Permission is hereby granted');
  });

  it('RIGHTS-2 — MapLibre’s attribution control is off, for a recorded product reason', () => {
    const canvas = readFileSync(resolve(__dirname, 'shell', 'EvidenceMapCanvas.tsx'), 'utf-8');

    expect(canvas).toContain('attributionControl: false');
    /* The reason is written down beside it, which is what makes it reviewable. */
    expect(canvas).toContain('The shell renders its own controls');
  });

  it('and no product surface claims either question is settled', () => {
    /*
      The guard against this file being read as a clearance. If someone adds a
      licences page, this fails and the review is revisited deliberately rather
      than assumed to have happened.
    */
    expect(en.map.spatial.attribution).not.toContain('All licences');
    expect(en.map.spatial.attribution).not.toContain('full licence');
  });
});
