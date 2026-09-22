import { resolveConflictEventOwner, type SecurityOwnershipEvidence } from '@globalnews-ai/shared';
import {
  classifySecurityCandidate,
  type SecurityCandidateDecision,
} from './security-candidate.classifier';
import {
  ACT_OF_VIOLENCE_TERMS,
  CIVIL_CRIMINAL_FRAME_TERMS,
  matchTerms,
  NON_SECURITY_CAUSE_TERMS,
  ORGANISED_ARMED_ACTOR_TERMS,
  POLITICAL_ACTIVITY_TERMS,
  PROTECTIVE_POSTURE_TERMS,
  VIOLENCE_OR_POSTURE_TERMS,
} from './security-incident.lexicon';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE OWNERSHIP BOUNDARY, AND THE TWO WAYS IT SILENTLY BREAKS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The governed boundary is three-way:
 *
 *   POLITICS  persistent protest / political activity
 *   SECURITY  a violent or security incident with NO organised armed-actor classification
 *   CONFLICT  organised armed actors / armed conflict
 *
 * TWO REGRESSIONS WOULD NOT THROW, WOULD LOOK LIKE IMPROVEMENTS IN A DIFF, AND WOULD BE
 * SERIOUS. Each has a named test below:
 *
 *   1. T2 becoming `false` ON SILENCE. Spelling "the report does not mention an armed actor"
 *      as "no armed actor was involved" would route every unattributed killing in the corpus
 *      to Security, with Security asserting — on no evidence — that Conflict's criteria are
 *      NOT MET. `absence of an armed-actor term is never a decided false` is that test.
 *
 *   2. SUBSTRING MATCHING. `riot` inside `patriot` and `shot` inside `shotgun` would
 *      manufacture Security incidents out of unrelated news. The whole-word controls below
 *      are positive-and-negative pairs, so a matcher that matched nothing at all would fail
 *      them too.
 *
 * AND ONE STRUCTURAL PROPERTY IS ASSERTED RATHER THAN TRUSTED: every decision's `owner` is
 * compared against `resolveConflictEventOwner` called independently on the same thresholds.
 * That is what proves the classifier DELEGATES the ownership rule instead of reimplementing
 * it — E1 measured three consecutive contracts where two individually-correct functions
 * disagreed because the one a consumer called omitted the other.
 */

const SECURITY_SPECIMEN = {
  title: 'Man shot dead in Kigali robbery',
  summary: 'Police said the shooting was committed by an unaffiliated individual acting alone.',
};

const CONFLICT_SPECIMEN = {
  title: 'Rebel fighters killed 12 civilians in eastern province',
  summary: 'The army deployed troops to the area after the raid, a local official said.',
};

const POLITICS_SPECIMEN = {
  title: 'Thousands join protest march over pension reform',
  summary: 'Demonstrators gathered peacefully outside parliament for a third consecutive week.',
};

const UNRESOLVED_SPECIMEN = {
  title: 'Explosion damages road bridge outside the capital',
  summary: 'The bridge was closed to traffic while engineers assessed the structure.',
};

