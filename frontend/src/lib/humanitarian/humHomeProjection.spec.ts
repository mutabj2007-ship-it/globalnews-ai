import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  domainObservationKey,
  hazardFromSourceCode,
  humanitarianIdentity,
  humanitarianReadAbsence,
  humanitarianRetainedRead,
  impactAuthorship,
  type HumanitarianClaim,
  type HumanitarianObservation,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import { HomeHumanitarian } from '@/components/home/reva/HomeHumanitarian';
import { humanitarianEn } from '@/lib/i18n/dictionaries/humanitarianEn';
import { humanitarianPl } from '@/lib/i18n/dictionaries/humanitarianPl';
import {
  homeCarriableDisclosures,
  humanitarianHomeProjection,
  parseHumanitarianReaderRuling,
  type HumanitarianReaderRuling,
} from './humHomeProjection';

/**
 * HOME CONSUMER — one retained corpus → reader read → G gate (E1's ruling) → H brief → Home.
 * E1's constants are read from the BACKEND ruling source here, so this spec fails if the frontend
 * catalogue drifts from E1 rather than carrying a copy of E1's list.
 */
const ROOT = join(__dirname, '../../../..');
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
const VERBATIM = RULING_SRC.match(/GDACS_ATTRIBUTION_VERBATIM =\s*'([^']+)'/)![1]!;

const AT = '2026-10-02T00:00:00.000Z';
const PROTECTED = 'PROTECTED-CANARY-77e1';

function rec(authority: string, id: string, claim: HumanitarianClaim): HumanitarianRetainedRecord {
  const identity = humanitarianIdentity(authority, id);
  const observation: HumanitarianObservation = {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: claim.claimType,
    subjectType: 'SOURCE_EVENT',
    subjectId: id,
    claim,
    temporal: {
      publisherVintage: '2026-09-20T00:00:00',
      retrievedAt: '2026-09-21T00:00:00.000Z',
      temporalBasis: 'PUBLISHER_VINTAGE',
    },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: authority,
      institution: authority === 'GDACS' ? VERBATIM : 'ReliefWeb',
      retrievedAt: '2026-09-21T00:00:00.000Z',
    },
    sourceReference: {},
    attributeAuthorship:
      claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION'
        ? [...impactAuthorship(claim.basis)]
        : [{ attribute: 'sourceTitle', authorship: 'PUBLISHER_STATED' as const }],
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  };
  return {
    captureKey: `cap-${PROTECTED}-${id}`,
    publisherReleasedAt: '2026-09-20T00:00:00',
    observation,
  };
}
const gdacsEvent = (agency: string | null = 'GLOFAS') =>
  rec('GDACS', 'FL-1', {
    claimType: 'HUMANITARIAN_EVENT',
    hazardType: hazardFromSourceCode('GDACS', 'FL'),
    sourceNativeType: 'FL',
    sourceTitle: 'Flood',
    eventStatus: 'ONGOING',
    sourceSeverityStated: `Red ${PROTECTED}`,
    countryIso3: ['SDN'],
    ...(agency === null ? {} : { originatingAgency: agency }),
  } as HumanitarianClaim);
const reliefwebFigure = (value: number) =>
  rec('RELIEFWEB', 'RW-1', {
    claimType: 'HUMANITARIAN_IMPACT_ASSERTION',
    measure: 'PEOPLE_DISPLACED',
    value,
    unit: 'PERSONS',
    basis: 'SOURCE_STATED',
    sourceBasisStatement: 'The report states this figure.',
    aboutEventKey: domainObservationKey(humanitarianIdentity('GDACS', 'FL-1')),
    countryIso3: ['SDN'],
  } as HumanitarianClaim);

const read = (rows: HumanitarianRetainedRecord[]) => humanitarianRetainedRead(rows, () => true);
const REAL: HumanitarianReaderRuling = {
  requiredDisclosures: E1_REQUIRED,
  readerClearedSourceIds: [],
  relayAttributionVerbatim: VERBATIM,
  relayAttributedSourceIds: ['GDACS'],
};
const CLEARED: HumanitarianReaderRuling = {
  ...REAL,
  readerClearedSourceIds: ['GDACS', 'RELIEFWEB'],
};

describe('Home consumer — the catalogue carries every E1 code (no copy of E1’s list)', () => {
  it('E1’s required codes, read from the backend ruling, are all labelled in EN and PL', () => {
    expect(E1_REQUIRED).toHaveLength(6);
    expect(homeCarriableDisclosures(E1_REQUIRED)).toEqual(E1_REQUIRED);
    expect(Object.keys(humanitarianEn.readerDisclosure).sort()).toEqual([...E1_REQUIRED].sort());
    expect(Object.keys(humanitarianPl.readerDisclosure).sort()).toEqual([...E1_REQUIRED].sort());
  });
  it('the published ruling parses strictly; anything else is no ruling', () => {
    expect(parseHumanitarianReaderRuling(CLEARED)).toEqual(CLEARED);
    expect(
      parseHumanitarianReaderRuling({ ...CLEARED, relayAttributedSourceIds: undefined }),
    ).toBeNull();
    expect(parseHumanitarianReaderRuling(null)).toBeNull();
  });
});

