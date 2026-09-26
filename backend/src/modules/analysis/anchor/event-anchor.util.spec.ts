import {
  classifyEventEvidence,
  deriveEventDisclosures,
  deriveEventTopic,
  detectAmbiguousCountryMention,
  detectEventAspects,
  isAnaphoricFollowUp,
  isEventTopic,
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
          'Kigali closed the crossing in response to the crash, citing security.',
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
        'The crash prompted neighbouring Rwanda to shut the crossing, officials said.',
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

/* ══ R1.1 — CTO remote-review blockers ══════════════════════════════════ */

describe('R1.1 B1 — chronology is not consequence', () => {
  const topic = 'plane crash';
  const consequence = { cause: false, effect: true, crossBorder: true };
  const as =
    (relation: 'DIRECT_EVENT' | 'REPORTED_CONSEQUENCE') => (title: string, summary: string) => ({
      article: art(title, summary),
      relation,
    });

  it('chronological "after": the crash reporting is kept as DIRECT_EVENT, not a consequence', () => {
    const a = art(
      'After the plane crash, officials discussed an unrelated Ebola outbreak',
      'Health officials said neighbouring countries were on alert.',
    );
    expect(classifyEventEvidence(a, topic)).toBe('DIRECT_EVENT');
    expect(
      deriveEventDisclosures(consequence, topic, [as('DIRECT_EVENT')(a.title, a.summary)]),
    ).toContain('CROSS_BORDER_NOT_ESTABLISHED');
  });

  it.each([
    ['Following the plane crash, Rwanda held border talks', 'Talks on trade continued.'],
    [
      'In the wake of the plane crash, Uganda reported Ebola cases',
      'Neighbouring countries were on alert.',
    ],
    [
      'Rwanda closes border after DR Congo plane crash',
      'Officials gave no reason for the closure.',
    ],
  ])(
    'chronology alone — "%s" — is DIRECT_EVENT and establishes no cross-border effect',
    (title, summary) => {
      expect(classifyEventEvidence(art(title, summary), topic)).toBe('DIRECT_EVENT');
      expect(
        deriveEventDisclosures(consequence, topic, [as('DIRECT_EVENT')(title, summary)]),
      ).toContain('CROSS_BORDER_NOT_ESTABLISHED');
    },
  );

  it('same-sentence coincidence: both subjects, no link, is not a consequence', () => {
    const title = 'DR Congo mourns plane crash victims as Ebola spreads to neighbouring countries';
    expect(classifyEventEvidence(art(title), topic)).toBe('DIRECT_EVENT');
    expect(deriveEventDisclosures(consequence, topic, [as('DIRECT_EVENT')(title, '')])).toContain(
      'CROSS_BORDER_NOT_ESTABLISHED',
    );
  });

  it.each([
    ['DR Congo plane crash prompted Rwanda to close its border', ''],
    ['DR Congo plane crash led to border closures in neighbouring Rwanda', ''],
    ['Neighbouring Rwanda sealed the border as a result of the plane crash', ''],
    ['The plane crash forced neighbouring Uganda to suspend flights', ''],
  ])(
    'explicit consequence — "%s" — is REPORTED_CONSEQUENCE and establishes the cross-border effect',
    (title, summary) => {
      expect(classifyEventEvidence(art(title, summary), topic)).toBe('REPORTED_CONSEQUENCE');
      expect(
        deriveEventDisclosures(consequence, topic, [as('REPORTED_CONSEQUENCE')(title, summary)]),
      ).not.toContain('CROSS_BORDER_NOT_ESTABLISHED');
    },
  );

  it('explicit response to the event is REPORTED_CONSEQUENCE', () => {
    const title = 'Rwanda closes border with DR Congo';
    const summary =
      'Neighbouring Rwanda closed the crossing in response to the plane crash, officials said.';
    expect(classifyEventEvidence(art(title, summary), topic)).toBe('REPORTED_CONSEQUENCE');
    expect(
      deriveEventDisclosures(consequence, topic, [as('REPORTED_CONSEQUENCE')(title, summary)]),
    ).not.toContain('CROSS_BORDER_NOT_ESTABLISHED');
  });

  it('a connector breaks the link: "closed because of fog after the crash" is not a crash consequence', () => {
    expect(
      classifyEventEvidence(
        art('Goma airport closed because of fog after the plane crash', ''),
        topic,
      ),
    ).toBe('DIRECT_EVENT');
  });

  it('"the crash was caused by …" is the event\'s cause, never a consequence of it', () => {
    expect(
      classifyEventEvidence(
        art('Plane crash in DR Congo', 'The crash was caused by engine failure.'),
        topic,
      ),
    ).toBe('DIRECT_EVENT');
  });
});

describe('R1.1 B2 — a cause must be the cause OF the anchored event', () => {
  const topic = 'plane crash';
  const cause = { cause: true, effect: false, crossBorder: false };
  const one = (title: string, summary: string) => [
    { article: art(title, summary), relation: 'DIRECT_EVENT' as const },
  ];

  it.each([
    [
      'Plane crash in DR Congo kills officers',
      'The crash cause remains under investigation. Rescue operations were delayed due to bad weather.',
    ],
    [
      'Plane crash in DR Congo kills officers',
      'Goma airport was closed because of fog after the crash.',
    ],
    [
      'Plane crash in DR Congo kills officers',
      'The crash investigation was postponed due to security concerns.',
    ],
    ['Plane crash in DR Congo kills officers', 'The inquiry was postponed due to security.'],
    ['Plane crash in DR Congo kills officers', 'The cause of the crash is not yet known.'],
    ['Plane crash in DR Congo kills officers', 'Officials have not said what caused the crash.'],
    ['Plane crash in DR Congo kills officers', 'The cause of the crash was not disclosed.'],
  ])('%s / "%s" → CAUSE_NOT_ESTABLISHED', (title, summary) => {
    expect(deriveEventDisclosures(cause, topic, one(title, summary))).toEqual([
      'CAUSE_NOT_ESTABLISHED',
    ]);
  });

  it.each([
    ['Plane crash in DR Congo kills officers', 'The crash was caused by engine failure.'],
    [
      'Plane crash in DR Congo kills officers',
      'Investigators attributed the crash to pilot error.',
    ],
    ['Engine failure caused the DR Congo plane crash', ''],
    [
      'Plane crash in DR Congo kills officers',
      'The cause of the crash was a fuel leak, officials said.',
    ],
    ['Plane crash in DR Congo kills officers', 'The crash was reportedly blamed on bad weather.'],
  ])('%s / "%s" → cause established', (title, summary) => {
    expect(deriveEventDisclosures(cause, topic, one(title, summary))).toEqual([]);
  });

  it('a causal phrase elsewhere in the article never suppresses the disclosure', () => {
    expect(
      deriveEventDisclosures(cause, topic, [
        ...one('Plane crash in DR Congo kills officers', 'No cause was given.'),
        ...one(
          'DR Congo plane crash victims mourned',
          'Flights were cancelled due to strikes. Roads closed because of flooding.',
        ),
      ]),
    ).toEqual(['CAUSE_NOT_ESTABLISHED']);
  });
});

describe('R1.1 B3 — only a discrete event is anchored', () => {
  it.each([
    'Why is AI regulation important?',
    'Why is inflation high in Poland?',
    'What are the effects of high interest rates?',
    'Explain the new EU AI regulation in plain English',
  ])('ordinary analytical subject — "%s" — is not event-like', (q) => {
    expect(isEventTopic(deriveEventTopic(q))).toBe(false);
  });

  it.each([
    ['What caused the plane crash?', 'plane crash'],
    ['What were the effects of the earthquake?', 'earthquake'],
    ['Did the explosion affect neighbouring countries?', 'explosion'],
    ['What caused the plane crash in Congo?', 'plane crash'],
  ])('genuine event — "%s" — is event-like', (q, topic) => {
    expect(deriveEventTopic(q)).toBe(topic);
    expect(isEventTopic(deriveEventTopic(q))).toBe(true);
  });

  it('PL event nouns are recognised', () => {
    expect(isEventTopic('katastrofa samolotu')).toBe(true);
    expect(isEventTopic('inflacja')).toBe(false);
  });
});
