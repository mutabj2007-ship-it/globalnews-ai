import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THIRD_PARTY_NOTICES } from '@/lib/legal/thirdPartyNotices.generated';
import { footerLinkGroups } from '@/lib/homeContent';
import { en } from '@/lib/i18n/dictionaries/en';
import { pl } from '@/lib/i18n/dictionaries/pl';

/**
 * ══ R2-B §9 — THIRD-PARTY NOTICES, AND THE PROOF THEY ARE EXACT ═══════════
 *
 * CTO rights ruling, 2026-09-19:
 *
 *   "provide an accessible Third-Party Notices surface using the EXACT
 *    upstream license texts from the installed package versions, not
 *    hand-written summaries ... Do not translate license texts. Product/UI
 *    headings around them may be localized; license bodies remain exact."
 *
 * ── WHY THIS FILE IS THE LOAD-BEARING HALF ────────────────────────────────
 *
 * The page renders COMMITTED text, from `thirdPartyNotices.generated.ts`, so
 * nothing reads `node_modules` at request time and there is nothing to fail in
 * a build sandbox. That committed text is only worth anything if something
 * proves it still matches what actually ships — so §1 re-reads the installed
 * licence files and compares byte for byte.
 *
 * The practical consequence: upgrade `maplibre-gl` to a version with a changed
 * notice and this suite goes red until the generator is re-run. A notices page
 * that silently describes last year's dependency is the failure mode this
 * exists to make impossible.
 */

const ROOT = resolve(__dirname, '..', '..', '..');

/* ══════════════════════════════════════════════════════════════════════════
   1 — THE TEXTS ARE VERBATIM FROM THE INSTALLED PACKAGES
   ══════════════════════════════════════════════════════════════════════════ */

