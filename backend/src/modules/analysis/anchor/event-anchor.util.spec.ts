import {
  classifyEventEvidence,
  deriveEventDisclosures,
  deriveEventTopic,
  detectAmbiguousCountryMention,
  detectEventAspects,
  isAnaphoricFollowUp,
  withholdContextOnlyConsequenceClaims,
  withoutAmbiguousCountryMentions,
} from './event-anchor.util';

/**
 * ASK CONVERSATIONAL EVIDENCE ANCHORING R1 — the deterministic anchor pieces,
 * on the Product Owner's exact two turns and the adversarial fixtures.
 */

const T1 = 'What caused the plane crash in Congo?';
const T2 =
  'Does this influence the neighboring countries? how had its the effect and who are involved. why is it a great concern now?';

const art = (title: string, summary = '') => ({ title, summary, category: 'world' as const });

describe('topic, aspects and anaphora — the exact Congo turns', () => {
  it('Turn 1 names the event "plane crash" and asks for its cause', () => {
    expect(deriveEventTopic(T1)).toBe('plane crash');
    expect(detectEventAspects(T1)).toEqual({ cause: true, effect: false, crossBorder: false });
    expect(isAnaphoricFollowUp(T1)).toBe(false);
  });

  it('Turn 2 names no event and no place of its own: it refers back ("this")', () => {
    expect(deriveEventTopic(T2)).toBeUndefined();
    expect(isAnaphoricFollowUp(T2)).toBe(true);
    expect(detectEventAspects(T2)).toEqual({ cause: true, effect: true, crossBorder: true });
  });

  it('ordinary short words are never places ("it", "is", "in" are not Italy, Iceland, India)', () => {
    expect(isAnaphoricFollowUp('Why is it a concern in the region?')).toBe(true);
  });

  it('a follow-up that names its own place or event is not anaphoric', () => {
    expect(isAnaphoricFollowUp('What about Rwanda?')).toBe(false);
    expect(isAnaphoricFollowUp('Does this Ebola outbreak affect Uganda?')).toBe(false);
  });

  it('PL: "Czy to wpływa na sąsiednie kraje?" refers back', () => {
    expect(isAnaphoricFollowUp('Czy to wpływa na sąsiednie kraje?')).toBe(true);
  });
});

describe('ambiguous "Congo" — never silently DR Congo', () => {
  it.each([T1, 'Plane crash in congo', 'Co się stało w Kongo?'])('"%s" is ambiguous', (q) => {
    expect(detectAmbiguousCountryMention(q)?.candidates).toEqual(['COD', 'COG']);
  });

  it.each([
    'Plane crash in DR Congo',
    'Plane crash in the Democratic Republic of the Congo',
    'Plane crash in the Republic of the Congo',
    'Plane crash in Congo-Kinshasa',
    'Plane crash in Congo-Brazzaville',
  ])('"%s" is qualified, not ambiguous', (q) => {
    expect(detectAmbiguousCountryMention(q)).toBeUndefined();
  });
});

describe('classifyEventEvidence — DIRECT_EVENT / REPORTED_CONSEQUENCE / CONTEXT_ONLY', () => {
  const topic = 'plane crash';

  it.each([
    [
      'Military plane crashes in eastern DR Congo, killing senior officers',
      'The cause is under investigation.',
    ],
    [
      'Plane crash in Congo kills army commanders, officials say',
      'The aircraft went down after take-off.',
    ],
  ])('crash reporting is DIRECT_EVENT: %s', (title, summary) => {
    expect(classifyEventEvidence(art(title, summary), topic)).toBe('DIRECT_EVENT');
  });

  it('a report that itself links a consequence to the crash is REPORTED_CONSEQUENCE', () => {
    expect(
      classifyEventEvidence(
        art(
          'Rwanda closes border crossing after DR Congo plane crash',
          'Kigali cited security after the crash killed senior officers.',
        ),
        topic,
      ),
    ).toBe('REPORTED_CONSEQUENCE');
  });

  it.each([
    ['WHO warns of Ebola outbreak spreading in DR Congo', 'Neighbouring countries were on alert.'],
    ['DR Congo cobalt exports rise as prices recover', 'Mining revenue grew.'],
    ['M23 rebels advance near Goma', 'Fighting displaced thousands.'],
    ['Uganda reports Ebola case near Congo border', 'Health officials traced contacts.'],
    ['Congo inflation eases as currency stabilises', 'The central bank held rates.'],
  ])(
    'same-country / neighbouring / health / security / economic stories are CONTEXT_ONLY: %s',
    (title, summary) => {
      expect(classifyEventEvidence(art(title, summary), topic)).toBe('CONTEXT_ONLY');
    },
  );

  it('an article mentioning both events without linking them is not a consequence', () => {
    expect(
      classifyEventEvidence(
        art(
          'Congo mourns plane crash victims as Ebola spreads to neighbouring countries',
          'Health officials warned of rising cases.',
        ),
        topic,
      ),
    ).toBe('DIRECT_EVENT');
  });
});

