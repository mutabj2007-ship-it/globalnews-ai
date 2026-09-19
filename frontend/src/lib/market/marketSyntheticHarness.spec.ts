/**
 * SYNTHETIC-CONTRACT HARNESS — NOT A FIXTURE ROUTE, AND NEVER RENDERED BY ONE.
 *
 * The activation requires a populated state to be inspected and, in the same breath,
 * forbids presenting synthetic state as live evidence and forbids fixture prices on the
 * surface. Both hold here: these values exist only inside this spec, no route can reach
 * them, and the page it writes carries a banner saying so on its own first line.
 *
 * It exists because the populated composition must be inspectable BEFORE a producer
 * lands. A design nobody has looked at is a design that gets discovered during activation.
 *
 * WHY `.spec.ts` AND `createElement` RATHER THAN `.spec.tsx`. This project's `testMatch`
 * is `src/**\/*.spec.ts`. A `.spec.tsx` file is SILENTLY NOT COLLECTED — the trap the
 * Humanitarian lane already recorded — so a harness written as `.tsx` would look like it
 * was guarding the populated state while never running. The JSX is given up; the
 * collection is not.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';

import { MarketScreen } from '@/components/market/MarketScreen';
import { MarketCompactScreen } from '@/components/market/MarketCompactScreen';
import type { MarketReadResult } from '@/lib/market/mktReadModel';

const OUT = process.env.MKT_HARNESS_OUT ?? '';

/* SYNTHETIC. These values exist only here. No route can reach them. */
const read: MarketReadResult = {
  kind: 'OBSERVATIONS',
  observations: [
    { observationKey: 'eco:1:6:s-synth-a:m14:2026-08', seriesId: 'SYNTH-SERIES-A',
      periodId: '2026-08', value: 3.21, unit: 'PC', publisherVintage: '2026-09-15',
      publisherChangedAt: null, vintageProvenance: 'PUBLISHER_VINTAGE',
      releaseStatus: 'FINAL', provider: 'EUROSTAT', sourceClass: 'OFFICIAL_STATISTIC',
      retentionIsFinal: false },
    { observationKey: 'eco:1:6:s-synth-b:m14:2026-09', seriesId: 'SYNTH-SERIES-B',
      periodId: '2026-09', value: 118400, unit: 'QUANTITY_IN_100KG',
      publisherVintage: null, publisherChangedAt: '2026-09-17T23:00:00.000Z',
      vintageProvenance: 'PUBLISHER_CHANGED_AT', releaseStatus: 'PRELIMINARY',
      provider: 'TED', sourceClass: 'PROCUREMENT_OFFICIAL', retentionIsFinal: false },
    { observationKey: 'eco:1:6:s-synth-c:m14:2026-07', seriesId: 'SYNTH-SERIES-C',
      periodId: '2026-07', value: 0.04, unit: 'RATIO', publisherVintage: null,
      publisherChangedAt: null, vintageProvenance: 'INGEST_SNAPSHOT',
      releaseStatus: 'REVISED', provider: 'EUROSTAT', sourceClass: 'OFFICIAL_STATISTIC',
      retentionIsFinal: false },
  ],
};

const desktop = (): string =>
  renderToStaticMarkup(createElement(MarketScreen, { locale: 'en', read }));
const compact = (): string =>
  renderToStaticMarkup(createElement(MarketCompactScreen, { locale: 'en', read }));

describe('the populated composition renders from the contract alone', () => {
  it('every required reader fact reaches the markup', () => {
    const html = desktop();
    /* metric identity, value, unit, period */
    expect(html).toContain('SYNTH-SERIES-A');
    expect(html).toContain('3.21');
    expect(html).toContain('QUANTITY_IN_100KG');
    expect(html).toContain('2026-08');
    /* the vintage, and which of the three timestamps it is */
    expect(html).toContain('2026-09-15');
    expect(html).toContain('Published by the source');
    expect(html).toContain('Source recorded a change');
    expect(html).toContain('No vintage published');
    /* freshness, derived — and LIVE unreachable even with a populated set */
    expect(html).toContain('data-mkt-freshness="LATEST_PUBLISHED"');
    expect(html).toContain('data-mkt-freshness="STALE"');
    expect(html).not.toContain('data-mkt-freshness="LIVE"');
    /* provenance on every card */
    expect(html).toContain('EUROSTAT');
    expect(html).toContain('PROCUREMENT_OFFICIAL');
    expect(html.match(/Not a settled figure/g)?.length).toBe(3);
    /* the value is printed as published — 118400, never 118,400 */
    expect(html).toContain('118400');
    expect(html).not.toContain('118,400');
  });

  it('the compact composition carries the same facts at 390', () => {
    const html = compact();
    for (const fact of ['SYNTH-SERIES-A', '3.21', 'QUANTITY_IN_100KG', '2026-08',
      'EUROSTAT', 'data-mkt-freshness=']) {
      expect(html).toContain(fact);
    }
  });

  it('writes the inspectable pages when the harness output path is set', () => {
    if (OUT === '') { expect(OUT).toBe(''); return; }
    if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
    const cssDir = '.next/static/css';
    const css = existsSync(cssDir)
      ? readdirSync(cssDir).filter((f) => f.endsWith('.css'))
        .map((f) => `<link rel="stylesheet" href="/_next/static/css/${f}">`).join('\n')
      : '';
    const banner = '<div style="background:#3a2a00;color:#ffd479;font:600 13px/1.5 system-ui;'
      + 'padding:10px 16px;letter-spacing:.04em">SYNTHETIC CONTRACT TEST STATE \u2014 NOT LIVE '
      + 'DATA. No route renders these values.</div>';
    const page = (markup: string, w: number): string =>
      '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      + `<meta name="viewport" content="width=${w}">${css}</head>`
      + `<body style="margin:0;background:#04060c">${banner}${markup}</body></html>`;
    writeFileSync(`${OUT}/synthetic-desktop.html`, page(desktop(), 1512));
    writeFileSync(`${OUT}/synthetic-compact.html`, page(compact(), 390));
    expect(existsSync(`${OUT}/synthetic-desktop.html`)).toBe(true);
  });
});
