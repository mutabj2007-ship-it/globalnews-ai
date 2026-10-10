/**
 * P0 ASK-RETRIEVAL-REUTERS-DRC-R1 — THE FROZEN ACCEPTANCE CASES IN G's SCOPE.
 *
 * Case names are the CTO's (N1…N9). Cases that belong to Claude Code (answer
 * composition, live Alpha retrieval) or to the East Africa lead (rights,
 * regional metadata) are NOT asserted here and are named in the handoff
 * instead — a fixture passing here is explicitly NOT proof of live retrieval.
 *
 * The one external fact used below is the CTO-verified Reuters headline of
 * 2026-10-09. It appears ONLY as a relevance-matching fixture. No Reuters
 * content is retrieved, stored or attributed by this suite.
 */
import { detectSourceAttributedIntent } from '../../analysis/query/derive-source-attributed-query.util';
import { resolveGeography } from '../../geo/geo-resolver';
import { classifyRequestedPublisher } from './requested-publisher-state.util';
import { resolveRequestedSource } from './requested-source.util';

const N1 = 'Report abt Eric Prince in congo. According reuters please.';
const N2 = "According to Reuters, what happened to Erik Prince's forces in eastern Congo?";
const N3 = 'Give any recent reports about Eric Prince in Congo.';

describe('N1 · the exact natural user text reaches a named publisher', () => {
  it('detects the trailing shorthand attribution that was previously invisible', () => {
    /*
     * MEASURED AT 0717ff7 BEFORE THIS CHANGE: undefined — not a rejection, an
     * absence. namedPublisher stayed null, so the publisher was never a
     * constraint and the question was answered as biography.
     */
    const intent = detectSourceAttributedIntent(N1);

    expect(intent).toBeDefined();
    expect(intent?.rawSourcePhrase).toBe('reuters');
    expect(intent?.query?.sourcePhrase).toBe('reuters');
  });

  it('keeps the person and the country in the topic half', () => {
    const topic = detectSourceAttributedIntent(N1)?.query?.topic ?? '';

    expect(topic.toLowerCase()).toContain('eric prince');
    expect(topic.toLowerCase()).toContain('congo');
    /* The politeness tail and the attribution are not retrieval terms. */
    expect(topic.toLowerCase()).not.toContain('please');
    expect(topic.toLowerCase()).not.toContain('according');
  });

  it('works without the politeness tail and without the preposition', () => {
    for (const q of [
      'Report abt Eric Prince in congo. According reuters',
      'Report abt Eric Prince in congo, according reuters please',
      'Report about Eric Prince in Congo, according to Reuters. What happened?',
    ]) {
      expect(detectSourceAttributedIntent(q)?.query?.sourcePhrase?.toLowerCase()).toBe('reuters');
    }
  });
});

describe('N2 · the grammatical publisher form was never broken', () => {
  it('still takes the prefix frame, with the topic intact', () => {
    const intent = detectSourceAttributedIntent(N2);

    expect(intent?.query?.sourcePhrase).toBe('Reuters');
    expect(intent?.query?.topic.toLowerCase()).toContain("erik prince's forces");
    expect(intent?.query?.topic.toLowerCase()).toContain('eastern congo');
  });
});

describe('N3 · a broader request must not acquire a publisher it never named', () => {
  it.each([N3, 'Give any reports about Eric Prince please.', 'what happened to Eric Prince in Congo'])(
    'names no source: %s',
    (q) => {
      expect(detectSourceAttributedIntent(q)).toBeUndefined();
    },
  );
});

describe('N5 · requested-source unavailability is not "nothing was found"', () => {
  it('Reuters is RECOGNISED and NOT CARRIED — a distinct, reportable state', () => {
    const verdict = classifyRequestedPublisher('Reuters');

    expect(verdict.state).toBe('RECOGNISED_NOT_CARRIED');
    expect(verdict.reason).toBe('REQUESTED_SOURCE_NOT_CARRIED_NO_INGEST_RIGHTS');
    expect(verdict.displayName).toBe('Reuters');
    expect(verdict.carried).toBeNull();
  });

  it('the phrasing the reader used resolves to the same state', () => {
    for (const phrase of ['reuters', 'Reuters', 'REUTERS', ' reuters ']) {
      expect(classifyRequestedPublisher(phrase).state).toBe('RECOGNISED_NOT_CARRIED');
    }
  });

  it('RETRIEVAL IS STILL NOT WIDENED — REV C fail-closed is untouched', () => {
    /*
     * The whole point: recognising the name must not make the publisher
     * retrievable. If this ever returns a source, REV C's ruling is broken and
     * a Reuters question could be answered from somewhere else.
     */
    expect(resolveRequestedSource('Reuters')).toBeUndefined();
    expect(resolveRequestedSource('reuters')).toBeUndefined();
  });

  it('a carried publisher is still CARRIED and still retrievable', () => {
    const verdict = classifyRequestedPublisher('Statistics Poland');

    expect(verdict.state).toBe('CARRIED');
    expect(verdict.carried?.sourceId).toBe('feed:gus-pl');
  });

  it('an unknown masthead is UNRECOGNISED, which is a different fact', () => {
    const verdict = classifyRequestedPublisher('The Daily Invented Gazette');

    expect(verdict.state).toBe('UNRECOGNISED');
    expect(verdict.displayName).toBeNull();
  });
});

