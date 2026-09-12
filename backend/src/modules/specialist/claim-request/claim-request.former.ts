import { normalizeQuery } from '@globalnews-ai/shared';
import { resolveGeography, type GeoResolution } from '../../geo/geo-resolver';
import type {
  ApprovedKindMapping,
  ClaimRequestFormation,
  ClaimRequestFormationInput,
  FormationSignals,
  MissingContext,
} from './claim-request.contract';
import { HOSTILITY_MAPPING_V1R3, detectHostilityEvidence } from './hostility-evidence.v1r3';

/**
 * P3 — THE FORMER.
 *
 * A PURE FUNCTION, NOT A NEST PROVIDER. P2 needed Nest because its registry holds state with a
 * process lifetime; P3 holds none. Making this a plain exported function is what makes routing rule
 * 7 ("routing is deterministic and costs no user AI") true of the CALL SITE and not merely of a
 * library, and it lets tests supply a mapping without a testing module.
 *
 * REUSE, NOT RE-IMPLEMENTATION, AND ONLY WHERE THE SEMANTICS ARE GENERIC:
 *   normalizeQuery    shared           pure string normalization
 *   foldTokens        modules/geo      generic Unicode folding (via the evidence module)
 *   resolveGeography  modules/geo      THE canonical navigator, which documents itself as serving
 *                                      two callers with genuinely different needs
 *
 * AND ONE DELIBERATE NON-REUSE: `classifyQueryIntent` is NOT imported, NOT copied, and nothing here
 * depends on it. It is Analysis-owned RETRIEVAL-PLANNING logic — its own header says it decides "the
 * retrieval SHAPE a question gets", `MAX_SIDES` is a provider fan-out budget, and one of its classes
 * is defined by an AnalysisService decision. A router adopting it would inherit a provider budget as
 * a routing rule.
 */

/**
 * Geography is resolved here ONLY when the navigator did not already resolve it. Two resolutions of
 * one place is how two answers to one question happen.
 *
 * `requireGeographicContext: true` is not optional: the resolver documents this flag as the
 * difference between an article ("Rwanda announced...") and a USER QUERY ("University of Chad").
 * P3 forms requests from user queries, and defaulting it would resolve Chad from a university name.
 *
 * `contextCountryIso3` is NEVER supplied. The resolver's own rule is that it breaks ties and never
 * manufactures a location; P3 has no tie to break and nothing to manufacture from.
 */
function geographyFor(input: ClaimRequestFormationInput): GeoResolution | undefined {
  if (input.navigator.geography !== undefined) {
    return input.navigator.geography;
  }
  return resolveGeography(input.rawText, { requireGeographicContext: true });
}

function missingFor(
  required: readonly MissingContext[],
  signals: FormationSignals,
  hasGeography: boolean,
): readonly MissingContext[] {
  return required.filter((context) => {
    if (context === 'GEOGRAPHY') {
      return !hasGeography;
    }
    if (context === 'OBJECT') {
      return signals.objectType === undefined;
    }
    // 'TIME_WINDOW' — no platform TimeWindow contract exists, so it is always absent. P3 does not
    // define one, and a version that required it could not be satisfied today. That is honest.
    return true;
  });
}

/**
 * Form a claim request, or say honestly that none could be formed.
 *
 * Pure: same input, same output. No clock, no I/O, no provider, no model.
 */
export function formClaimRequest(
  input: ClaimRequestFormationInput,
  mapping: ApprovedKindMapping = HOSTILITY_MAPPING_V1R3,
): ClaimRequestFormation {
  const normalized = normalizeQuery(input.rawText).normalizedQuery;
  const evidence = detectHostilityEvidence(normalized);
  const geography = geographyFor(input);

  // POSITIVE EVIDENCE ONLY. The field is `true` or absent; there is no `false` to set, because "no
  // recognised evidence" is not a finding that the question is not about hostility.
  const signals: FormationSignals = {
    ...(evidence === undefined ? {} : { subjectIsHostility: true as const }),
    ...(input.navigator.object === undefined ? {} : { objectType: input.navigator.object.objectType }),
    ...(geography === undefined ? {} : { geographyPrecision: geography.precision }),
    ...(geography?.provenance === undefined ? {} : { geographyProvenance: geography.provenance }),
  };

  const candidateKinds = mapping.derive(signals);
  const provenance = { mappingVersion: mapping.version, signals } as const;

  if (candidateKinds.length === 0) {
    // Carries no kinds and no request, so an empty-kinds call to P2 cannot be constructed.
    return { status: 'INTENT_UNFORMED', reason: 'NO_MAPPING_MATCHED' };
  }

  const missing = missingFor(mapping.requiresContext, signals, geography !== undefined);
  if (missing.length > 0) {
    // Carries NO request, so partial context structurally cannot route.
    return { status: 'INSUFFICIENT_CONTEXT', candidateKinds, missing, provenance };
  }

  return {
    status: 'FORMED',
    request: {
      candidateKinds,
      // Absent stays absent. Geography is never defaulted to "global", time never to "now", and the
      // object type is never substituted. Provenance is carried unflattened: an INTERPRETED place
      // must never reach a domain as though the user had STATED it.
      ...(signals.objectType === undefined ? {} : { objectType: signals.objectType }),
      ...(geography === undefined ? {} : { geography }),
    },
    provenance,
  };
}