describe('Home consumer — renders nothing unless an admitted bounded projection exists', () => {
  it.each([
    ['NOT_ASSESSED (no approved reader)', humanitarianReadAbsence('NOT_ASSESSED')],
    ['COVERAGE_GAP', humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE')],
    ['NO_RETAINED_EVIDENCE (a store state, never "nothing happened")', read([])],
  ])('%s → null', (_, r) => {
    expect(humanitarianHomeProjection(r, CLEARED, AT)).toBeNull();
  });
  it('REAL E1 ruling (no source reader-cleared): retained rows → null', () => {
    expect(
      humanitarianHomeProjection(read([gdacsEvent(), reliefwebFigure(1200)]), REAL, AT),
    ).toBeNull();
  });
  it('G gate refuses the WHOLE read: one uncleared source among cleared ones → null', () => {
    const gdacsOnly = { ...CLEARED, readerClearedSourceIds: ['GDACS'] };
    expect(
      humanitarianHomeProjection(read([gdacsEvent(), reliefwebFigure(1200)]), gdacsOnly, AT),
    ).toBeNull();
  });
  it('D-3: a GDACS row without its originating agency → null', () => {
    expect(humanitarianHomeProjection(read([gdacsEvent(null)]), CLEARED, AT)).toBeNull();
  });
  it('D-1: a required code with no catalogue label (E1 added one) → null', () => {
    const extra = { ...CLEARED, requiredDisclosures: [...E1_REQUIRED, 'NEW_E1_CODE'] };
    expect(humanitarianHomeProjection(read([gdacsEvent()]), extra, AT)).toBeNull();
  });
  it('an empty required set is a refusal, never "no restriction"', () => {
    expect(
      humanitarianHomeProjection(read([gdacsEvent()]), { ...CLEARED, requiredDisclosures: [] }, AT),
    ).toBeNull();
  });
});

describe('Home consumer — the admitted projection (counterfactual ruling: both sources cleared)', () => {
  const projection = humanitarianHomeProjection(
    read([gdacsEvent(), reliefwebFigure(1200)]),
    CLEARED,
    AT,
  )!;

  it('projects H’s brief with every E1 disclosure and both attribution forms', () => {
    expect(projection).not.toBeNull();
    expect(projection.brief.state).toBe('RETAINED');
    expect(projection.disclosures).toEqual(E1_REQUIRED);
    expect(projection.recordCount).toBe(2);
    expect(projection.attributions).toEqual(
      expect.arrayContaining([
        { publisher: VERBATIM, relayAttribution: VERBATIM, originatingAgency: 'GLOFAS' },
        { publisher: 'ReliefWeb', relayAttribution: null, originatingAgency: null },
      ]),
    );
  });
  it('a figure is carried exactly as the source stated it, as a source assertion', () => {
    expect(projection.brief.figures).toEqual([
      expect.objectContaining({
        measure: 'PEOPLE_DISPLACED',
        value: 1200,
        claimClass: 'SOURCE_ASSERTION',
      }),
    ]);
  });
  it('MISSING IMPACT IS NEVER ZERO: an event-only read carries no figure, and its unknowns are named', () => {
    const eventOnly = humanitarianHomeProjection(read([gdacsEvent()]), CLEARED, AT)!;
    expect(eventOnly.brief.figures).toEqual([]);
    expect(eventOnly.brief.dimensionsUnknown.length).toBeGreaterThan(0);
    expect(JSON.stringify(eventOnly.brief)).not.toMatch(/"value":0\b/);
  });
  it('the source’s own severity string and internal capture keys never reach Home', () => {
    const html = renderToStaticMarkup(
      createElement(HomeHumanitarian, { projection, language: 'en' }),
    );
    expect(html).not.toContain(PROTECTED);
    expect(JSON.stringify(projection.attributions)).not.toContain(PROTECTED);
  });
  it.each(['en', 'pl'] as const)(
    'renders (%s): every disclosure, retained-not-current, never "current"',
    (language) => {
      const s = language === 'pl' ? humanitarianPl : humanitarianEn;
      const html = renderToStaticMarkup(createElement(HomeHumanitarian, { projection, language }));
      for (const code of E1_REQUIRED) expect(html).toContain(`data-disclosure="${code}"`);
      expect(html).toContain(s.readerDisclosure.RETAINED_NOT_CURRENT!.replace(/'/g, '&#x27;'));
      expect(html).toContain('1200');
      expect(html).not.toMatch(/CURRENT_PROVIDER_OBSERVATION|live data|dane na żywo/i);
    },
  );
  it('null projection renders nothing at all', () => {
    expect(
      renderToStaticMarkup(createElement(HomeHumanitarian, { projection: null, language: 'en' })),
    ).toBe('');
  });
});

describe('Home consumer — structure', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  it('the projection and the component fetch nothing and call no model', () => {
    for (const f of [
      'lib/humanitarian/humHomeProjection.ts',
      'components/home/reva/HomeHumanitarian.tsx',
    ]) {
      const code = strip(readFileSync(join(ROOT, 'frontend/src', f), 'utf8'));
      expect({
        f,
        hit: /fetch\(|async\s|await\s|openai|anthropic|analyzeNews|\/api\/ask/i.test(code),
      }).toEqual({ f, hit: false });
    }
  });
  it('Home keeps ONE getHomeFeed call and reads Humanitarian beside it, not inside it', () => {
    const page = strip(readFileSync(join(ROOT, 'frontend/src/app/page.tsx'), 'utf8'));
    expect(page.match(/getHomeFeed\(/g)).toHaveLength(1);
    expect(page).toMatch(/Promise\.all\(\[\s*getHomeFeed\(language\),\s*readHumanitarianHome\(/);
    expect(page).not.toMatch(/\bfetch\(/);
    const homeFeed = readFileSync(join(ROOT, 'frontend/src/lib/homeFeed.ts'), 'utf8');
    expect(homeFeed).not.toMatch(/humanitarian/i);
  });
});
