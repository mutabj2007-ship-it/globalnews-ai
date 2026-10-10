import {
  artifactPromptBlock,
  priorEvidenceGap,
  serverArtifact,
  validateStoredArtifact,
  type ConversationArtifact,
} from './conversation-artifact';
import { readsEarlierEvidence } from './earlier-evidence-reference';

/**
 * ASK EVIDENCE CONTINUITY R1 — the record of a turn with no admitted evidence, as a later prompt
 * reads it (Production op 9713f8ee read a rate-limited, empty record as "summarised sourced
 * reporting"), and the closed phrase list that marks a turn as standing on the earlier reports.
 */
const scope = {
  question: 'What are the latest verified developments in eastern DR Congo over the last seven days?',
  job: 'CURRENT_REPORTING',
  countries: ['COD'],
  relation: null,
  freshness: 'CURRENT' as const,
};

function record(extra: Partial<Parameters<typeof serverArtifact>[0]>): ConversationArtifact {
  const a = serverArtifact({
    kind: 'SOURCED_REPORT',
    provenance: 'SOURCED_REPORTING',
    label: 'Eastern DR Congo',
    components: ['No qualifying reporting was found for this question at the time it was asked.'],
    scope,
    ...extra,
  });
  if (a === null) throw new Error('record not derived');
  return a;
}

describe('artifactPromptBlock — a no-evidence record is never "summarised sourced reporting"', () => {
  it('search incomplete (rate-limited): says no verified reports and why', () => {
    const block = artifactPromptBlock(
      record({
        components: [
          'The search did not complete (a news source was unavailable or rate-limited).',
          'No verified reports were obtained for this question.',
        ],
        currentFindings: 'NONE',
        noEvidenceReason: 'SEARCH_INCOMPLETE',
      }),
    );
    expect(block).not.toContain('summarised sourced reporting');
    expect(block).not.toContain('points the answer made');
    expect(block).toContain('its search returned NO verified reports');
    expect(block).toContain('the search did not complete (a news source was unavailable or rate-limited)');
    expect(block).toContain('it holds no findings');
  });

  it('completed, no match: says the search found no qualifying reporting', () => {
    const block = artifactPromptBlock(
      record({ currentFindings: 'NONE', noEvidenceReason: 'NO_QUALIFYING_REPORTING' }),
    );
    expect(block).not.toContain('summarised sourced reporting');
    expect(block).toContain('the search completed and found no qualifying reporting');
  });

  it('a LEGACY record (stored before this repair: no marker, no evidence refs) is read the same way', () => {
    const block = artifactPromptBlock(record({}));
    expect(block).not.toContain('summarised sourced reporting');
    expect(block).toContain('returned NO verified reports');
    expect(priorEvidenceGap(record({}))).toBe('NO_EVIDENCE');
  });

  it('a sourced record WITH evidence is byte-identical to before', () => {
    const sourced = record({
      components: ['M23 holds Goma', 'Aid access curtailed'],
      evidenceRefs: ['art-1'],
    });
    expect(artifactPromptBlock(sourced)).toBe(
      '<<<EARLIER WORK IN THIS CONVERSATION (your own earlier answer, which summarised sourced reporting retrieved at that time; this summary is NOT evidence and NOT a current fact)\n' +
        `question it answered: ${scope.question}\n` +
        'kind: SOURCED_REPORT\nlabel: Eastern DR Congo\n' +
        'points the answer made: M23 holds Goma; Aid access curtailed\n' +
        'EARLIER WORK>>>',
    );
    expect(priorEvidenceGap(sourced)).toBeNull();
  });

  it('a reasoning record keeps its own header (unchanged)', () => {
    const reasoned = serverArtifact({
      kind: 'REASONED_ANSWER',
      provenance: 'MODEL_REASONING',
      label: 'Rates',
      components: ['Central banks set a policy rate.'],
      scope: null,
    }) as ConversationArtifact;
    expect(artifactPromptBlock(reasoned)).toBe(
      '<<<EARLIER WORK IN THIS CONVERSATION (your own earlier model reasoning; NOT evidence, NOT a source, NOT a current fact)\n' +
        'kind: REASONED_ANSWER\nlabel: Rates\ncomponents: Central banks set a policy rate.\nEARLIER WORK>>>',
    );
    expect(priorEvidenceGap(reasoned)).toBeNull();
  });
});

describe('priorEvidenceGap / stored marker round-trip', () => {
  it('the reason survives the stored-record validation (reopened conversations)', () => {
    const stored = validateStoredArtifact(
      JSON.parse(
        JSON.stringify(record({ currentFindings: 'NONE', noEvidenceReason: 'SEARCH_INCOMPLETE' })),
      ),
    );
    expect(stored).toMatchObject({ currentFindings: 'NONE', noEvidenceReason: 'SEARCH_INCOMPLETE' });
    expect(priorEvidenceGap(stored ?? undefined)).toBe('UNAVAILABLE');
  });

  it('a reason without the no-evidence marker, or an unknown reason, is dropped', () => {
    expect(validateStoredArtifact({ ...record({}), noEvidenceReason: 'SEARCH_INCOMPLETE' })).not.toHaveProperty(
      'noEvidenceReason',
    );
    expect(
      validateStoredArtifact({ ...record({}), currentFindings: 'NONE', noEvidenceReason: 'X' }),
    ).not.toHaveProperty('noEvidenceReason');
  });

  it('an incomplete earlier turn is UNAVAILABLE; reasoning beside a found-nothing part is NO_EVIDENCE', () => {
    expect(
      priorEvidenceGap({
        kind: 'REASONED_ANSWER',
        label: 'x',
        components: [],
        provenance: 'MODEL_REASONING',
        citable: false,
        currentFindings: 'NONE',
        incomplete: true,
      }),
    ).toBe('UNAVAILABLE');
    expect(
      priorEvidenceGap({
        kind: 'REASONED_ANSWER',
        label: 'x',
        components: ['y'],
        provenance: 'MODEL_REASONING',
        citable: false,
        currentFindings: 'NONE',
      }),
    ).toBe('NO_EVIDENCE');
    expect(priorEvidenceGap(undefined)).toBeNull();
  });
});

describe('readsEarlierEvidence — closed phrase list (EN / PL)', () => {
  it.each([
    'Based on those reports, what can we reasonably conclude about the situation for civilians, and what remains uncertain?',
    'According to those sources, who controls Goma?',
    'From these articles, what is confirmed?',
    'Given those findings, what should aid agencies prioritise?',
    'What do the reports say about displacement?',
    'Na podstawie tych doniesień, co możemy wywnioskować?',
    'Na podstawie tych raportów, co możemy wywnioskować o sytuacji cywilów?',
    'Według tych źródeł, kto kontroluje Gomę?',
    'Co mówią te raporty o przesiedleniach?',
  ])('reads "%s" as standing on the earlier reports', (q) => {
    expect(readsEarlierEvidence(q)).toBe(true);
  });

  it.each([
    'And what about Rwanda?',
    'What is happening in eastern DR Congo?',
    'Explain how central banks set rates.',
    'Is it still true now?',
    'Why did you say that?',
    'Write me a report on Kenya.',
    'Co się dzieje we wschodnim Kongu?',
  ])('does not read "%s" as standing on earlier reports', (q) => {
    expect(readsEarlierEvidence(q)).toBe(false);
  });
});