describe('deriveEventDisclosures — what the evidence does NOT establish', () => {
  const topic = 'plane crash';
  const direct = {
    article: art(
      'Military plane crashes in DR Congo, killing officers',
      'The cause is under investigation.',
    ),
    relation: 'DIRECT_EVENT' as const,
  };
  const ebola = {
    article: art(
      'WHO warns of Ebola outbreak in DR Congo',
      'Neighbouring countries were on alert after cases rose.',
    ),
    relation: 'CONTEXT_ONLY' as const,
  };

  it('the exact Congo follow-up: cross-border and cause are not established; context separated', () => {
    expect(deriveEventDisclosures(detectEventAspects(T2), topic, [direct, ebola])).toEqual([
      'CAUSE_NOT_ESTABLISHED',
      'CROSS_BORDER_NOT_ESTABLISHED',
      'CONTEXT_SEPARATED',
    ]);
  });

  it('Ebola\'s own "neighbouring countries … after cases rose" can never establish the crash\'s cross-border effect', () => {
    expect(
      deriveEventDisclosures({ cause: false, effect: true, crossBorder: true }, topic, [ebola]),
    ).toContain('CROSS_BORDER_NOT_ESTABLISHED');
  });

  it('a genuine source explicitly reporting a cross-border consequence establishes it', () => {
    const genuine = {
      article: art(
        'Rwanda closes border after DR Congo plane crash',
        'Neighbouring Rwanda shut the crossing after the crash, officials said.',
      ),
      relation: 'REPORTED_CONSEQUENCE' as const,
    };
    expect(
      deriveEventDisclosures({ cause: false, effect: true, crossBorder: true }, topic, [
        direct,
        genuine,
      ]),
    ).not.toContain('CROSS_BORDER_NOT_ESTABLISHED');
  });

  it('a reported cause is established; "under investigation" is not', () => {
    const cause = {
      article: art(
        'Plane crash in DR Congo blamed on engine failure',
        'Investigators said the crash was caused by engine failure.',
      ),
      relation: 'DIRECT_EVENT' as const,
    };
    expect(
      deriveEventDisclosures({ cause: true, effect: false, crossBorder: false }, topic, [cause]),
    ).toEqual([]);
    expect(
      deriveEventDisclosures({ cause: true, effect: false, crossBorder: false }, topic, [direct]),
    ).toEqual(['CAUSE_NOT_ESTABLISHED']);
  });
});

describe('withoutAmbiguousCountryMentions — a bare "Congo" votes for neither country', () => {
  it('blanks the bare name and keeps every qualified form', () => {
    expect(
      withoutAmbiguousCountryMentions('Plane crash in Congo kills commanders').includes('Congo'),
    ).toBe(false);
    for (const q of [
      'DR Congo army',
      'Democratic Republic of the Congo',
      'Republic of the Congo',
      'Congo-Kinshasa',
      'Congo-Brazzaville',
    ]) {
      expect(withoutAmbiguousCountryMentions(q)).toBe(q);
    }
  });

  it('keeps other place signals (Goma) untouched', () => {
    expect(withoutAmbiguousCountryMentions('Congo crash after take-off from Goma')).toContain(
      'Goma',
    );
  });
});

describe('withholdContextOnlyConsequenceClaims', () => {
  const claim = (ids: string[]) => ({ claim: 'x', sourceArticleIds: ids });
  it('withholds claims whose ONLY support is context; keeps mixed and event-supported claims', () => {
    const { analysis, withheld } = withholdContextOnlyConsequenceClaims(
      {
        immediateImpacts: [claim(['crash-1']), claim(['ebola-1'])],
        spilloverImplications: [claim(['ebola-1', 'mine-1']), claim(['ebola-1', 'crash-2'])],
        affectedParties: [{ ...claim(['mine-1']) }],
      },
      new Set(['ebola-1', 'mine-1']),
    );
    expect(withheld).toBe(3);
    expect(analysis.immediateImpacts).toEqual([claim(['crash-1'])]);
    expect(analysis.spilloverImplications).toEqual([claim(['ebola-1', 'crash-2'])]);
    expect(analysis.affectedParties).toEqual([]);
  });

  it('returns the same object when there is no context', () => {
    const input = { immediateImpacts: [claim(['crash-1'])] };
    expect(withholdContextOnlyConsequenceClaims(input, new Set()).analysis).toBe(input);
  });
});
