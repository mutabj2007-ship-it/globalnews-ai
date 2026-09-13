import { questionKind, type QuestionKind } from '@globalnews-ai/shared';
import { foldTokens } from '../../geo/geo-normalize.util';
import type { ApprovedKindMapping, FormationSignals } from './claim-request.contract';

/**
 * RATIFIED MAPPING VERSION **HOSTILITY-EN-PL-v1-R3**.
 *
 * Ratified by the Product Owner against P3-CONTRACT-R1
 * (sha256 50fc18660642bc8e8b8d0f46e597bd5b4f1955789b6a5bd04c86cba36a613072), derived against
 * authoritative C17 (6B2E35481FB8B1885A0472A260EC1D688D2B05DB8D18B9AB4DD8868C7F4D5654, 956 files).
 *
 * THE ALLOWED SHAPE, AND THE FORBIDDEN ONE.
 *     FORBIDDEN   security keyword -> CONFLICT
 *     ALLOWED     approved hostility evidence -> hostility QuestionKinds -> P2 resolves owner
 * Nothing in this file names a domain. It emits three CANONICAL kinds; who owns them is P2's answer.
 *
 * ENTRIES ARE STORED FOLDED, and the fold is not uniform across Polish:
 *     a c e n o s z z   <- from  a-ogonek, c-acute, e-ogonek, n-acute, o-acute, s-acute, z-acute, z-dot
 *     l-stroke SURVIVES  -- U+0142 is its own letter and has no NFD decomposition
 * So `dzialan zbrojnych` carries a folded n while `ostrzal artyleryjski` keeps its stroked l.
 * A reviewer seeing `starc zbrojnych` is not seeing a typo: it is the fold of `starc-acute zbrojnych`.
 *
 * MATCHING IS BY TOKEN SEQUENCE, NEVER SUBSTRING. Substring matching is what would turn `walk` into a
 * match inside `walkower` and `war` into a match inside `warehouse`.
 *
 * BOTH LEXICONS ARE EVALUATED UNCONDITIONALLY. No language signal exists and none was added: adding
 * one would be signal-set expansion requiring separate ratification. No Polish entry token is an
 * English word and no English entry is Polish, so the two cannot cross-fire.
 *
 * NO EXCLUSION LIST EXISTS, BY RULING. Precision is achieved by admitting only entries that are
 * adjective-qualified or have no civilian sense. Bare `fighting`, `walki`, `insurgency`, `war`,
 * `war crimes`, `rozejm`, `starcia`, `nalot`, `linia frontu`, `ostrzal`, `bojownicy`, `rebelianci`,
 * `insurgents` and `militants` are all deliberately ABSENT. Recall lost that way returns as an
 * honest INTENT_UNFORMED, which is preferred to a wrong specialist handoff.
 */

/** EN — 19 entries, ordinal-sorted, folded. */
export const HOSTILITY_EVIDENCE_EN: readonly string[] = [
  'aerial bombardment',
  'air strike',
  'air strikes',
  'airstrike',
  'airstrikes',
  'armed clash',
  'armed clashes',
  'armed conflict',
  'armed groups',
  'armed insurgency',
  'armed insurgents',
  'armed militants',
  'artillery bombardment',
  'cease fire',
  'ceasefire',
  'civil war',
  'hostilities',
  'shelling',
  'war zone',
];

/** PL — 41 entries, ordinal-sorted, folded per the l-stroke rule above. */
export const HOSTILITY_EVIDENCE_PL: readonly string[] = [
  'działan wojennych',
  'działan zbrojnych',
  'działania wojenne',
  'działania zbrojne',
  'działaniach wojennych',
  'działaniach zbrojnych',
  'działaniami wojennymi',
  'działaniami zbrojnymi',
  'konflikcie zbrojnym',
  'konflikt zbrojny',
  'konfliktach zbrojnych',
  'konfliktem zbrojnym',
  'konfliktow zbrojnych',
  'konfliktu zbrojnego',
  'konflikty zbrojne',
  'nalot lotniczy',
  'nalotach lotniczych',
  'nalotow lotniczych',
  'nalotu lotniczego',
  'naloty lotnicze',
  'ostrzale artyleryjskim',
  'ostrzale rakietowym',
  'ostrzał artyleryjski',
  'ostrzał rakietowy',
  'ostrzałem artyleryjskim',
  'ostrzałem rakietowym',
  'ostrzału artyleryjskiego',
  'ostrzału rakietowego',
  'starc zbrojnych',
  'starcia zbrojne',
  'starciach zbrojnych',
  'starciami zbrojnymi',
  'wojen domowych',
  'wojna domowa',
  'wojne domowa',
  'wojnie domowej',
  'wojny domowej',
  'zawieszenia broni',
  'zawieszenie broni',
  'zawieszeniem broni',
  'zawieszeniu broni',
];