describe('every notice matches the installed package, byte for byte', () => {
  it('there is at least one, and it is the bundled map engine', () => {
    /*
      Guards the vacuous pass. An empty array would satisfy every `for` loop
      below while shipping a page with no notices on it.
    */
    expect(THIRD_PARTY_NOTICES.length).toBeGreaterThan(0);
    expect(THIRD_PARTY_NOTICES.map((notice) => notice.id)).toContain('maplibre-gl');
  });

  for (const notice of THIRD_PARTY_NOTICES) {
    it(`${notice.id} — the licence file it names still exists`, () => {
      expect(existsSync(resolve(ROOT, notice.file))).toBe(true);
    });

    it(`${notice.id} — the committed text is identical to the installed one`, () => {
      /*
        Normalised to LF on both sides and nowhere else, so a CRLF checkout
        does not read as a difference. Nothing else is touched: no trimming,
        no collapsing, no re-wrapping.
      */
      const installed = readFileSync(resolve(ROOT, notice.file), 'utf-8').replace(/\r\n/g, '\n');

      expect(notice.text).toBe(installed);
    });

    it(`${notice.id} — the recorded hash matches the text`, () => {
      expect(createHash('sha256').update(notice.text, 'utf-8').digest('hex')).toBe(notice.sha256);
    });

    it(`${notice.id} — the version matches the installed package`, () => {
      const manifest = JSON.parse(
        readFileSync(resolve(ROOT, 'node_modules', notice.id, 'package.json'), 'utf-8'),
      ) as { readonly version: string };

      expect(notice.version).toBe(manifest.version);
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 — THE REQUIRED COVERAGE IS PRESENT
   ══════════════════════════════════════════════════════════════════════════ */

describe('the notices the ruling names are all reachable', () => {
  const maplibre = THIRD_PARTY_NOTICES.find((notice) => notice.id === 'maplibre-gl');

  it('maplibre-gl carries its full BSD-3-Clause notice, disclaimers included', () => {
    expect(maplibre?.license).toBe('BSD-3-Clause');
    expect(maplibre?.text).toContain('Copyright (c) 2023, MapLibre contributors');
    expect(maplibre?.text).toContain('Redistributions in binary form must reproduce');
    /* The disclaimer is the part a summary would drop. */
    expect(maplibre?.text).toContain('THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS');
    expect(maplibre?.text).toContain('EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE');
  });

  it('and the notices MapLibre is required to pass on travel with it', () => {
    /*
      "any directly implicated bundled map dependency already required by that
       upstream notice" — MapLibre's own LICENSE.txt embeds these three, so
      reproducing that one file verbatim discharges all of them without this
      product deciding which they are.
    */
    expect(maplibre?.text).toContain('Contains code from mapbox-gl-js v1.13 and earlier');
    expect(maplibre?.text).toContain('Copyright (c) 2020, Mapbox');
    expect(maplibre?.text).toContain('Contains code from glfx.js');
    expect(maplibre?.text).toContain('Copyright (C) 2011 by Evan Wallace');
    expect(maplibre?.text).toContain('Contains a portion of d3-color');
  });

  it('the MIT permission notice glfx.js requires is reproduced in full', () => {
    /*
      RIGHTS-1 asked whether naming a dataset discharges MIT. For the MIT
      component that is actually BUNDLED, the full permission notice now ships
      — including the sentence the licence names.
    */
    expect(maplibre?.text).toContain('Permission is hereby granted, free of charge');
    expect(maplibre?.text).toContain(
      'The above copyright notice and this permission notice shall be included in',
    );
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   3 — BODIES EXACT, HEADINGS LOCALISED
   ══════════════════════════════════════════════════════════════════════════ */

describe('the ruling’s translation boundary is respected', () => {
  const PAGE = readFileSync(resolve(__dirname, 'third-party-notices', 'page.tsx'), 'utf-8');

  it('the page renders the notice text straight from the generated module', () => {
    expect(PAGE).toContain('THIRD_PARTY_NOTICES');
    expect(PAGE).toContain('{notice.text}');
  });

  it('and no licence body passes through the dictionaries', () => {
    /*
      The failure this rules out: someone "localising" the page by copying a
      licence into `pl.ts`. The texts live in one generated module and the
      dictionaries hold only headings.
    */
    for (const dict of [en, pl]) {
      expect(JSON.stringify(dict)).not.toContain('THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT');
      expect(JSON.stringify(dict)).not.toContain('Permission is hereby granted');
    }
  });

  it('the headings ARE localised, which is the other half of the rule', () => {
    const keys = ['title', 'intro', 'softwareHeading', 'dataHeading', 'licenceLabel'] as const;

    for (const key of keys) {
      expect(pl.thirdPartyNoticesPage[key]).not.toBe(en.thirdPartyNoticesPage[key]);
    }
  });

  it('but the upstream ATTRIBUTION STRING is not translated — it is a notice', () => {
    /*
      Same rule as `map.spatial.attribution`, and for the same reason: this is
      the published notice, not interface copy.
    */
    expect(pl.thirdPartyNoticesPage.dataAttribution).toBe(
      en.thirdPartyNoticesPage.dataAttribution,
    );
  });

  it('the CC BY 4.0 URI is present here too, exactly as published', () => {
    for (const dict of [en, pl]) {
      expect(dict.thirdPartyNoticesPage.dataAttribution).toContain(
        'https://creativecommons.org/licenses/by/4.0/',
      );
    }

    /* And the map's own notice still agrees with it. */
    expect(en.map.spatial.attribution).toContain(
      'https://creativecommons.org/licenses/by/4.0/',
    );
  });

  it('the rendered bodies are marked as English and not machine-translatable', () => {
    /*
      A Polish reader's browser translator would otherwise rewrite a BSD
      disclaimer in place. `translate="no"` and `lang="en"` address the two
      systems that would change the text after it leaves this codebase.
    */
    expect(PAGE).toContain('translate="no"');
    expect(PAGE).toContain('lang="en"');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   4 — REACHABLE, WHICH WAS THE POINT
   ══════════════════════════════════════════════════════════════════════════ */

describe('a reader can get to it without opening node_modules', () => {
  it('the route exists on disk', () => {
    expect(existsSync(resolve(__dirname, 'third-party-notices', 'page.tsx'))).toBe(true);
  });

  it('the footer links to it, in the existing legal group', () => {
    const legal = footerLinkGroups.find((group) => group.title === 'Legal');

    expect(legal?.links.map((link) => link.href)).toContain('/third-party-notices');
  });

  it('the link is localised in both languages', () => {
    for (const dict of [en, pl]) {
      expect(dict.footer.linkLabels['/third-party-notices'].length).toBeGreaterThan(0);
    }

    expect(pl.footer.linkLabels['/third-party-notices']).not.toBe(
      en.footer.linkLabels['/third-party-notices'],
    );
  });

  it('NO NEW SETTINGS SYSTEM — it is a static server page', () => {
    /*
      Named in the ruling. The page has no client boundary, no state and no
      preference; it is the same architecture /privacy and /terms use.
    */
    /*
      COMMENTS STRIPPED FIRST. The page's own header explains that it has no
      'use client' and no state, so a raw substring search finds the
      explanation and reports it as the thing being explained — the same trap
      the Kigali and upper-left corrections both hit. Stripping makes this an
      assertion about code.
    */
    const code = readFileSync(resolve(__dirname, 'third-party-notices', 'page.tsx'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

    expect(code).not.toContain("'use client'");
    expect(code).not.toContain('useState');
    expect(code).not.toContain('localStorage');

    /* POSITIVE CONTROL — stripping did not simply empty the file. */
    expect(code).toContain('export default async function ThirdPartyNoticesPage');
  });

  it('and the map keeps its own concise attribution — nothing was moved off it', () => {
    /*
      "Preserve the concise Map attribution already rendered." The notices page
      is IN ADDITION to it, never instead of it.
    */
    const shell = readFileSync(
      resolve(__dirname, '..', 'components', 'map', 'shell', 'GlobalMapShell.tsx'),
      'utf-8',
    );

    expect(shell.split('data-gn="map-attribution"').length - 1).toBe(2);
  });

  it('and MapLibre’s built-in control was NOT re-enabled to satisfy this', () => {
    /*
      Explicitly ruled out: "Do not re-enable MapLibre's built-in attribution
      control merely to satisfy the software-license notice requirement."
    */
    const canvas = readFileSync(
      resolve(__dirname, '..', 'components', 'map', 'shell', 'EvidenceMapCanvas.tsx'),
      'utf-8',
    );

    expect(canvas).toContain('attributionControl: false');
  });
});