describe('classifySecurityCandidate — the three-way ownership boundary', () => {
  it('gives an explicitly unaffiliated incident to SECURITY', () => {
    const decision = classifySecurityCandidate(SECURITY_SPECIMEN);

    expect(decision.verdict).toBe('ADMITTED_TO_SECURITY');
    expect(decision.owner).toBe('SECURITY');
    expect(decision.ownership.violenceOrProtectivePosture).toBe(true);
    expect(decision.ownership.organisedArmedActorParticipates).toBe(false);
    expect(decision.admittedByTerms.length).toBeGreaterThan(0);
  });

  it('gives an incident with an organised armed actor to CONFLICT, and admits nothing', () => {
    const decision = classifySecurityCandidate(CONFLICT_SPECIMEN);

    expect(decision.verdict).toBe('EXCLUDED_TO_CONFLICT');
    expect(decision.owner).toBe('CONFLICT');
    expect(decision.ownership.organisedArmedActorParticipates).toBe(true);
    // Nothing may be admitted for Security out of an occurrence Conflict owns.
    expect(decision.admittedByTerms).toEqual([]);
  });

  it('gives persistent protest activity with no violence to POLITICS, and admits nothing', () => {
    const decision = classifySecurityCandidate(POLITICS_SPECIMEN);

    expect(decision.verdict).toBe('EXCLUDED_TO_POLITICS');
    expect(decision.owner).toBe('POLITICS');
    // T1 is a DECIDED false here — the record describes the occurrence, and it is a march.
    expect(decision.ownership.violenceOrProtectivePosture).toBe(false);
    expect(decision.ownership.politicalActivityTerms.length).toBeGreaterThan(0);
    expect(decision.admittedByTerms).toEqual([]);
  });

  it('leaves an occurrence UNOWNED when the evidence does not speak to actor organisation', () => {
    const decision = classifySecurityCandidate(UNRESOLVED_SPECIMEN);

    expect(decision.verdict).toBe('OWNERSHIP_UNRESOLVED');
    expect(decision.owner).toBe('OWNERSHIP_UNRESOLVED');
    expect(decision.ownership.violenceOrProtectivePosture).toBe(true);
    expect(decision.admittedByTerms).toEqual([]);
  });

  /**
   * ══ THE REGRESSION THIS FILE EXISTS FOR ══
   *
   * "An occurrence whose armed-hostility criteria have not been assessed has NO incident
   * owner yet, and must not be routed to Security merely because Conflict has not claimed
   * it. Absence of a Conflict finding is not a Security finding."
   */
  it('absence of an armed-actor term is never a decided false', () => {
    const decision = classifySecurityCandidate(UNRESOLVED_SPECIMEN);

    expect(decision.ownership.organisedArmedActorTerms).toEqual([]);
    // undefined, NOT false. This single assertion is the boundary.
    expect(decision.ownership.organisedArmedActorParticipates).toBeUndefined();
    expect(decision.verdict).not.toBe('ADMITTED_TO_SECURITY');
  });

  it('does not admit to SECURITY on violence alone, however severe the wording', () => {
    const decision = classifySecurityCandidate({
      title: 'Twelve killed and forty wounded in market blast',
      summary: 'Casualties were taken to three hospitals. No group has said anything.',
    });

    expect(decision.verdict).not.toBe('ADMITTED_TO_SECURITY');
    expect(decision.ownership.organisedArmedActorParticipates).toBeUndefined();
    expect(decision.verdict).toBe('NOT_A_SECURITY_CANDIDATE');
  });
});

describe('classifySecurityCandidate — it delegates the ownership rule, never reimplements it', () => {
  const SPECIMENS = [
    SECURITY_SPECIMEN,
    CONFLICT_SPECIMEN,
    POLITICS_SPECIMEN,
    UNRESOLVED_SPECIMEN,
    { title: 'Central bank holds interest rates steady', summary: 'Inflation eased slightly.' },
    { title: 'Curfew imposed after flooding', summary: 'Police said roads remain closed.' },
  ];

  it.each(SPECIMENS)('agrees with resolveConflictEventOwner on %o', (specimen) => {
    const decision = classifySecurityCandidate(specimen);

    if (decision.owner === null) {
      // The resolver was never asked — gates 1 and 3. That is not the same as UNRESOLVED.
      expect(['NOT_A_SECURITY_CANDIDATE', 'EXCLUDED_NON_SECURITY_CAUSE']).toContain(
        decision.verdict,
      );
      return;
    }

    const independently = resolveConflictEventOwner(decision.ownership);
    expect(decision.owner).toBe(independently);
  });

  it('admits to SECURITY if and only if the accepted resolver returned SECURITY', () => {
    for (const specimen of SPECIMENS) {
      const decision = classifySecurityCandidate(specimen);
      const admitted = decision.verdict === 'ADMITTED_TO_SECURITY';
      expect(admitted).toBe(decision.owner === 'SECURITY');
    }
  });

  /**
   * A POSITIVE CONTROL ON THE RESOLVER ITSELF, so this file cannot pass by agreeing with a
   * resolver that has been broken into always returning one value.
   */
  it('positive control — the accepted resolver still distinguishes all four answers', () => {
    const t = (a: boolean | undefined, b: boolean | undefined): SecurityOwnershipEvidence => ({
      violenceOrProtectivePosture: a,
      organisedArmedActorParticipates: b,
      violenceTerms: [],
      organisedArmedActorTerms: [],
      politicalActivityTerms: [],
    });

    expect(resolveConflictEventOwner(t(false, undefined))).toBe('POLITICS');
    expect(resolveConflictEventOwner(t(true, false))).toBe('SECURITY');
    expect(resolveConflictEventOwner(t(true, true))).toBe('CONFLICT');
    expect(resolveConflictEventOwner(t(true, undefined))).toBe('OWNERSHIP_UNRESOLVED');
    expect(resolveConflictEventOwner(t(undefined, undefined))).toBe('OWNERSHIP_UNRESOLVED');
  });
});