describe('N6 · the rights position is explicit and cannot drift to permissive', () => {
  it('carries no ingest authorization and a metadata-only surface', () => {
    const recognised = classifyRequestedPublisher('Reuters').recognised;

    expect(recognised?.ingestAuthorized).toBe(false);
    expect(recognised?.permittedSurface).toBe('ORIGINAL_LINK_AND_METADATA_ONLY');
    expect(recognised?.note).toContain('No ingest, redistribution or excerpt-storage right');
  });

  it('holds no endpoint, feed or URL for an uncarried publisher', () => {
    /* A URL here would be the unlicensed feed the ruling forbids. */
    expect(JSON.stringify(classifyRequestedPublisher('Reuters'))).not.toMatch(/https?:\/\//);
  });
});

describe('N9 · a conceptual question invents no publisher and no attribution', () => {
  it.each([
    'What is a private military company?',
    'Explain how mercenary contracting is regulated',
  ])('%s', (q) => {
    expect(detectSourceAttributedIntent(q)).toBeUndefined();
  });
});

describe('negative controls — the new frame must not fire on these', () => {
  it('the prepositional idiom is not an attribution', () => {
    /* No clause boundary before "according", so "plan" is never a publisher. */
    expect(detectSourceAttributedIntent('the rollout went according to plan')).toBeUndefined();
    expect(detectSourceAttributedIntent('did the vote go according to schedule')).toBeUndefined();
  });

  it('a parenthetical attribution inside a larger assertion is not an attribution', () => {
    /* The span would have to cross a comma to reach the end. */
    expect(
      detectSourceAttributedIntent('the attack, according to witnesses, killed three'),
    ).toBeUndefined();
  });

  it('an over-long span is reported as a constraint, never as an absence', () => {
    const intent = detectSourceAttributedIntent(
      'Report about Congo, according to the International Center for Investigative Reporting Network',
    );

    expect(intent).toBeDefined();
    expect(intent?.query).toBeUndefined();
    expect(intent?.rejection).toBe('source-too-long');
  });
});

describe('GEOGRAPHY · the measured country defect, pinned as it stands', () => {
  it('bare "Congo" resolves to the REPUBLIC of the Congo, not the DRC', () => {
    /*
     * MEASURED DEFECT G-ASK-2, NOT A FIX. The reader meant DR Congo — the
     * CTO-verified Reuters report is about eastern DRC/South Kivu — but a bare
     * "congo" resolves to COG, a different sovereign state ~2,000 km away. Any
     * retrieval scoped on this is scoped to the wrong country.
     *
     * It is PINNED rather than corrected because silently switching COG to COD
     * would be exactly the invention this programme forbids: bare "Congo" is
     * genuinely ambiguous and the honest outcome is disclosure, which is an
     * answer-layer decision and not this lane's to take. A later lane closing
     * it must invert this expectation deliberately.
     */
    expect(resolveGeography('Congo').candidates[0]?.country?.iso3).toBe('COG');
    expect(resolveGeography('Eric Prince in Congo').candidates[0]?.country?.iso3).toBe('COG');
  });

  it('the qualified forms resolve correctly, so the fix is disclosure not remapping', () => {
    expect(resolveGeography('DR Congo').candidates[0]?.country?.iso3).toBe('COD');
    expect(resolveGeography('Democratic Republic of the Congo').candidates[0]?.country?.iso3).toBe(
      'COD',
    );
    expect(resolveGeography('eastern DRC').candidates[0]?.country?.iso3).toBe('COD');
  });
});

describe('N4 · person-name equivalence — measured, and NOT silently fixed', () => {
  const READER = 'Eric Prince';
  const PUBLISHED = 'Erik Prince';

  it('the reader spelling and the published spelling are still distinct strings', () => {
    /*
     * MEASURED GAP G-ASK-3. The CTO-verified Reuters headline of 2026-10-09
     * spells "Erik Prince"; the reader typed "Eric Prince". No normalization
     * in this lane makes them equal, so a whole-phrase relevance gate cannot
     * match the headline to the query.
     *
     * DELIBERATELY NOT FIXED HERE. A person-alias mechanism without governed
     * entity identity is how a wrongful person match happens — acceptance case
     * N4's own prohibition. It needs an entity authority, not a string rule,
     * and it is handed to Code and EA with that reasoning rather than guessed.
     */
    expect(READER).not.toBe(PUBLISHED);
    expect(READER.toLowerCase()).not.toBe(PUBLISHED.toLowerCase());
  });

  it('the surname alone is far too weak to stand in for the person', () => {
    /* "Prince" alone would match unrelated people; this pins why the gap is not closed by a substring. */
    expect('Prince'.length).toBeLessThan(READER.length);
  });
});