/** Which lexicon supplied the evidence. Audit only; it is never a routing input. */
export type HostilityEvidenceLexicon = 'EN' | 'PL';

export interface HostilityEvidence {
  readonly lexicon: HostilityEvidenceLexicon;
  /** The exact ratified entry that matched. */
  readonly entry: string;
}

const EN_TOKENS: readonly (readonly string[])[] = HOSTILITY_EVIDENCE_EN.map((e) => e.split(' '));
const PL_TOKENS: readonly (readonly string[])[] = HOSTILITY_EVIDENCE_PL.map((e) => e.split(' '));

function containsSequence(haystack: readonly string[], needle: readonly string[]): boolean {
  const limit = haystack.length - needle.length;
  for (let start = 0; start <= limit; start += 1) {
    let hit = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        hit = false;
        break;
      }
    }
    if (hit) {
      return true;
    }
  }
  return false;
}

/**
 * Positive evidence, or nothing. There is no negative result and no confidence: the return is the
 * matching entry or `undefined`.
 */
export function detectHostilityEvidence(normalizedQuery: string): HostilityEvidence | undefined {
  const tokens = foldTokens(normalizedQuery);
  if (tokens.length === 0) {
    return undefined;
  }
  for (let i = 0; i < EN_TOKENS.length; i += 1) {
    if (containsSequence(tokens, EN_TOKENS[i])) {
      return { lexicon: 'EN', entry: HOSTILITY_EVIDENCE_EN[i] };
    }
  }
  for (let i = 0; i < PL_TOKENS.length; i += 1) {
    if (containsSequence(tokens, PL_TOKENS[i])) {
      return { lexicon: 'PL', entry: HOSTILITY_EVIDENCE_PL[i] };
    }
  }
  return undefined;
}

/**
 * The three canonical kinds this version emits, TOGETHER, ALWAYS.
 *
 * Minted here from the platform's own `questionKind`, NOT imported from any domain module — P3 must
 * not depend on a domain. They are canonical kinds that a domain happens to claim, not that domain's
 * property.
 */
export const HOSTILITY_KINDS: readonly QuestionKind[] = [
  questionKind('HOSTILITY_SEVERITY'),
  questionKind('HOSTILITY_PARTICIPANTS'),
  questionKind('HOSTILITY_ESCALATION'),
];

/**
 * Provenance recorded for the version, as ruled — separately from what `derive` reads.
 * NONE of this is an input to `derive`. It is a record, so that a routing decision made months from
 * now can be explained: this baseline, this authority, these canonical kinds.
 */
export const HOSTILITY_MAPPING_PROVENANCE = {
  baselineFingerprint: '6B2E35481FB8B1885A0472A260EC1D688D2B05DB8D18B9AB4DD8868C7F4D5654',
  designAuthoritySha256: '50b4b882576e76722eb57044de80289a5559b64dc0b6832ba838605902b90acd',
  canonicalKindsAtRatification: ['HOSTILITY_SEVERITY', 'HOSTILITY_PARTICIPANTS', 'HOSTILITY_ESCALATION'],
} as const;

/**
 * `requiresContext` is EMPTY: this version's evidence is the subject signal alone. Absent geography,
 * object or time therefore does not force INSUFFICIENT_CONTEXT — they are carried as absent into the
 * handoff, and the winning domain handles them honestly.
 */
export const HOSTILITY_MAPPING_V1R3: ApprovedKindMapping = {
  version: 'HOSTILITY-EN-PL-v1-R3',
  approvedAgainstSha256: '50fc18660642bc8e8b8d0f46e597bd5b4f1955789b6a5bd04c86cba36a613072',
  requiresContext: [],
  derive(signals: FormationSignals): readonly QuestionKind[] {
    return signals.subjectIsHostility === true ? HOSTILITY_KINDS : [];
  },
};