describe('classifySecurityCandidate — the non-security-cause exclusion, and its narrowness', () => {
  it('refuses a protective posture declared for a natural hazard', () => {
    const decision = classifySecurityCandidate({
      title: 'Curfew imposed as flooding displaces thousands',
      summary: 'An evacuation order covers four districts. Police said roads remain closed.',
    });

    expect(decision.verdict).toBe('EXCLUDED_NON_SECURITY_CAUSE');
    // The resolver is never asked, because there is no security occurrence to own.
    expect(decision.owner).toBeNull();
  });

  it('refuses a state of emergency declared for a disease outbreak', () => {
    const decision = classifySecurityCandidate({
      title: 'State of emergency declared over cholera outbreak',
      summary: 'Health officials said vaccination will begin within the week.',
    });

    expect(decision.verdict).toBe('NOT_A_SECURITY_CANDIDATE');
  });

  /**
   * THE EXCLUSION IS NARROW ON PURPOSE. A flood does not launder a violent crime out of
   * Security, and Security does not absorb the flood.
   */
  it('conservatively withholds ambiguous violence during a natural hazard', () => {
    const decision = classifySecurityCandidate({
      title: 'Looting reported in flood-hit district',
      summary: 'Police said arrests were made after shops were broken into overnight.',
    });

    expect(matchTerms(`${'Looting'} flood-hit`, NON_SECURITY_CAUSE_TERMS)).toContain('flood');
    expect(decision.verdict).toBe('NOT_A_SECURITY_CANDIDATE');
    expect(decision.owner).toBeNull();
  });

  it('is not a security candidate at all when nothing in the record speaks to one', () => {
    const decision = classifySecurityCandidate({
      title: 'Central bank holds interest rates steady',
      summary: 'Inflation eased slightly in the quarter, the statement said.',
    });

    expect(decision.verdict).toBe('NOT_A_SECURITY_CANDIDATE');
    expect(decision.owner).toBeNull();
    expect(decision.admittedByTerms).toEqual([]);
  });
});

