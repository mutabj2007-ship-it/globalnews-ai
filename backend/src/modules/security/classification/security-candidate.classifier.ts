/** R2 conservative retained-text classifier. See docs/security-r2/REPORT.md for limits. */
import {
  resolveConflictEventOwner,
  type ConflictEventOwner,
  type SecurityOwnershipEvidence,
} from '@globalnews-ai/shared';
import {
  ACT_OF_VIOLENCE_TERMS,
  CIVIL_CRIMINAL_FRAME_TERMS,
  matchTerms,
  NON_SECURITY_CAUSE_TERMS,
  ORGANISED_ARMED_ACTOR_TERMS,
  POLITICAL_ACTIVITY_TERMS,
  PROTECTIVE_POSTURE_TERMS,
} from './security-incident.lexicon';

export type SecurityCandidateVerdict =
  | 'ADMITTED_TO_SECURITY'
  | 'EXCLUDED_TO_POLITICS'
  | 'EXCLUDED_TO_CONFLICT'
  | 'OWNERSHIP_UNRESOLVED'
  | 'EXCLUDED_NON_SECURITY_CAUSE'
  | 'NOT_A_SECURITY_CANDIDATE';

export interface SecurityCandidateDecision {
  readonly verdict: SecurityCandidateVerdict;

  readonly reason: string;

  readonly owner: ConflictEventOwner | null;

  readonly ownership: SecurityOwnershipEvidence;

  readonly admittedByTerms: readonly string[];
}

export interface SecurityCandidateInput {
  readonly title: string;
  readonly summary: string;
}

function dedupeInOrder(groups: readonly (readonly string[])[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const term of group) {
      if (!seen.has(term)) {
        seen.add(term);
        out.push(term);
      }
    }
  }
  return out;
}

