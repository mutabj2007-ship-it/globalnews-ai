import { readFileSync } from 'fs';
import { join } from 'path';
import {
  HUMANITARIAN_HAZARD_TYPES,
  HUMANITARIAN_WORKSPACE_DIMENSIONS,
  domainObservationKey,
  humanitarianAskHandoff,
  humanitarianIdentity,
  humanitarianReadAbsence,
  humanitarianRetainedRead,
  projectHumanitarianWorkspace,
  projectWorkspaceFromRead,
  type HumanitarianClaim,
  type HumanitarianObservation,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import {
  HumWorkspaceCopyMissing,
  assertWorkspaceCopyDoesNotReassure,
  humAbsenceLabel,
  humAskQuestion,
  humAskUnavailableLabel,
  humDimensionLabel,
  humEmptyReasonLabel,
  humStoreStateLabel,
  humStoredAnalysisHref,
  humWorkspaceRows,
} from './humWorkspace';
import { HUM_PL_DRAFT_AWAITING_COMPLETION, humStrings } from './humStrings';
import type { HumStrings } from './humStrings';

const AT = '2026-10-02T00:00:00.000Z';
const EN = humStrings('en');
/* PL remains the authored DRAFT rather than a catalogue entry, so the locale fallback stays
   disclosed on screen. That accepted posture is unchanged by R2; the draft is still held to
   every rule the catalogue entry is. */
const PL = HUM_PL_DRAFT_AWAITING_COMPLETION as unknown as HumStrings;
const admitAll = (): boolean => true;

function source(relative: string): string {
  return readFileSync(join(__dirname, relative), 'utf8');
}

/** Source with comments stripped, so prose explaining a prohibition cannot satisfy it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function humRecord(
  authority: string,
  upstreamId: string,
  claim: HumanitarianClaim,
): HumanitarianRetainedRecord {
  const identity = humanitarianIdentity(authority, upstreamId);
  const observation: HumanitarianObservation = {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: claim.claimType,
    subjectType: 'SOURCE_EVENT',
    subjectId: upstreamId,
    claim,
    temporal: {
      publisherVintage: '2026-09-20T00:00:00.000Z',
      retrievedAt: '2026-09-21T00:00:00.000Z',
      temporalBasis: 'PUBLISHER_VINTAGE',
    },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: authority,
      retrievedAt: '2026-09-21T00:00:00.000Z',
    },
    sourceReference: {},
    attributeAuthorship: [{ attribute: 'sourceTitle', authorship: 'PUBLISHER_STATED' }],
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  };
  return {
    captureKey: `cap-${upstreamId}`,
    publisherReleasedAt: '2026-09-20T00:00:00.000Z',
    observation,
  };
}

function hazardEvent(hazardType: string, id = 'E-1'): HumanitarianRetainedRecord {
  return humRecord('GDACS', id, {
    claimType: 'HUMANITARIAN_EVENT',
    hazardType: hazardType as never,
    sourceNativeType: 'XX',
    sourceTitle: 'Event',
    eventStatus: 'ONGOING',
    countryIso3: ['SDN'],
  });
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

  it('authors every absence reason and the store state the projection can produce', () => {
    const produced = { absence: new Set<string>(), store: new Set<string>() };
    const inputs = [
      projectWorkspaceFromRead(humanitarianReadAbsence('NOT_ASSESSED'), AT),
      projectWorkspaceFromRead(humanitarianReadAbsence('SOURCE_NOT_CONNECTED'), AT),
      projectWorkspaceFromRead(humanitarianRetainedRead([], admitAll), AT),
      projectHumanitarianWorkspace([hazardEvent('FLOOD')], AT),
    ];
    for (const workspace of inputs) {
      for (const row of humWorkspaceRows(workspace)) {
        if (row.absence !== null) produced.absence.add(row.absence);
        if (row.storeState !== null) produced.store.add(row.storeState);
      }
    }
    expect(produced.absence.size).toBeGreaterThan(0);
    expect(produced.store.has('NO_RETAINED_EVIDENCE')).toBe(true);
    for (const absence of produced.absence) {
      expect(() => humAbsenceLabel(EN, absence as never)).not.toThrow();
      expect(() => humAbsenceLabel(PL, absence as never)).not.toThrow();
    }
    for (const store of produced.store) {
      expect(() => humStoreStateLabel(EN, store as never)).not.toThrow();
      expect(() => humStoreStateLabel(PL, store as never)).not.toThrow();
    }
  });

  it('authors every hazard type in both locales so none can silently disable the handoff', () => {
    for (const hazard of HUMANITARIAN_HAZARD_TYPES) {
      const workspace = projectHumanitarianWorkspace([hazardEvent(hazard)], AT);
      for (const locale of ['en', 'pl'] as const) {
        const composition = humAskQuestion(humanitarianAskHandoff(workspace), locale);
        expect(composition.available).toBe(true);
      }
    }
  });

  it('has no slot for a positive finding and refuses one if asked', () => {
    expect(Object.keys(EN.workspace.absence)).not.toContain('ASSESSED_NOTHING_QUALIFIED');
    expect(Object.keys(PL.workspace.absence)).not.toContain('ASSESSED_NOTHING_QUALIFIED');
    expect(() => humAbsenceLabel(EN, 'ASSESSED_NOTHING_QUALIFIED')).toThrow(
      HumWorkspaceCopyMissing,
    );
  });

  it('never turns an absence or the store state into reassurance, in either locale', () => {
    expect(() => assertWorkspaceCopyDoesNotReassure(EN, 'en')).not.toThrow();
    expect(() => assertWorkspaceCopyDoesNotReassure(PL, 'pl')).not.toThrow();
  });
});

describe('HUM-WS-R2 · the reader never sees the store state as an absence', () => {
  it('reads the reason through one accessor, and the two texts differ', () => {
    const storeEmpty = projectWorkspaceFromRead(humanitarianRetainedRead([], admitAll), AT);
    const notAssessed = projectWorkspaceFromRead(humanitarianReadAbsence('NOT_ASSESSED'), AT);
    const storeRow = humWorkspaceRows(storeEmpty).find((r) => r.id === 'WHERE')!;
    const absenceRow = humWorkspaceRows(notAssessed).find((r) => r.id === 'WHERE')!;
    const storeText = humEmptyReasonLabel(EN, storeRow);
    const absenceText = humEmptyReasonLabel(EN, absenceRow);
    expect(storeText).not.toBe(absenceText);
    expect(storeText).toBe(EN.workspace.storeState.NO_RETAINED_EVIDENCE);
    expect(absenceText).toBe(EN.workspace.absence.NOT_ASSESSED);
  });

  it('refuses a dimension that names both reasons or neither', () => {
    const workspace = projectWorkspaceFromRead(humanitarianRetainedRead([], admitAll), AT);
    const row = humWorkspaceRows(workspace)[0]!;
    expect(() => humEmptyReasonLabel(EN, { ...row, absence: 'NOT_ASSESSED' })).toThrow(
      /EMPTY_REASON_AMBIGUOUS/,
    );
    expect(() => humEmptyReasonLabel(EN, { ...row, storeState: null })).toThrow(
      /EMPTY_REASON_AMBIGUOUS/,
    );
  });

  it('refuses a missing reason rather than rendering nothing', () => {
    expect(() => humAbsenceLabel(EN, null)).toThrow(/ABSENCE_WITHOUT_STATE/);
    expect(() => humStoreStateLabel(EN, null)).toThrow(/STORE_STATE_MISSING/);
  });
});

describe('HUM-WS · the Ask handoff composes a question, never a prompt', () => {
  const admitted = [hazardEvent('FLOOD')];

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

  it('composes a plain question in the reader language with no machine token in it', () => {
    for (const locale of ['en', 'pl'] as const) {
      const composition = humAskQuestion(
        humanitarianAskHandoff(projectHumanitarianWorkspace(admitted, AT)),
        locale,
      );
      if (!composition.available) throw new Error(`expected a question for ${locale}`);
      expect(composition.question).not.toContain('FLOOD');
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

  it('refuses rather than printing an unauthored hazard type', () => {
    const composition = humAskQuestion(
      humanitarianAskHandoff(projectHumanitarianWorkspace([hazardEvent('NOT_A_HAZARD')], AT)),
      'en',
    );
    expect(composition).toEqual({ available: false, refusal: 'KIND_NOT_AUTHORED' });
    expect(humAskUnavailableLabel(EN, 'KIND_NOT_AUTHORED').length).toBeGreaterThan(0);
  });

  it('a report with no admitted event refuses with NO_STATED_SUBJECT', () => {
    const report = humRecord('RELIEFWEB', 'R-1', {
      claimType: 'HUMANITARIAN_REPORT',
      sourceTitle: 'Situation Report',
      countryIso3: ['SDN'],
      aboutEventKeys: [],
    });
    const composition = humAskQuestion(
      humanitarianAskHandoff(projectHumanitarianWorkspace([report], AT)),
      'en',
    );
    expect(composition).toEqual({ available: false, refusal: 'NO_STATED_SUBJECT' });
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
  const page = code(source('../../app/humanitarian/page.tsx'));

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
    expect(view).not.toMatch(/onSubmit|requestSubmit|router\.push/);
  });

  it('the page resolves the read arm once, through the read-aware entry point', () => {
    expect(page).toMatch(/projectWorkspaceFromRead\(retainedRead,/);
    /* R1 passed `.observations`, which compiled against all three arms and reported the
       store-empty case as NOT_ASSESSED. That call must not come back. */
    expect(page).not.toMatch(/projectHumanitarianWorkspace\(retainedRead\.observations/);
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
