import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  humanitarianRetainedRead,
  type HumanitarianRetainedRecord,
  type MyIntelligenceHumanitarianNewSince,
} from '@globalnews-ai/shared';
import { HomeHumanitarian } from '@/components/home/reva/HomeHumanitarian';
import { MiHumanitarianNewSince } from '@/components/my-intelligence/MiHumanitarianNewSince';
import { humanitarianEn } from '@/lib/i18n/dictionaries/humanitarianEn';
import { humanitarianPl } from '@/lib/i18n/dictionaries/humanitarianPl';
import { humanitarianHomeProjection, type HumanitarianReaderRuling } from './humHomeProjection';

/**
 * CROSS-SURFACE PROOF (frontend half). The SAME fixture the backend half retains into the one
 * corpus (qualification/humanitarian/cross-surface/records.json):
 *   reader read → G gate (E1 ruling as published) → H brief → Home
 *   delta items (as the server decides them, keyed by the same observations) → My Intelligence
 * Neither renders a model output, a current-provider claim, a zero for a missing figure, or
 * anything withheld.
 */
const ROOT = join(__dirname, '../../../..');
const FIXTURE = JSON.parse(
  readFileSync(join(ROOT, 'qualification/humanitarian/cross-surface/records.json'), 'utf8'),
) as { firstSeenAt: string; records: HumanitarianRetainedRecord[] };
const RULING_SRC = readFileSync(
  join(ROOT, 'backend/src/modules/humanitarian/reader-clearance.ruling.ts'),
  'utf8',
);
const E1_REQUIRED = [
  ...RULING_SRC.match(
    /HUMANITARIAN_REQUIRED_DISCLOSURES[^=]*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/,
  )![1]!
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/'([A-Z_]+)'/g),
].map((m) => m[1]!);
const CLEARED: HumanitarianReaderRuling = {
  requiredDisclosures: E1_REQUIRED,
  readerClearedSourceIds: ['GDACS', 'RELIEFWEB'],
  relayAttributionVerbatim: RULING_SRC.match(/GDACS_ATTRIBUTION_VERBATIM =\s*'([^']+)'/)![1]!,
  relayAttributedSourceIds: ['GDACS'],
};
const KEYS = FIXTURE.records.map((r) => r.observation.observationKey).sort();

/** The My Intelligence role exactly as the backend half asserts the server produces it. */
const MI: MyIntelligenceHumanitarianNewSince = {
  gapPossible: false,
  items: FIXTURE.records.map((r) => {
    const c = r.observation.claim;
    return {
      observationKey: r.observation.observationKey,
      change: 'NEW' as const,
      firstSeenAt: FIXTURE.firstSeenAt,
      countryIso3: ['SDN'],
      title: c.claimType === 'HUMANITARIAN_IMPACT_ASSERTION' ? null : (c.sourceTitle ?? null),
      figure:
        c.claimType === 'HUMANITARIAN_IMPACT_ASSERTION'
          ? { measure: c.measure, value: c.value, unit: 'PERSONS', basis: c.basis }
          : null,
      publisher: r.observation.provenance.institution ?? r.observation.identity.upstreamAuthority,
      publisherStatedAt: r.observation.temporal.publisherVintage ?? null,
      sourceUrl: r.observation.sourceReference.sourceUrl ?? null,
    };
  }),
};

describe('cross-surface (frontend) — the same retained observations on Home and My Intelligence', () => {
  const read = humanitarianRetainedRead(FIXTURE.records, () => true);
  const home = humanitarianHomeProjection(read, CLEARED, FIXTURE.firstSeenAt)!;

  it('Home: H’s brief is projected over exactly the fixture’s observations, once', () => {
    expect(home).not.toBeNull();
    expect(home.brief.records.map((r) => r.observationKey).sort()).toEqual(KEYS);
    expect(home.recordCount).toBe(KEYS.length);
  });
  it('My Intelligence: the delta items are the same observations', () => {
    expect(MI.items.map((i) => i.observationKey).sort()).toEqual(KEYS);
  });
  it('the stated figure is identical on both surfaces and never re-expressed', () => {
    expect(home.brief.figures.map((f) => f.value)).toEqual([1200]);
    expect(MI.items.find((i) => i.figure !== null)!.figure!.value).toBe(1200);
    const homeHtml = renderToStaticMarkup(
      createElement(HomeHumanitarian, { projection: home, language: 'en' }),
    );
    const miHtml = renderToStaticMarkup(
      createElement(MiHumanitarianNewSince, { data: MI, language: 'en' }),
    );
    expect(homeHtml).toContain('1200');
    expect(miHtml).toContain('1200');
    expect(homeHtml + miHtml).not.toMatch(/1,200|1\.2k|1 200/);
  });
  it.each(['en', 'pl'] as const)('both surfaces say retained, not current (%s)', (language) => {
    const s = language === 'pl' ? humanitarianPl : humanitarianEn;
    const said = s.readerDisclosure.RETAINED_NOT_CURRENT!.replace(/'/g, '&#x27;');
    expect(
      renderToStaticMarkup(createElement(HomeHumanitarian, { projection: home, language })),
    ).toContain(said);
    expect(
      renderToStaticMarkup(createElement(MiHumanitarianNewSince, { data: MI, language })),
    ).toContain(said);
  });
  it('missing impact is never zero: the event’s row carries no number on either surface', () => {
    const miHtml = renderToStaticMarkup(
      createElement(MiHumanitarianNewSince, { data: MI, language: 'en' }),
    );
    const eventRow = miHtml.split('<li').find((li) => li.includes('Flood in the lower basin'))!;
    expect(eventRow).not.toMatch(/>\s*0\s*</);
    expect(home.brief.figures.every((f) => f.value !== 0)).toBe(true);
  });
  it('My Intelligence renders nothing with nothing to say, and always states a possible gap', () => {
    expect(
      renderToStaticMarkup(createElement(MiHumanitarianNewSince, { data: null, language: 'en' })),
    ).toBe('');
    expect(
      renderToStaticMarkup(
        createElement(MiHumanitarianNewSince, {
          data: { items: [], gapPossible: false },
          language: 'en',
        }),
      ),
    ).toBe('');
    const gapOnly = renderToStaticMarkup(
      createElement(MiHumanitarianNewSince, {
        data: { items: [], gapPossible: true },
        language: 'pl',
      }),
    );
    expect(gapOnly).toContain('data-mi-humanitarian-gap');
  });
  it('REVISED is labelled as the source’s revision, never as new', () => {
    const revised = { ...MI, items: [{ ...MI.items[0]!, change: 'REVISED' as const }] };
    const html = renderToStaticMarkup(
      createElement(MiHumanitarianNewSince, { data: revised, language: 'en' }),
    );
    expect(html).toContain(humanitarianEn.myIntelligence.changeRevised);
    expect(html).not.toContain(humanitarianEn.myIntelligence.changeNew);
  });
  it('no surface component fetches, awaits or calls a model', () => {
    for (const f of [
      'frontend/src/components/my-intelligence/MiHumanitarianNewSince.tsx',
      'frontend/src/components/home/reva/HomeHumanitarian.tsx',
      'frontend/src/lib/humanitarian/humHomeProjection.ts',
    ]) {
      const code = readFileSync(join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect({
        f,
        hit: /fetch\(|async\s|await\s|openai|anthropic|\/api\/ask|useEffect/i.test(code),
      }).toEqual({ f, hit: false });
    }
  });
});
