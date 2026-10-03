import { readFileSync, writeFileSync } from 'node:fs';
import type { AskRequest, Language } from './ask-compute.contract';
import { AskR2ExecutionAdapter, routeFor } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import { conversationOf } from './ask-v2.service';
import { readConversationalTurn } from './conversation/conversation-state';
import type { AskR2Route } from '../ask-router/ask-r2-route';
import { answerStateBeforeExecution } from '../ask-router/answer-state';
import { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import { OpenAiGeneralBackgroundProvider } from '../analysis/providers/general-background.provider';
import { newAskObservationDraft } from '../ask-observability/ask-observation.contract';
import { USER_JOBS } from '../ask-router/user-job';
import { semanticReaderText } from '../ask-router/semantic-ir/interpret-turn';
import { validateSemanticTurnIR } from '../ask-router/semantic-ir/semantic-turn-ir';
import { isSemanticFirstLanguage } from '../ask-router/semantic-ir/semantic-first';
import type { SemanticResolution } from '../ask-router/semantic-ir/semantic-interpreter';
import type { PlannerDeps } from '../ask-router/frozen-c/src/planner';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEVEN-LANGUAGE RELIABILITY BATTERY — THE FROZEN SCORER (hashed before the first call)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Runs ONLY with SEVEN_SET (the frozen battery), SEVEN_REPORT (output) and SEVEN_ENV (a local .env:
 * only OPENAI_API_KEY / OPENAI_MODEL are read, in-process, never printed).
 *
 * THE PRODUCTION PATH, per item: the request is built as the service builds it (EN / PL: the
 * deterministic conversation state from the reader's earlier turns; FR–AR: the reader's earlier
 * turns verbatim), routed with the adapter's own `routeFor` and planner deps, and the ONE bounded
 * interpretation is made through the adapter's own `interpretSemantics` (switches, breaker, meter,
 * provider, validation) ONLY when the IR requires it and no zero-AI terminal applies — exactly the
 * executor's rule. The final route is recomposed with the verdict (or the governed fallback).
 * No news provider exists in this harness.
 *
 * THREE SCORES PER LANGUAGE, NEVER ONE PERCENTAGE:
 *   A  CORRECTNESS — final route vs the frozen expectation: currentness, MIXED, job, named
 *                    countries (localized entity resolution), actors, venue, object, reference,
 *                    objective
 *   B  VALIDITY    — per interpreter call: JSON, closed keys, schema, self-consistency, no prose /
 *                    facts, no invented entity / objective; usable = accepted (no fallback)
 *   C  SAFETY      — final route: no conceptual → news, no clearly current → timeless; accepted IR
 *                    invalid / contradictory; verdict ignored; P0 caused by an interpreter failure
 * COST PER LANGUAGE: turns, deterministic %, interpreter %, tokens, latency, rejection, fallback, P0.
 * REPEATABILITY: 20 frozen items (5 FR–AR languages × 4 ambiguity families), three runs each.
 * ANSWER LANGUAGE: the five Prime Moment items are answered end to end through `execute` with the
 * real background provider (no news provider; a reasoning answer only) and the answer's language,
 * Unicode integrity and numerals are recorded.
 */
const SET = process.env.SEVEN_SET;
const REPORT = process.env.SEVEN_REPORT;
const ENV = process.env.SEVEN_ENV;
const live = SET && REPORT && ENV ? it : it.skip;
jest.setTimeout(7_200_000);

interface Item {
  id: string;
  family: string;
  language: Language;
  turn: string;
  state: {
    artifact?: { kind: string; label: string };
    priorReaderTurns?: string[];
    /* the EN / PL reliability set's bounded state (structured, the reader's words) */
    objective?: string;
    choiceSet?: string[];
    portableSubject?: string;
  };
  expect: {
    needsCurrentEvidence: boolean | 'either';
    mixed: boolean;
    jobs: string[];
    countries?: string[];
    actors: [string, string] | null;
    venue: string | null;
    object: string | null;
    reference: string | null;
    objective?: string | null;
    clearlyConceptual: boolean;
    clearlyCurrent: boolean;
    ambiguous?: boolean;
  };
}

const KEYS_EN_PL = new Set([
  'job',
  'needsCurrentEvidence',
  'depth',
  'transformation',
  'confidence',
  'clauses',
  'relation',
  'reference',
]);
const KEYS_FIRST = new Set([
  'job',
  'needsCurrentEvidence',
  'temporalRole',
  'depth',
  'transformation',
  'confidence',
  'parts',
  'relation',
  'reference',
  'objective',
]);
const REPEAT_FAMILIES = ['ambiguous', 'mixed', 'actor_venue', 'injection'];
const SF: readonly Language[] = ['fr', 'de', 'es', 'pt', 'ar'];

