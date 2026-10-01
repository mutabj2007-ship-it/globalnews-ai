import { readFileSync } from 'fs';
import { join } from 'path';
import {
  humanitarianAskHandoff,
  projectHumanitarianWorkspace,
  HUMANITARIAN_WORKSPACE_DIMENSIONS,
} from '@globalnews-ai/shared';
import {
  HumWorkspaceCopyMissing,
  assertWorkspaceCopyDoesNotReassure,
  humAbsenceLabel,
  humAskQuestion,
  humAskUnavailableLabel,
  humDimensionLabel,
  humStoredAnalysisHref,
  humWorkspaceRows,
} from './humWorkspace';
import { HUM_PL_DRAFT_AWAITING_COMPLETION, humStrings } from './humStrings';
import type { HumStrings } from './humStrings';

const AT = '2026-10-01T00:00:00.000Z';
const EN = humStrings('en');
/* PL is the authored draft rather than a catalogue entry — the locale fallback is
   DISCLOSED on screen rather than silently substituted, and that posture is not changed
   by this round. The draft is still held to every rule the catalogue entry is. */
const PL = HUM_PL_DRAFT_AWAITING_COMPLETION as unknown as HumStrings;

function source(relative: string): string {
  return readFileSync(join(__dirname, relative), 'utf8');
}