export function classifySecurityCandidate(
  input: SecurityCandidateInput,
): SecurityCandidateDecision {
  const text = `${input.title}\n${input.summary}`;

  // Conservative candidate gate: uncertain, denied, hypothetical or accidental text is not
  // affirmative incident evidence. False negatives remain an explicit coverage limitation.
  const nonAffirmative =
    /\b(no|not|never|denied|denies|deny|false|hoax|alleged|rumou?r|unconfirmed|possible|might|may|could|prevented|averted|drill|exercise|simulation)\b/i.test(
      text,
    );
  const accident =
    /\b(accident|accidental|crash|collision|collided|drowned|capsized|collapse|earthquake|flood|wildfire|outbreak)\b/i.test(
      text,
    );
  const acts = nonAffirmative || accident ? [] : matchTerms(text, ACT_OF_VIOLENCE_TERMS);
  const postures = nonAffirmative || accident ? [] : matchTerms(text, PROTECTIVE_POSTURE_TERMS);
  const armed = matchTerms(text, ORGANISED_ARMED_ACTOR_TERMS);
  const civil = matchTerms(text, CIVIL_CRIMINAL_FRAME_TERMS);
  const political = matchTerms(text, POLITICAL_ACTIVITY_TERMS);
  const nonSecurity = matchTerms(text, NON_SECURITY_CAUSE_TERMS);

  const t1Terms = dedupeInOrder([acts, postures]);

  if (t1Terms.length === 0 && political.length === 0) {
    return {
      verdict: 'NOT_A_SECURITY_CANDIDATE',
      reason:
        'No violence term, no protective-posture term and no political-activity term. The ' +
        'record does not speak to a security occurrence, and nothing is inferred from its ' +
        'silence.',
      owner: null,
      ownership: {
        violenceOrProtectivePosture: undefined,
        organisedArmedActorParticipates: undefined,
        violenceTerms: [],
        organisedArmedActorTerms: armed,
        politicalActivityTerms: [],
      },
      admittedByTerms: [],
    };
  }

  if (t1Terms.length === 0) {
    const ownership: SecurityOwnershipEvidence = {
      violenceOrProtectivePosture: false,
      organisedArmedActorParticipates: undefined,
      violenceTerms: [],
      organisedArmedActorTerms: armed,
      politicalActivityTerms: political,
    };
    const owner = resolveConflictEventOwner(ownership);
    return {
      verdict: 'EXCLUDED_TO_POLITICS',
      reason:
        `Political activity (${political.join(', ')}) with no violence and no protective ` +
        'posture. Below T1 the accepted ownership rule gives the occurrence to POLITICS, ' +
        'which owns the persistent Protest Campaign and its political lifecycle. Security ' +
        'holds no facet of it.',
      owner,
      ownership,
      admittedByTerms: [],
    };
  }

  if (nonSecurity.length > 0 && acts.length === 0) {
    return {
      verdict: 'EXCLUDED_NON_SECURITY_CAUSE',
      reason:
        `A non-security cause (${nonSecurity.join(', ')}) with no act of violence; the only ` +
        `T1 evidence is a protective posture (${postures.join(', ')}). A posture declared ` +
        'for a natural hazard, an accident or a disease is not a Security occurrence, and a ' +
        'newspaper reporting a curfew is not an authority issuing one.',
      owner: null,
      ownership: {
        violenceOrProtectivePosture: undefined,
        organisedArmedActorParticipates: undefined,
        violenceTerms: t1Terms,
        organisedArmedActorTerms: armed,
        politicalActivityTerms: political,
      },
      admittedByTerms: [],
    };
  }

  const organisedArmedActorParticipates =
    armed.length > 0
      ? true
      : /\b(?:shooting|stabbing|armed robbery|assault|arson|kidnapping|attack)\s+(?:was\s+)?(?:committed|carried out|perpetrated)\s+by\s+(?:an\s+)?unaffiliated\s+individual\s+acting\s+alone\b/i.test(
            text,
          )
        ? false
        : undefined;

  const ownership: SecurityOwnershipEvidence = {
    violenceOrProtectivePosture: true,
    organisedArmedActorParticipates,
    violenceTerms: t1Terms,
    organisedArmedActorTerms: armed,
    politicalActivityTerms: political,
  };

  const owner = resolveConflictEventOwner(ownership);

  switch (owner) {
    case 'SECURITY':
      return {
        verdict: 'ADMITTED_TO_SECURITY',
        reason:
          `T1 met (${t1Terms.join(', ')}) and the report explicitly describes an unaffiliated ` +
          'individual committing this incident. The accepted ownership rule gives the incident facet to ' +
          'SECURITY.',
        owner,
        ownership,
        admittedByTerms: dedupeInOrder([t1Terms, civil]),
      };

    case 'CONFLICT':
      return {
        verdict: 'EXCLUDED_TO_CONFLICT',
        reason:
          `T1 met (${t1Terms.join(', ')}) and an organised armed actor is named ` +
          `(${armed.join(', ')}). At or above T2 the accepted ownership rule gives the ` +
          'incident to CONFLICT, which assesses its own criteria. Security asserts nothing ' +
          'about them and holds no incident facet here.',
        owner,
        ownership,
        admittedByTerms: [],
      };

    case 'OWNERSHIP_UNRESOLVED':
      return {
        verdict: 'OWNERSHIP_UNRESOLVED',
        reason:
          `T1 met (${t1Terms.join(', ')}), and the record says nothing about whether an ` +
          'organised armed actor participated. That silence is the ABSENCE OF EVIDENCE about ' +
          'actor organisation, not evidence of its absence, so T2 is UNDETERMINED and no ' +
          'domain owns the incident facet yet. Security does not take it by default.',
        owner,
        ownership,
        admittedByTerms: [],
      };

    case 'POLITICS':
      return {
        verdict: 'EXCLUDED_TO_POLITICS',
        reason:
          'The accepted resolver returned POLITICS on met T1 evidence. This combination is ' +
          'not reachable from the thresholds above; it is reported rather than reinterpreted, ' +
          'because reinterpreting an owner the accepted rule returned is how a domain ' +
          'quietly acquires a facet it was not given.',
        owner,
        ownership,
        admittedByTerms: [],
      };
  }
}