function readSecrets(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(OPENAI_API_KEY|OPENAI_MODEL)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const pct = (xs: number[], p: number): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const fold = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const overlaps = (a: string, b: string) => fold(a).includes(fold(b)) || fold(b).includes(fold(a));

/* a deterministic language identification of an ANSWER (script + function words), for the record */
const FUNCTION_WORDS: Record<string, readonly string[]> = {
  en: ['the', 'and', 'is', 'of', 'to', 'that', 'with', 'are', 'this', 'for'],
  pl: ['się', 'nie', 'jest', 'że', 'i', 'w', 'na', 'to', 'jak', 'oraz'],
  fr: ['le', 'les', 'des', 'est', 'et', 'une', 'dans', 'que', 'pour', 'qui', 'pas', 'plus'],
  de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'mit', 'ein', 'eine', 'auch', 'sich', 'werden'],
  es: ['el', 'los', 'las', 'y', 'es', 'que', 'una', 'por', 'para', 'del', 'pero', 'más', 'también'],
  pt: ['os', 'as', 'é', 'que', 'uma', 'não', 'para', 'com', 'do', 'da', 'mais', 'também', 'são'],
};
function identifyLanguage(text: string): string {
  const letters = text.match(/\p{L}/gu) ?? [];
  const arabic = text.match(/[؀-ۿ]/g) ?? [];
  if (letters.length > 0 && arabic.length / letters.length > 0.5) return 'ar';
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let best = 'unknown';
  let bestScore = 0;
  for (const [lang, fw] of Object.entries(FUNCTION_WORDS)) {
    const score = words.filter((w) => fw.includes(w)).length;
    if (score > bestScore) [best, bestScore] = [lang, score];
  }
  return best;
}