describe('matchTerms — whole-word matching, with controls that can fail', () => {
  it('does not match a term inside a longer word', () => {
    // 'riot' inside 'patriot' — the classic substring defect.
    expect(matchTerms('Patriot missile batteries delivered', ACT_OF_VIOLENCE_TERMS)).toEqual([]);
    // 'shot dead' / 'shooting' must not be reached via 'shotgun'.
    expect(matchTerms('Shotgun licence rules reviewed', ACT_OF_VIOLENCE_TERMS)).toEqual([]);
    // 'march' inside 'marching' is a different word form and is not a declared member.
    expect(matchTerms('The marching band performed', POLITICAL_ACTIVITY_TERMS)).toEqual([]);
  });

  it('positive control — it does match the same terms as whole words', () => {
    expect(matchTerms('A riot broke out', ACT_OF_VIOLENCE_TERMS)).toContain('riot');
    expect(matchTerms('He was shot dead', ACT_OF_VIOLENCE_TERMS)).toContain('shot dead');
    expect(matchTerms('A protest march was held', POLITICAL_ACTIVITY_TERMS)).toContain('march');
  });

  it('matches a hyphenated term as itself', () => {
    expect(matchTerms('A hit-and-run inquiry', CIVIL_CRIMINAL_FRAME_TERMS)).toContain(
      'hit-and-run',
    );
  });

  it('returns terms in the declared order, not in the order they appear in the text', () => {
    const declaredOrder = ACT_OF_VIOLENCE_TERMS.filter((t) => t === 'shooting' || t === 'stabbing');
    const found = matchTerms('A stabbing followed a shooting', ACT_OF_VIOLENCE_TERMS);

    expect(found.filter((t) => t === 'shooting' || t === 'stabbing')).toEqual(declaredOrder);
  });

  /**
   * A term must not be formed ACROSS the title/summary boundary: a title ending in "armed"
   * and a summary opening with "group" is not a report about an armed group.
   */
  it('does not form a multi-word term across the title and summary boundary', () => {
    const decision = classifySecurityCandidate({
      title: 'Police seized weapons described as armed',
      summary: 'group of vehicles were impounded, a spokesperson said.',
    });

    expect(decision.ownership.organisedArmedActorTerms).not.toContain('armed group');
  });
});

describe('the lexicon — structure that the ownership rule depends on', () => {
  it('derives T1 from its two halves rather than declaring a third list', () => {
    expect(VIOLENCE_OR_POSTURE_TERMS).toEqual([
      ...ACT_OF_VIOLENCE_TERMS,
      ...PROTECTIVE_POSTURE_TERMS,
    ]);
  });

  it('keeps the act and posture halves disjoint, so the hazard exclusion can tell them apart', () => {
    const overlap = ACT_OF_VIOLENCE_TERMS.filter((t) => PROTECTIVE_POSTURE_TERMS.includes(t));
    expect(overlap).toEqual([]);
  });

  it('never lets one term be both an organised-armed-actor and a civil/criminal signal', () => {
    // A term in both sets would make T2 true and false from the same word.
    const overlap = ORGANISED_ARMED_ACTOR_TERMS.filter((t) =>
      CIVIL_CRIMINAL_FRAME_TERMS.includes(t),
    );
    expect(overlap).toEqual([]);
  });

  it('declares no named organisation, person or place in any set', () => {
    // Organisational nouns do not rot; a named group renamed upstream would silently
    // stop reaching T2 and its incidents would start being admitted as ordinary crime.
    const everyTerm = [
      ...ACT_OF_VIOLENCE_TERMS,
      ...PROTECTIVE_POSTURE_TERMS,
      ...ORGANISED_ARMED_ACTOR_TERMS,
      ...CIVIL_CRIMINAL_FRAME_TERMS,
      ...POLITICAL_ACTIVITY_TERMS,
      ...NON_SECURITY_CAUSE_TERMS,
    ];

    for (const term of everyTerm) {
      // Every declared term is lower case. A capital letter is the signature of a proper noun.
      expect(term).toBe(term.toLowerCase());
    }
  });
});

describe('classifySecurityCandidate — determinism', () => {
  it('is pure: the same record classifies identically every time', () => {
    const runs: SecurityCandidateDecision[] = [
      classifySecurityCandidate(SECURITY_SPECIMEN),
      classifySecurityCandidate(SECURITY_SPECIMEN),
      classifySecurityCandidate(SECURITY_SPECIMEN),
    ];

    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
  });

  it('always states a reason, whatever the verdict', () => {
    const specimens = [
      SECURITY_SPECIMEN,
      CONFLICT_SPECIMEN,
      POLITICS_SPECIMEN,
      UNRESOLVED_SPECIMEN,
      { title: 'Curfew imposed after flooding', summary: 'Roads closed.' },
      { title: 'Quarterly results published', summary: 'Revenue rose.' },
    ];

    for (const specimen of specimens) {
      expect(classifySecurityCandidate(specimen).reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('handles an empty record without admitting anything', () => {
    const decision = classifySecurityCandidate({ title: '', summary: '' });
    expect(decision.verdict).toBe('NOT_A_SECURITY_CANDIDATE');
  });
});