/** Source with comments stripped, so prose explaining a prohibition cannot satisfy it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('HUM-WS-9 · EN and PL labels', () => {
  it('authors every dimension label in both locales, and they differ', () => {
    for (const id of HUMANITARIAN_WORKSPACE_DIMENSIONS) {
      const en = humDimensionLabel(EN, id);
      const pl = humDimensionLabel(PL, id);
      expect(en.length).toBeGreaterThan(0);
      expect(pl.length).toBeGreaterThan(0);
      expect(pl).not.toBe(en);
    }
  });

  it('authors every absence reason the projection can produce, in both locales', () => {
    const produced = new Set<string>();
    for (const records of [
      [],
      [
        {
          captureKey: 'c',
          publisherReleasedAt: AT,
          observation: {
            observationKey: 'k',
            identity: {
              domainId: 'HUMANITARIAN',
              upstreamAuthority: 'COPERNICUS_EMS',
              upstreamId: 'k',
            },
            observationKind: 'SOURCE_INUNDATION_EXTENT',
            subjectType: 'SOURCE_EVENT',
            subjectId: 'k',
            claim: {},
            temporal: { retrievedAt: AT, temporalBasis: 'PUBLISHER_VINTAGE' as const },
            provenance: { sourceType: 'PUBLIC_DATA' as const, providerId: 'COPERNICUS_EMS' },
            sourceReference: {},
            attributeAuthorship: [
              { attribute: 'countryIso2', authorship: 'PUBLISHER_STATED' as const },
            ],
            revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
          },
        },
      ],
    ]) {
      for (const row of humWorkspaceRows(projectHumanitarianWorkspace(records, AT))) {
        if (row.absence !== null) produced.add(row.absence);
      }
    }
    expect(produced.size).toBeGreaterThan(0);
    for (const absence of produced) {
      expect(() => humAbsenceLabel(EN, absence as never)).not.toThrow();
      expect(() => humAbsenceLabel(PL, absence as never)).not.toThrow();
    }
  });

  it('has no slot for a positive finding and refuses one if asked', () => {
    expect(Object.keys(EN.workspace.absence)).not.toContain('ASSESSED_NOTHING_QUALIFIED');
    expect(Object.keys(PL.workspace.absence)).not.toContain('ASSESSED_NOTHING_QUALIFIED');
    expect(() => humAbsenceLabel(EN, 'ASSESSED_NOTHING_QUALIFIED')).toThrow(
      HumWorkspaceCopyMissing,
    );
  });

  it('refuses a missing reason rather than rendering nothing', () => {
    expect(() => humAbsenceLabel(EN, null)).toThrow(/ABSENCE_WITHOUT_STATE/);
  });

  it('never turns an absence into reassurance, in either authored locale', () => {
    expect(() => assertWorkspaceCopyDoesNotReassure(EN, 'en')).not.toThrow();
    expect(() => assertWorkspaceCopyDoesNotReassure(PL, 'pl')).not.toThrow();
  });
});

describe('HUM-WS · the Ask handoff composes a question, never a prompt', () => {
  const admitted = [
    {
      captureKey: 'c',
      publisherReleasedAt: AT,
      observation: {
        observationKey: 'k',
        identity: {
          domainId: 'HUMANITARIAN',
          upstreamAuthority: 'COPERNICUS_EMS',
          upstreamId: 'k',
        },
        observationKind: 'SOURCE_INUNDATION_EXTENT',
        subjectType: 'SOURCE_EVENT',
        subjectId: 'k',
        claim: {},
        temporal: { retrievedAt: AT, temporalBasis: 'PUBLISHER_VINTAGE' as const },
        provenance: { sourceType: 'PUBLIC_DATA' as const, providerId: 'COPERNICUS_EMS' },
        sourceReference: {},
        attributeAuthorship: [{ attribute: 'geometry', authorship: 'PUBLISHER_STATED' as const }],
        revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
      },
    },
  ];

  it('is unavailable with a reader-facing reason when nothing is admitted', () => {
    const composition = humAskQuestion(
      humanitarianAskHandoff(projectHumanitarianWorkspace([], AT)),
      'en',
    );
    expect(composition).toEqual({ available: false, refusal: 'NO_ADMITTED_RECORD' });
    if (composition.available) throw new Error('unreachable');
    expect(humAskUnavailableLabel(EN, composition.refusal).length).toBeGreaterThan(0);
    expect(humAskUnavailableLabel(PL, composition.refusal).length).toBeGreaterThan(0);
  });

  it('composes a plain question in the reader language, with no machine token in it', () => {
    for (const locale of ['en', 'pl'] as const) {
      const composition = humAskQuestion(
        humanitarianAskHandoff(projectHumanitarianWorkspace(admitted, AT)),
        locale,
      );
      if (!composition.available) throw new Error(`expected a question for ${locale}`);
      expect(composition.question).not.toContain('SOURCE_INUNDATION_EXTENT');
      expect(composition.question).not.toContain('_');
      expect(composition.question.endsWith('?')).toBe(true);
    }
  });

  it('EN and PL questions differ, so neither is a silent English substitution', () => {
    const en = humAskQuestion(
      humanitarianAskHandoff(projectHumanitarianWorkspace(admitted, AT)),
      'en',
    );
    const pl = humAskQuestion(
      humanitarianAskHandoff(projectHumanitarianWorkspace(admitted, AT)),
      'pl',
    );
    if (!en.available || !pl.available) throw new Error('expected both');
    expect(pl.question).not.toBe(en.question);
  });

  it('refuses rather than printing an unauthored record kind', () => {
    const unknownKind = [
      {
        ...admitted[0]!,
        observation: { ...admitted[0]!.observation, observationKind: 'SOURCE_SOMETHING_NEW' },
      },
    ];
    const composition = humAskQuestion(
      humanitarianAskHandoff(projectHumanitarianWorkspace(unknownKind, AT)),
      'en',
    );
    expect(composition).toEqual({ available: false, refusal: 'KIND_NOT_AUTHORED' });
    expect(humAskUnavailableLabel(EN, 'KIND_NOT_AUTHORED').length).toBeGreaterThan(0);
  });
});

describe('HUM-WS · opening a stored analysis is navigation, never a run', () => {
  it('builds only the accepted display-only address', () => {
    expect(humStoredAnalysisHref('op_123-ABC')).toBe('/ask?operation=op_123-ABC');
  });

  it('returns null rather than a guessed address when there is no owned operation', () => {
    expect(humStoredAnalysisHref(null)).toBeNull();
  });

  it.each(['', ' ', 'op 1', '../ask', 'op#1', 'op?1', 'op&q=run', 'a'.repeat(129)])(
    'refuses a malformed operation id: %j',
    (id) => {
      expect(humStoredAnalysisHref(id)).toBeNull();
    },
  );

  it('never produces a ?q= address, which Ask would read as a question to compute', () => {
    const href = humStoredAnalysisHref('op_1');
    expect(href).not.toBeNull();
    expect(href).not.toContain('q=');
  });
});

describe('HUM-WS · the workspace cannot compute', () => {
  const lib = code(source('humWorkspace.ts'));
  const view = code(source('../../components/humanitarian/drawers/AnalysisWorkspace.tsx'));

  it.each([
    ['analyzeNews', /analyzeNews/],
    ['the legacy analysis route', /\/analysis\/news/],
    ['the Ask V2 client', /askV2Api/],
    [
      'a quote, accept, reserve, execute or release call',
      /\b(quote|accept|reserve|execute|release)\s*\(/,
    ],
    ['fetch', /\bfetch\s*\(/],
    ['a provider or model reference', /provider[A-Z]|openai|anthropic|gemini/i],
    ['a consent grant', /grantAnalysisConsent/],
  ])('contains no %s', (_label, pattern) => {
    expect(lib).not.toMatch(pattern);
    expect(view).not.toMatch(pattern);
  });

  it('reaches Ask only by keeping a draft and linking to /ask', () => {
    expect(view).toMatch(/keepQuestion\(/);
    expect(view).toMatch(/href="\/ask"/);
    /* No programmatic submit, and no router push that could fire without a reader. */
    expect(view).not.toMatch(/onSubmit|requestSubmit|router\.push/);
  });

  it('states that opening a stored result runs nothing, in both locales', () => {
    expect(EN.workspace.displayOnly.length).toBeGreaterThan(0);
    expect(PL.workspace.displayOnly.length).toBeGreaterThan(0);
    expect(PL.workspace.displayOnly).not.toBe(EN.workspace.displayOnly);
  });

  it('keeps Deep analysis disabled: the ordinary Ask handoff does not unlock a quoted class', () => {
    const handoff = code(source('../../components/humanitarian/drawers/AnalysisHandoff.tsx'));
    expect(handoff).toMatch(/data-hum-cost="unavailable"/);
    expect(handoff).toMatch(/disabled/);
  });
});