live(
  'R4 seven-language battery — production path, three scores per language, cost, repeatability, answer language',
  async () => {
    const set = JSON.parse(readFileSync(SET!, 'utf8').replace(/^﻿/, '')) as {
      items: Item[];
      primeMoment: Item[];
    };
    const secrets = readSecrets(ENV!);
    const config = new AnalysisConfigService({ get: (k: string) => secrets[k] } as never);
    const provider = new OpenAiGeneralBackgroundProvider(config);
    /* SEVEN_DRY=1 — harness mechanics only: no network, every interpretation falls back */
    const dry = process.env.SEVEN_DRY === '1';
    let lastRaw: string | null = null;
    const accounting = {
      reserve: 0,
      settle: 0,
      breaker: {} as Record<string, number>,
      interpreterCalls: 0,
      answerCalls: 0,
      newsCalls: 0,
    };
    const recording = {
      id: provider.id,
      displayName: provider.displayName,
      isMock: false,
      answerBackground: async (
        input: Parameters<OpenAiGeneralBackgroundProvider['answerBackground']>[0],
      ) => {
        accounting.answerCalls++;
        if (dry) return { text: 'dry' };
        return provider.answerBackground(input);
      },
      completeStructured: async (
        input: Parameters<OpenAiGeneralBackgroundProvider['completeStructured']>[0],
      ) => {
        lastRaw = null;
        accounting.interpreterCalls++;
        if (dry) return '{}';
        const out = await provider.completeStructured(input);
        lastRaw = out;
        return out;
      },
    };
    const adapter = new AskR2ExecutionAdapter(
      {
        analyzeNews: async () => {
          accounting.newsCalls++;
          throw new Error('no news provider in the seven-language battery');
        },
      } as never,
      { id: 'none', displayName: 'none', isMock: true, analyzeNews: jest.fn() } as never,
      recording as never,
      {
        config: { outputWeight: 4 },
        reserve: async () => (
          accounting.reserve++,
          { admitted: true as const, reservationId: `r${accounting.reserve}`, estimatedUnits: 1 }
        ),
        settle: async () => (accounting.settle++, true),
      } as never,
      {
        permit: async () => ({ allowed: true, trial: false, state: 'CLOSED' as const }),
        record: async (_p: string, outcome: string) =>
          void (accounting.breaker[outcome] = (accounting.breaker[outcome] ?? 0) + 1),
      } as never,
      { isEnabled: async () => true } as never,
      config,
      { registeredDomains: () => [] } as never,
      { record: async () => true } as never,
      {
        boundSpecialistDomains: () => [],
        read: async () => ({ considered: [], contributions: [] }),
      } as never,
    );
    const deps = (adapter as unknown as { deps: PlannerDeps }).deps;
    const priorQuestionOf = (item: Item) =>
      item.state.priorReaderTurns?.[item.state.priorReaderTurns.length - 1];
    const inRequest = <T>(item: Item, work: () => Promise<T>) =>
      askRequestContext.run(
        {
          accountId: 'battery',
          ipScope: 'ip:v4:192.0.2.1',
          ...(priorQuestionOf(item) ? { priorQuestion: priorQuestionOf(item) } : {}),
        } as never,
        work,
      );

    /* the request exactly as the service builds it from the reader's own thread */
    const requestOf = (item: Item): AskRequest => {
      const earlierNewestFirst = [...(item.state.priorReaderTurns ?? [])]
        .reverse()
        .map((question) => ({ question, language: item.language }));
      const first = isSemanticFirstLanguage(item.language);
      const conversational = first
        ? null
        : readConversationalTurn(item.turn, item.language, earlierNewestFirst);
      const composed = conversational?.composition ?? null;
      return {
        question: composed?.effectiveQuestion ?? item.turn,
        language: item.language,
        intent: 'ask',
        ...conversationOf(conversational),
        ...(item.state.objective === undefined &&
        item.state.choiceSet === undefined &&
        item.state.portableSubject === undefined
          ? {}
          : {
              conversation: {
                officialSourcesOnly: false,
                constraintOnly: false,
                trace: {
                  job: 'UNKNOWN',
                  ownJob: 'UNKNOWN',
                  carried: [],
                  overridden: [],
                  reset: false,
                  composed: null,
                  subject: item.state.portableSubject ?? null,
                },
                ...(item.state.objective === undefined
                  ? {}
                  : { objective: { text: item.state.objective, sourceTurn: 0, inherited: true } }),
                ...(item.state.choiceSet === undefined ? {} : { choiceSet: item.state.choiceSet }),
              },
            }),
        ...(item.state.artifact === undefined
          ? {}
          : {
              priorArtifact: {
                ...item.state.artifact,
                components: [],
                provenance: 'MODEL_REASONING' as const,
                citable: false as const,
                sourceOperationId: 'battery',
              },
            }),
        ...(first && earlierNewestFirst.length > 0
          ? {
              readerTurns: earlierNewestFirst
                .slice(0, 3)
                .map((t) => t.question)
                .reverse(),
            }
          : {}),
      } as AskRequest;
    };
    const routeOf = (item: Item, request: AskRequest, verdict?: SemanticResolution): AskR2Route =>
      inRequestSync(item, () => routeFor(request, deps, verdict));
    function inRequestSync<T>(item: Item, work: () => T): T {
      return askRequestContext.run(
        {
          accountId: 'battery',
          ipScope: 'ip:v4:192.0.2.1',
          ...(priorQuestionOf(item) ? { priorQuestion: priorQuestionOf(item) } : {}),
        } as never,
        work,
      );
    }
    const plansNews = (r: AskR2Route) =>
      r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING') &&
      r.plan.terminalState !== 'REFERENCE_BACKGROUND_ONLY';

    /* ONE production-path turn */
    async function turnOnce(item: Item) {
      const request = requestOf(item);
      const route0 = routeOf(item, request);
      const draft = newAskObservationDraft('seven-language', item.language);
      const early0 = answerStateBeforeExecution(route0.plan);
      const escalates =
        route0.semantic.resolution.needsSemanticResolution &&
        (early0 === null || early0.state === 'REFERENCE_BACKGROUND');
      let run: {
        verdict: SemanticResolution;
        calls: number;
        source: 'SEMANTIC' | 'FALLBACK';
        tokens?: { promptTokens: number; completionTokens: number } | null;
      } | null = null;
      let error: string | null = null;
      const t0 = Date.now();
      if (escalates) {
        try {
          run = await inRequest(item, () =>
            (
              adapter as unknown as {
                interpretSemantics: (
                  r: AskRequest,
                  ro: AskR2Route,
                  d: unknown,
                ) => Promise<NonNullable<typeof run>>;
              }
            ).interpretSemantics(request, route0, draft),
          );
        } catch (e) {
          error = (e as Error).message.slice(0, 120);
          run = { verdict: { path: 'FALLBACK' }, calls: 1, source: 'FALLBACK' };
        }
      }
      const latencyMs = Date.now() - t0;
      const final = run === null ? route0 : routeOf(item, request, run.verdict);
      return {
        request,
        route0,
        run,
        final,
        raw: run === null ? null : lastRaw,
        latencyMs,
        error,
        escalates,
      };
    }

    const tupleOf = (r: AskR2Route) => ({
      job: r.job.job ?? null,
      freshness: r.semantic.turn.freshness,
      evidence: r.semantic.turn.evidence,
      newsPlanned: plansNews(r) && r.semanticClarification !== true,
      actors: [...(r.relationship?.countries ?? [])].sort().join('+') || null,
      relationship: r.relationship === null ? null : (r.relationship.relations[0] ?? null),
      objective: r.decisionObjective,
      reference: r.semantic.references.target,
      clarification: r.semanticClarification === true,
    });

    const rows: Array<Record<string, unknown>> = [];
    const stability: Array<Record<string, unknown>> = [];
    const repeatFamilies = process.env.SEVEN_REPEAT_FAMILIES?.split(',').filter(Boolean);
    const repeatIds = new Set(
      repeatFamilies !== undefined
        ? repeatFamilies.flatMap((fam) =>
            set.items
              .filter((i) => i.family === fam)
              .slice(0, 2)
              .map((i) => i.id),
          )
        : SF.flatMap((lang) =>
            REPEAT_FAMILIES.map(
              (f) => set.items.find((i) => i.language === lang && i.family === f)?.id,
            ).filter((x): x is string => x !== undefined),
          ),
    );
    /* SEVEN_REPEAT_IDS — named items always in the repeat subset (CTO run-3 §5: the rate-hike family) */
    for (const id of process.env.SEVEN_REPEAT_IDS?.split(',').filter(Boolean) ?? [])
      repeatIds.add(id);
    const items = [
      ...set.items,
      ...(set.primeMoment ?? []).map((p) => ({ ...p, family: 'prime_moment' })),
    ];

    for (const item of items) {
      const { request, route0, run, final, raw, latencyMs, error, escalates } =
        await turnOnce(item);
      const first = isSemanticFirstLanguage(item.language);
      const readerText = semanticReaderText(request.question, item.language);
      const earlier = item.state.priorReaderTurns ?? [];

      /* B — validity of the RAW interpreter answer (calls only) */
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed =
          raw === null
            ? null
            : (JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as Record<
                string,
                unknown
              >);
      } catch {
        parsed = null;
      }
      const jsonOk = parsed !== null && typeof parsed === 'object';
      const allowed = first ? KEYS_FIRST : KEYS_EN_PL;
      const closedKeys = jsonOk && Object.keys(parsed!).every((k) => allowed.has(k));
      /* prose = a long string that is NOT the reader's own words (parts / objective are verbatim copies) */
      const verbatimSources = [readerText, ...earlier].map(fold);
      const strings = jsonOk
        ? (JSON.stringify(parsed).match(/"(?:[^"\\]|\\.)*"/g) ?? []).map(
            (s) => JSON.parse(s) as string,
          )
        : [];
      const letters = (x: string) =>
        x
          .normalize('NFC')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, '');
      const letterSources = [readerText, ...earlier].map(letters);
      const factualProse =
        jsonOk &&
        strings.some(
          (s) => s.length > 48 && !letterSources.some((src) => src.includes(letters(s))),
        );
      const schemaOk =
        jsonOk &&
        typeof parsed!.job === 'string' &&
        (USER_JOBS as readonly string[]).includes(parsed!.job as string) &&
        typeof parsed!.needsCurrentEvidence === 'boolean';
      const ids = new Map(route0.semantic.entities.map((e) => [e.id, e]));
      const rel =
        jsonOk && parsed!.relation && typeof parsed!.relation === 'object'
          ? (parsed!.relation as Record<string, unknown>)
          : null;
      const relIds =
        rel === null
          ? []
          : [rel.actorA, rel.actorB, rel.object, rel.venue].filter((x) => x != null);
      const inventedEntity = relIds.some((x) => typeof x !== 'string' || !ids.has(x));
      const nonStateActor =
        rel !== null &&
        [rel.actorA, rel.actorB].some((x) => {
          const e = typeof x === 'string' ? ids.get(x) : undefined;
          return e !== undefined && e.type !== 'COUNTRY' && e.type !== 'TERRITORY';
        });
      const rawObjective =
        jsonOk && parsed!.objective && typeof parsed!.objective === 'object'
          ? (parsed!.objective as Record<string, unknown>).text
          : undefined;
      const inventedObjective =
        typeof rawObjective === 'string' &&
        !verbatimSources.some((src) => src.includes(fold(rawObjective))) &&
        !letterSources.some((src) => src.includes(letters(rawObjective)));
      /* the MODEL's own cross-field contradictions (rejected / dropped by validation, reported) */
      const rawRole = jsonOk ? parsed!.temporalRole : undefined;
      const rawParts =
        jsonOk && Array.isArray(parsed!.parts)
          ? (parsed!.parts as Array<Record<string, unknown>>)
          : [];
      const rawContradiction =
        schemaOk &&
        ((first &&
          typeof rawRole === 'string' &&
          ['CURRENT_STATE', 'RECENT', 'SINCE_PAST_TO_PRESENT', 'HISTORICAL_AND_CURRENT'].includes(
            rawRole,
          ) !== (parsed!.needsCurrentEvidence as boolean)) ||
          (parsed!.job === 'MIXED' && parsed!.needsCurrentEvidence !== true) ||
          (rawParts.length >= 2 &&
            rawParts.some((p) => p?.kind === 'CURRENT') !==
              (parsed!.needsCurrentEvidence as boolean)) ||
          (rel !== null && rel.object != null && rel.object === rel.venue));
      const called = run !== null;
      const usable = run?.source === 'SEMANTIC';
      const rejected = called && !usable;

      /* the final, executor-level outcome */
      const clarify =
        final.semanticClarification === true ||
        (final.knowledgeRequirement === 'DECISION_SUPPORT' && final.decisionObjective === null) ||
        (() => {
          const e = answerStateBeforeExecution(final.plan);
          return e !== null && e.state !== 'REFERENCE_BACKGROUND';
        })();
      const finalNews = plansNews(final) && !clarify;
      const reasoningOnly = !clarify && final.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY';

      /* A — correctness of the FINAL route (deterministic or interpreted) */
      const e = item.expect;
      const checks: Record<string, boolean> = {};
      if (!clarify) {
        const current = final.semantic.turn.freshness !== 'NONE';
        if (e.needsCurrentEvidence !== 'either')
          checks.currentness = current === e.needsCurrentEvidence;
        if (e.mixed)
          checks.mixed =
            final.knowledgeRequirement === 'MIXED_REFERENCE_CURRENT' ||
            final.knowledgeRequirement === 'MIXED_ADVISORY_CURRENT' ||
            final.semantic.turn.freshness === 'MIXED';
        checks.job = final.job.job !== null && e.jobs.includes(final.job.job);
        const actors = [...(final.relationship?.countries ?? [])].sort().join('+');
        checks.actors =
          e.actors === null ? actors === '' : actors === [...e.actors].sort().join('+');
        const surfaceMatch = (role: string, want: string) =>
          final.semantic.entities.some((x) => x.role === role && overlaps(x.surface, want));
        if (e.venue !== null) checks.venue = surfaceMatch('VENUE', e.venue);
        if (e.object !== null) checks.object = surfaceMatch('DISPUTED_OBJECT', e.object);
        if (e.reference !== null)
          checks.reference = final.semantic.references.target === e.reference;
        if (e.objective != null)
          checks.objective =
            final.decisionObjective !== null && overlaps(final.decisionObjective, e.objective);
      }
      /* localized entity resolution (Stage A), scored on every item */
      /* the countries the system identified the reader named: IR identities + the reading's typed /
       entity geography (EN / PL demonyms arrive there) — never a surface-supplied country */
      const readingGeo =
        final.outcome.status === 'NOT_READ'
          ? []
          : final.outcome.reading.geography
              .filter((g) => g.provenance !== 'SUPPLIED_BY_SURFACE' && g.value !== 'CONTESTED')
              .map((g) => g.value);
      const named = [
        ...new Set([
          ...final.semantic.entities
            .filter((x) => (x.type === 'COUNTRY' || x.type === 'TERRITORY') && x.iso3 !== null)
            .map((x) => x.iso3!),
          ...readingGeo,
        ]),
      ].sort();
      const expectedCountries = [...new Set(e.countries ?? [])].sort();
      if (e.countries !== undefined)
        checks.countries = named.join(',') === expectedCountries.join(',');
      const correct = Object.values(checks).every(Boolean);

      /* C — safety on the final route */
      const p0: string[] = [];
      if (e.clearlyConceptual && finalNews) p0.push('CONCEPTUAL_TO_NEWS');
      if (e.clearlyCurrent && reasoningOnly && final.semantic.turn.freshness === 'NONE')
        p0.push('CURRENT_TO_TIMELESS');
      /* BILATERAL COLLAPSE: two acting states expected, the final scope no longer holds both */
      const finalActors: readonly string[] = final.relationship?.countries ?? [];
      if (
        !clarify &&
        e.actors !== null &&
        !(finalActors.includes(e.actors[0]) && finalActors.includes(e.actors[1]))
      )
        p0.push('BILATERAL_COLLAPSE');
      /* MIXED STABLE-HALF ERASURE: a mixed turn answered as current reporting only */
      if (
        !clarify &&
        e.mixed &&
        final.semantic.turn.freshness === 'CURRENT' &&
        final.knowledgeRequirement !== 'MIXED_REFERENCE_CURRENT' &&
        final.knowledgeRequirement !== 'MIXED_ADVISORY_CURRENT'
      )
        p0.push('MIXED_STABLE_ERASED');
      const byInterpretation = called;
      const irViolations = validateSemanticTurnIR(final.semantic, readerText);
      const v = run?.verdict;
      /* accepted contradictory IR: an IR invariant violated, or one place holding two roles */
      const acceptedRoleContradiction =
        usable &&
        v?.relation != null &&
        v.relation.object !== null &&
        v.relation.object === v.relation.venue;
      const acceptedContradiction =
        usable && (irViolations.length > 0 || acceptedRoleContradiction);
      const verdictIgnored =
        usable &&
        v?.needsCurrentEvidence === true &&
        final.semantic.turn.freshness === 'NONE' &&
        !clarify;
      const unsafeFallback =
        rejected &&
        ((finalNews && e.clearlyConceptual) ||
          (e.clearlyCurrent && reasoningOnly && final.semantic.turn.freshness === 'NONE'));

      rows.push({
        id: item.id,
        family: item.family,
        language: item.language,
        path: called ? (usable ? 'INTERPRETER' : 'FALLBACK') : 'DETERMINISTIC',
        escalates,
        deterministic: {
          completeness: route0.semantic.resolution.completeness,
          conflicts: route0.semantic.resolution.conflicts,
          unresolvedFields: route0.semantic.resolution.unresolvedFields,
        },
        error,
        promptTokens: run?.tokens?.promptTokens ?? null,
        completionTokens: run?.tokens?.completionTokens ?? null,
        latencyMs: called ? latencyMs : null,
        validity: {
          called,
          jsonOk,
          closedKeys,
          schemaOk,
          factualProse,
          inventedEntity,
          inventedObjective,
          nonStateActor,
          usable,
          rejected,
        },
        correctness: { correct, checks, named, expectedCountries },
        safety: {
          p0,
          causedByFailure: rejected && p0.length > 0,
          byInterpretationPath: byInterpretation && p0.length > 0,
          rawContradiction,
          acceptedContradiction,
          irViolations,
          verdictIgnored,
          unsafeFallback,
          clarify,
        },
        verdict: v ?? null,
        /* the raw interpreter answer (closed JSON only), for audit of every validity flag */
        raw: raw === null ? null : raw.slice(0, 2000),
        final: {
          ...tupleOf(final),
          news: finalNews,
          knowledge: final.knowledgeRequirement,
          decisionObjective: final.decisionObjective,
        },
      });

      if (repeatIds.has(item.id)) {
        const runs = [tupleOf(final)];
        for (let k = 0; k < 2; k++) {
          const again = await turnOnce(item);
          rows.push({
            id: `${item.id}#r${k + 2}`,
            repeat: true,
            family: item.family,
            language: item.language,
            path:
              again.run === null
                ? 'DETERMINISTIC'
                : again.run.source === 'SEMANTIC'
                  ? 'INTERPRETER'
                  : 'FALLBACK',
            promptTokens: again.run?.tokens?.promptTokens ?? null,
            completionTokens: again.run?.tokens?.completionTokens ?? null,
            latencyMs: again.run === null ? null : again.latencyMs,
          });
          runs.push(tupleOf(again.final));
        }
        const fields = Object.keys(runs[0]) as Array<keyof (typeof runs)[0]>;
        const changed = fields.filter(
          (f) => new Set(runs.map((r) => JSON.stringify(r[f]))).size > 1,
        );
        stability.push({
          id: item.id,
          family: item.family,
          language: item.language,
          stable: changed.length === 0,
          changed,
          runs,
        });
      }
    }

    /* ── ANSWER LANGUAGE: the Prime Moment items answered end to end (reasoning only, no news) ── */
    const answers: Array<Record<string, unknown>> = [];
    for (const item of set.primeMoment ?? []) {
      const request = requestOf(item);
      let payload: { answer?: { state: string }; background?: { text: string } | null } | null =
        null;
      let err: string | null = null;
      try {
        const plan = await adapter.prepare(request);
        const result = await inRequest(item, () => adapter.execute(request, plan, `op-${item.id}`));
        payload = JSON.parse(result.payloadJson);
      } catch (e) {
        err = (e as Error).message.slice(0, 160);
      }
      const text = payload?.background?.text ?? '';
      const westernDigits = (text.match(/[0-9]/g) ?? []).length;
      const easternDigits = (text.match(/[٠-٩۰-۹]/g) ?? []).length;
      answers.push({
        id: item.id,
        language: item.language,
        error: err,
        state: payload?.answer?.state ?? null,
        identifiedLanguage: text === '' ? null : identifyLanguage(text),
        languageMatches: text !== '' && identifyLanguage(text) === item.language,
        chars: text.length,
        unicode: {
          nfc: text === text.normalize('NFC'),
          replacementChars: (text.match(/�/g) ?? []).length,
          mojibake: /Ã.|Ø§|â€/.test(text),
          bidiControls: (text.match(/[‪-‮⁦-⁩]/g) ?? []).length,
        },
        digits: { western: westernDigits, easternArabic: easternDigits },
        arabicPunctuation:
          item.language === 'ar'
            ? {
                questionMark: (text.match(/؟/g) ?? []).length,
                comma: (text.match(/،/g) ?? []).length,
                latinComma: (text.match(/,/g) ?? []).length,
              }
            : null,
        excerpt: text.slice(0, 400),
      });
    }

    /* ── summaries ── */
    const firstRows = rows.filter((r) => r.repeat !== true);
    const scoredRows = firstRows.filter((r) => r.family !== 'prime_moment');
    const perLanguage: Record<string, Record<string, unknown>> = {};
    for (const lang of ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar']) {
      const rs = scoredRows.filter((r) => r.language === lang);
      const all = rows.filter((r) => r.language === lang);
      const callsRows = all.filter((r) => r.path !== 'DETERMINISTIC');
      const lat = callsRows.map((r) => r.latencyMs as number).filter((x) => typeof x === 'number');
      const pT = callsRows.map((r) => (r.promptTokens as number | null) ?? 0);
      const cT = callsRows.map((r) => (r.completionTokens as number | null) ?? 0);
      const firstCalls = rs.filter((r) => (r.validity as { called: boolean }).called);
      const c = (pred: (r: Record<string, unknown>) => boolean, from = rs) =>
        from.filter(pred).length;
      const checkTotals: Record<string, { pass: number; total: number }> = {};
      for (const r of rs)
        for (const [k, ok] of Object.entries(
          (r.correctness as { checks: Record<string, boolean> }).checks,
        )) {
          const t = (checkTotals[k] ??= { pass: 0, total: 0 });
          t.total++;
          if (ok) t.pass++;
        }
      perLanguage[lang] = {
        turns: rs.length,
        deterministicPct:
          rs.length === 0
            ? 0
            : +((100 * c((r) => r.path === 'DETERMINISTIC')) / rs.length).toFixed(1),
        interpreterPct: rs.length === 0 ? 0 : +((100 * firstCalls.length) / rs.length).toFixed(1),
        interpreterCallsInclRepeats: callsRows.length,
        tokens: {
          prompt: pT.reduce((a, b) => a + b, 0),
          completion: cT.reduce((a, b) => a + b, 0),
          meanPrompt: callsRows.length
            ? Math.round(pT.reduce((a, b) => a + b, 0) / callsRows.length)
            : 0,
          meanCompletion: callsRows.length
            ? Math.round(cT.reduce((a, b) => a + b, 0) / callsRows.length)
            : 0,
        },
        latencyMs: {
          mean: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0,
          median: pct(lat, 50),
          p95: pct(lat, 95),
          max: lat.length ? Math.max(...lat) : 0,
        },
        rejections: c((r) => (r.validity as { rejected: boolean }).rejected),
        rejectionRatePct: firstCalls.length
          ? +(
              (100 * c((r) => (r.validity as { rejected: boolean }).rejected)) /
              firstCalls.length
            ).toFixed(1)
          : 0,
        fallbacks: c((r) => r.path === 'FALLBACK'),
        fallbackRatePct: rs.length
          ? +((100 * c((r) => r.path === 'FALLBACK')) / rs.length).toFixed(1)
          : 0,
        A_correctness: {
          correct: c((r) => (r.correctness as { correct: boolean }).correct),
          of: rs.length,
          byCheck: checkTotals,
        },
        B_validity: {
          calls: firstCalls.length,
          usable: c((r) => (r.validity as { usable: boolean }).usable),
          usablePctOfCalls: firstCalls.length
            ? +(
                (100 * c((r) => (r.validity as { usable: boolean }).usable)) /
                firstCalls.length
              ).toFixed(1)
            : null,
          usableOrDeterministicPct: rs.length
            ? +((100 * c((r) => r.path !== 'FALLBACK')) / rs.length).toFixed(1)
            : 0,
          jsonInvalid: c(
            (r) =>
              (r.validity as { called: boolean; jsonOk: boolean }).called &&
              !(r.validity as { jsonOk: boolean }).jsonOk,
          ),
          nonClosedKeys: c(
            (r) =>
              (r.validity as { jsonOk: boolean; closedKeys: boolean }).jsonOk &&
              !(r.validity as { closedKeys: boolean }).closedKeys,
          ),
          schemaInvalid: c(
            (r) =>
              (r.validity as { jsonOk: boolean; schemaOk: boolean }).jsonOk &&
              !(r.validity as { schemaOk: boolean }).schemaOk,
          ),
          factualProse: c((r) => (r.validity as { factualProse: boolean }).factualProse),
          inventedEntities: c((r) => (r.validity as { inventedEntity: boolean }).inventedEntity),
          inventedObjectives: c(
            (r) => (r.validity as { inventedObjective: boolean }).inventedObjective,
          ),
          nonStateActorsProposed: c(
            (r) => (r.validity as { nonStateActor: boolean }).nonStateActor,
          ),
          providerErrors: c((r) => r.error !== null),
        },
        C_safety: {
          p0: c((r) => (r.safety as { p0: string[] }).p0.length > 0),
          p0CausedByInterpreterFailure: c(
            (r) => (r.safety as { causedByFailure: boolean }).causedByFailure,
          ),
          conceptualToNews: c((r) =>
            (r.safety as { p0: string[] }).p0.includes('CONCEPTUAL_TO_NEWS'),
          ),
          currentToTimeless: c((r) =>
            (r.safety as { p0: string[] }).p0.includes('CURRENT_TO_TIMELESS'),
          ),
          acceptedInvalidOrContradictoryIR: c(
            (r) => (r.safety as { acceptedContradiction: boolean }).acceptedContradiction,
          ),
          verdictIgnored: c((r) => (r.safety as { verdictIgnored: boolean }).verdictIgnored),
          unsafeFallbacks: c((r) => (r.safety as { unsafeFallback: boolean }).unsafeFallback),
          clarifications: c((r) => (r.safety as { clarify: boolean }).clarify),
          bilateralCollapse: c((r) =>
            (r.safety as { p0: string[] }).p0.includes('BILATERAL_COLLAPSE'),
          ),
          mixedStableErased: c((r) =>
            (r.safety as { p0: string[] }).p0.includes('MIXED_STABLE_ERASED'),
          ),
          p0ByInterpretationPath: c(
            (r) => (r.safety as { byInterpretationPath: boolean }).byInterpretationPath,
          ),
          modelContradictionsRejectedOrDropped: c(
            (r) => (r.safety as { rawContradiction: boolean }).rawContradiction,
          ),
        },
      };
    }
    const byFamily: Record<string, Record<string, number>> = {};
    for (const r of scoredRows) {
      const g = (byFamily[`${r.language as string}:${r.family as string}`] ??= {
        items: 0,
        correct: 0,
        p0: 0,
        fallback: 0,
      });
      g.items++;
      if ((r.correctness as { correct: boolean }).correct) g.correct++;
      if ((r.safety as { p0: string[] }).p0.length > 0) g.p0++;
      if (r.path === 'FALLBACK') g.fallback++;
    }
    const callRows = scoredRows.filter((r) => (r.validity as { called: boolean }).called);
    const summary = {
      ranAt: new Date().toISOString(),
      model: secrets.OPENAI_MODEL ?? '(provider default)',
      items: scoredRows.length,
      primeMomentItems: firstRows.length - scoredRows.length,
      accounting,
      overall: {
        calls: callRows.length,
        usablePctOfCalls: callRows.length
          ? +(
              (100 * callRows.filter((r) => (r.validity as { usable: boolean }).usable).length) /
              callRows.length
            ).toFixed(1)
          : null,
        correct: scoredRows.filter((r) => (r.correctness as { correct: boolean }).correct).length,
        p0: scoredRows.filter((r) => (r.safety as { p0: string[] }).p0.length > 0).length,
      },
      perLanguage,
      stability: {
        items: stability.length,
        stable: stability.filter((s) => s.stable).length,
        changedFields: stability.flatMap((s) => (s.changed as string[]).map((f) => `${s.id}:${f}`)),
      },
      answers,
    };
    writeFileSync(REPORT!, JSON.stringify({ summary, byFamily, stability, rows }, null, 2));
    expect(scoredRows.length).toBe(set.items.length);
  },
);
