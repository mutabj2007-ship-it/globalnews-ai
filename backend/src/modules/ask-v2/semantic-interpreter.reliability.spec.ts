import { readFileSync, writeFileSync } from 'node:fs';
import type { AskRequest } from './ask-compute.contract';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import { routeAskR2, type AskR2Route, type AskRouteContext } from '../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import { OpenAiGeneralBackgroundProvider } from '../analysis/providers/general-background.provider';
import { newAskObservationDraft } from '../ask-observability/ask-observation.contract';
import { USER_JOBS } from '../ask-router/user-job';
import type { SemanticResolution } from '../ask-router/semantic-ir/semantic-interpreter';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEMANTIC-IR RELIABILITY GATE — THE FROZEN SCORER (hashed before the first model call)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Runs ONLY with:
 *   RELIABILITY_SET     the frozen battery (independent author, synthetic, no personal data)
 *   RELIABILITY_REPORT  where results are written
 *   RELIABILITY_ENV     a local .env (only OPENAI_API_KEY / OPENAI_MODEL read, in-process, never
 *                       printed); RELIABILITY_MODEL optionally overrides the model (comparison)
 *
 * Every item makes ONE real call through the adapter's own interpretation path — switches,
 * breaker permit, meter reserve, provider, settle, breaker record, JSON + schema validation,
 * cross-field contradiction rejection — FORCED even when the deterministic reading is complete,
 * so the interpreter itself is measured. No news provider exists in this harness. The route is
 * then recomposed with the verdict (accepted IR) or with the governed fallback.
 *
 * THREE SCORES, NEVER ONE PERCENTAGE:
 *   A  CORRECTNESS  — on ACCEPTED interpretations: does the accepted IR match the expected
 *                     structure (currentness, MIXED, job, actors, venue, object, reference)?
 *   B  VALIDITY     — JSON, closed keys, no prose / facts, schema-valid, self-consistent, no
 *                     invented entity; usable = accepted without rejection fallback
 *   C  SAFETY       — on the FINAL route (accepted or fallback): no conceptual → news, no clearly
 *                     current → timeless reasoning; separately counted when caused by a failure
 *
 * REPEATABILITY: a frozen subset (the first two items of ten high-ambiguity families) is run two
 * more times; the semantic tuple (currentness, evidence, job, actors, relationship, reference) is
 * compared across the three runs.
 */
const SET = process.env.RELIABILITY_SET;
const REPORT = process.env.RELIABILITY_REPORT;
const ENV = process.env.RELIABILITY_ENV;
const live = SET && REPORT && ENV ? it : it.skip;
jest.setTimeout(3_600_000);

interface Item {
  id: string;
  family: string;
  language: 'en' | 'pl';
  turn: string;
  state: {
    artifact?: { kind: string; label: string };
    objective?: string;
    choiceSet?: string[];
    portableSubject?: string;
  };
  expect: {
    needsCurrentEvidence: boolean | 'either';
    mixed: boolean;
    jobs: string[];
    actors: [string, string] | null;
    venue: string | null;
    object: string | null;
    reference: string | null;
    clearlyConceptual: boolean;
    clearlyCurrent: boolean;
  };
}

const ALLOWED_KEYS = new Set([
  'job',
  'needsCurrentEvidence',
  'depth',
  'transformation',
  'confidence',
  'clauses',
  'relation',
  'reference',
]);
const REPEAT_FAMILIES = [
  'ambiguous_currentness',
  'conceptual_vs_current',
  'stable_current_mixed',
  'unfamiliar_wording',
  'two_country_relation',
  'actors_venue',
  'actors_disputed_object',
  'lowercase_abbreviations',
  'adversarial_prompt',
  'since_past_to_present',
];

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

live(
  'R4 semantic-IR reliability battery — real interpreter, three scores, repeatability',
  async () => {
    const set = JSON.parse(readFileSync(SET!, 'utf8').replace(/^﻿/, '')) as { items: Item[] };
    const secrets = readSecrets(ENV!);
    if (process.env.RELIABILITY_MODEL) secrets.OPENAI_MODEL = process.env.RELIABILITY_MODEL;
    const config = new AnalysisConfigService({ get: (k: string) => secrets[k] } as never);
    const provider = new OpenAiGeneralBackgroundProvider(config);
    let lastRaw: string | null = null;
    const accounting = { reserve: 0, settle: 0, breaker: {} as Record<string, number> };
    const recording = {
      id: provider.id,
      displayName: provider.displayName,
      isMock: false,
      answerBackground: () => {
        throw new Error('the reliability battery never asks for an answer');
      },
      completeStructured: async (
        input: Parameters<OpenAiGeneralBackgroundProvider['completeStructured']>[0],
      ) => {
        lastRaw = null;
        const out = await provider.completeStructured(input);
        lastRaw = out;
        return out;
      },
    };
    const adapter = new AskR2ExecutionAdapter(
      {} as never,
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

    const ctxOf = (item: Item): AskRouteContext => ({
      requestInstant: new Date().toISOString(),
      ...(item.state.artifact === undefined ? {} : { priorWork: item.state.artifact }),
      conversation: {
        ...(item.state.artifact === undefined ? {} : { artifact: item.state.artifact }),
        ...(item.state.objective === undefined
          ? {}
          : {
              objective: {
                criterion: item.state.objective,
                prefer: null,
                over: null,
                constraints: [],
                sourceTurn: 0,
                sourceSpan: [0, item.state.objective.length] as const,
                target: null,
                inherited: true,
              },
            }),
        ...(item.state.choiceSet === undefined ? {} : { choiceSet: item.state.choiceSet }),
        ...(item.state.portableSubject === undefined
          ? {}
          : { portableSubject: item.state.portableSubject }),
      },
    });
    const routeOf = (item: Item, semanticResolution?: SemanticResolution): AskR2Route =>
      routeAskR2(
        {
          originalQuestion: item.turn,
          sourceLanguage: item.language,
          normalizationLanguage: item.language,
          displayLanguage: item.language,
          origin: 'ASK',
        },
        { ...ctxOf(item), ...(semanticResolution === undefined ? {} : { semanticResolution }) },
        { specialistRegistry: specialistRegistryFixture },
      );
    const requestOf = (item: Item): AskRequest =>
      ({
        question: item.turn,
        language: item.language,
        intent: 'ask',
        ...(item.state.artifact === undefined
          ? {}
          : {
              priorArtifact: {
                ...item.state.artifact,
                components: [],
                provenance: 'MODEL_REASONING',
                citable: false,
                sourceOperationId: 'battery',
              },
            }),
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
      }) as AskRequest;
    const plansNews = (r: AskR2Route): boolean =>
      r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING') &&
      r.plan.terminalState !== 'REFERENCE_BACKGROUND_ONLY';

    async function callOnce(item: Item) {
      const route = routeOf(item);
      const draft = newAskObservationDraft('reliability', item.language);
      const t0 = Date.now();
      let run: {
        verdict: SemanticResolution;
        calls: number;
        source: 'SEMANTIC' | 'FALLBACK';
        tokens?: { promptTokens: number; completionTokens: number } | null;
      };
      let error: string | null = null;
      try {
        run = await askRequestContext.run(
          { accountId: 'battery', ipScope: 'ip:v4:192.0.2.1' },
          () =>
            (
              adapter as unknown as {
                interpretSemantics: (
                  r: AskRequest,
                  ro: AskR2Route,
                  d: unknown,
                ) => Promise<typeof run>;
              }
            ).interpretSemantics(requestOf(item), route, draft),
        );
      } catch (e) {
        error = (e as Error).message.slice(0, 120);
        run = { verdict: { path: 'FALLBACK' }, calls: 1, source: 'FALLBACK' };
      }
      const latencyMs = Date.now() - t0;
      return { route, run, raw: lastRaw as string | null, latencyMs, error };
    }

    /* the semantic tuple compared across repeated runs */
    const tupleOf = (r: AskR2Route) => ({
      freshness: r.semantic.turn.freshness,
      evidence: r.semantic.turn.evidence,
      job: r.job.job ?? null,
      actors: [...(r.relationship?.countries ?? [])].sort().join('+') || null,
      relationship: r.relationship === null ? null : (r.relationship.relations[0] ?? null),
      reference: r.semantic.references.target,
      clarification: r.semanticClarification === true,
    });

    const rows: Array<Record<string, unknown>> = [];
    const stability: Array<Record<string, unknown>> = [];
    const repeatIds = new Set(
      REPEAT_FAMILIES.flatMap((f) =>
        set.items
          .filter((i) => i.family === f)
          .slice(0, 2)
          .map((i) => i.id),
      ),
    );

    for (const item of set.items) {
      const { route, run, raw, latencyMs, error } = await callOnce(item);
      /* B — validity of the RAW answer */
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
      } catch {
        parsed = null;
      }
      const jsonOk = parsed !== null && typeof parsed === 'object';
      const closedKeys = jsonOk && Object.keys(parsed!).every((k) => ALLOWED_KEYS.has(k));
      const strings = jsonOk ? (JSON.stringify(parsed).match(/"(?:[^"\\]|\\.)*"/g) ?? []) : [];
      const factualProse = jsonOk && strings.some((s) => s.length > 48);
      const schemaOk =
        jsonOk &&
        typeof parsed!.job === 'string' &&
        (USER_JOBS as readonly string[]).includes(parsed!.job as string) &&
        typeof parsed!.needsCurrentEvidence === 'boolean';
      const rawClauses =
        jsonOk && Array.isArray(parsed!.clauses) ? (parsed!.clauses as unknown[]) : [];
      const rawKinds = rawClauses.map((c) =>
        c !== null && typeof c === 'object' ? (c as Record<string, unknown>).kind : undefined,
      );
      const contradiction =
        schemaOk &&
        rawKinds.length === route.semantic.clauses.length &&
        rawKinds.includes('CURRENT') !== (parsed!.needsCurrentEvidence as boolean);
      const ids = new Map(route.semantic.entities.map((e) => [e.id, e]));
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
      const usable = run.source === 'SEMANTIC';

      /* the FINAL route: accepted verdict, or the governed fallback */
      const final = routeOf(item, run.verdict);
      const finalNews = plansNews(final);
      const clarify = final.semanticClarification === true;
      const reasoningOnly = !clarify && final.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY';

      /* A — correctness of the ACCEPTED IR */
      const e = item.expect;
      const checks: Record<string, boolean> = {};
      if (usable) {
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
          final.semantic.entities.some(
            (x) =>
              x.role === role &&
              (want.toLowerCase().includes(x.surface.toLowerCase()) ||
                x.surface.toLowerCase().includes(want.toLowerCase())),
          );
        if (e.venue !== null) checks.venue = surfaceMatch('VENUE', e.venue);
        if (e.object !== null) checks.object = surfaceMatch('DISPUTED_OBJECT', e.object);
        if (e.reference !== null)
          checks.reference = final.semantic.references.target === e.reference;
      }
      const correct = usable && Object.values(checks).every(Boolean);

      /* C — safety on the final route */
      const p0: string[] = [];
      if (e.clearlyConceptual && finalNews && !clarify) p0.push('CONCEPTUAL_TO_NEWS');
      if (e.clearlyCurrent && reasoningOnly && final.semantic.turn.freshness === 'NONE')
        p0.push('CURRENT_TO_TIMELESS');
      const v = run.verdict;
      const acceptedContradiction =
        usable &&
        v.clauses !== undefined &&
        v.clauses.includes('CURRENT') !== v.needsCurrentEvidence;
      const acceptedBadRelation =
        usable &&
        v.relation != null &&
        [v.relation.actorA, v.relation.actorB].some((x) => {
          const en = ids.get(x);
          return en === undefined || (en.type !== 'COUNTRY' && en.type !== 'TERRITORY');
        });

      rows.push({
        id: item.id,
        family: item.family,
        language: item.language,
        source: run.source,
        error,
        promptTokens: run.tokens?.promptTokens ?? null,
        completionTokens: run.tokens?.completionTokens ?? null,
        latencyMs,
        validity: {
          jsonOk,
          closedKeys,
          schemaOk,
          contradiction,
          factualProse,
          inventedEntity,
          nonStateActor,
          usable,
        },
        correctness: { scored: usable, correct, checks },
        safety: {
          p0,
          causedByFailure: !usable && p0.length > 0,
          acceptedContradiction,
          acceptedBadRelation,
        },
        deterministic: {
          completeness: route.semantic.resolution.completeness,
          conflicts: route.semantic.resolution.conflicts,
          unresolvedFields: route.semantic.resolution.unresolvedFields,
        },
        verdict: v,
        final: { ...tupleOf(final), news: finalNews },
      });

      if (repeatIds.has(item.id)) {
        const runs = [tupleOf(usable ? final : final)];
        for (let k = 0; k < 2; k++) {
          const again = await callOnce(item);
          rows.push({
            id: `${item.id}#r${k + 2}`,
            repeat: true,
            family: item.family,
            language: item.language,
            source: again.run.source,
            promptTokens: again.run.tokens?.promptTokens ?? null,
            completionTokens: again.run.tokens?.completionTokens ?? null,
            latencyMs: again.latencyMs,
          });
          runs.push(tupleOf(routeOf(item, again.run.verdict)));
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

    /* ── summaries ── */
    const first = rows.filter((r) => r.repeat !== true);
    const all = rows;
    const lat = all.map((r) => r.latencyMs as number);
    const pTok = all.map((r) => (r.promptTokens as number | null) ?? 0);
    const cTok = all.map((r) => (r.completionTokens as number | null) ?? 0);
    const by = (key: 'language' | 'family') => {
      const out: Record<string, Record<string, number>> = {};
      for (const r of first) {
        const k = r[key] as string;
        const g = (out[k] ??= { items: 0, usable: 0, correct: 0, scored: 0, p0: 0 });
        g.items++;
        const val = r.validity as Record<string, boolean>;
        const cor = r.correctness as { scored: boolean; correct: boolean };
        const saf = r.safety as { p0: string[] };
        if (val.usable) g.usable++;
        if (cor.scored) g.scored++;
        if (cor.correct) g.correct++;
        if (saf.p0.length > 0) g.p0++;
      }
      return out;
    };
    const count = (pred: (r: Record<string, unknown>) => boolean) => first.filter(pred).length;
    const checkTotals: Record<string, { pass: number; total: number }> = {};
    for (const r of first)
      for (const [k, ok] of Object.entries(
        (r.correctness as { checks: Record<string, boolean> }).checks,
      )) {
        const t = (checkTotals[k] ??= { pass: 0, total: 0 });
        t.total++;
        if (ok) t.pass++;
      }
    const summary = {
      ranAt: new Date().toISOString(),
      model: secrets.OPENAI_MODEL ?? '(provider default)',
      items: first.length,
      totalCalls: all.length,
      accounting,
      B_validity: {
        usable: count((r) => (r.validity as Record<string, boolean>).usable),
        rejectedOrInvalid: count((r) => !(r.validity as Record<string, boolean>).usable),
        jsonInvalid: count((r) => !(r.validity as Record<string, boolean>).jsonOk),
        nonClosedKeys: count(
          (r) =>
            (r.validity as Record<string, boolean>).jsonOk &&
            !(r.validity as Record<string, boolean>).closedKeys,
        ),
        schemaInvalid: count(
          (r) =>
            (r.validity as Record<string, boolean>).jsonOk &&
            !(r.validity as Record<string, boolean>).schemaOk,
        ),
        selfContradictions: count((r) => (r.validity as Record<string, boolean>).contradiction),
        factualProse: count((r) => (r.validity as Record<string, boolean>).factualProse),
        inventedEntities: count((r) => (r.validity as Record<string, boolean>).inventedEntity),
        nonStateActorsProposed: count((r) => (r.validity as Record<string, boolean>).nonStateActor),
        providerErrors: count((r) => r.error !== null),
      },
      A_correctness: {
        scored: count((r) => (r.correctness as { scored: boolean }).scored),
        correct: count((r) => (r.correctness as { correct: boolean }).correct),
        byCheck: checkTotals,
      },
      C_safety: {
        p0Items: count((r) => (r.safety as { p0: string[] }).p0.length > 0),
        p0OnAccepted: count(
          (r) =>
            (r.safety as { p0: string[] }).p0.length > 0 &&
            (r.validity as Record<string, boolean>).usable,
        ),
        p0AfterFallback: count((r) => (r.safety as { causedByFailure: boolean }).causedByFailure),
        conceptualToNews: count((r) =>
          (r.safety as { p0: string[] }).p0.includes('CONCEPTUAL_TO_NEWS'),
        ),
        currentToTimeless: count((r) =>
          (r.safety as { p0: string[] }).p0.includes('CURRENT_TO_TIMELESS'),
        ),
        acceptedContradictions: count(
          (r) => (r.safety as { acceptedContradiction: boolean }).acceptedContradiction,
        ),
        acceptedBadRelations: count(
          (r) => (r.safety as { acceptedBadRelation: boolean }).acceptedBadRelation,
        ),
      },
      byLanguage: by('language'),
      byFamily: by('family'),
      stability: {
        items: stability.length,
        stable: stability.filter((s) => s.stable).length,
        changedFields: stability.flatMap((s) => (s.changed as string[]).map((f) => `${s.id}:${f}`)),
      },
      usage: {
        promptTokens: pTok.reduce((a, b) => a + b, 0),
        completionTokens: cTok.reduce((a, b) => a + b, 0),
        meanPrompt: Math.round(pTok.reduce((a, b) => a + b, 0) / all.length),
        meanCompletion: Math.round(cTok.reduce((a, b) => a + b, 0) / all.length),
        latencyMs: {
          mean: Math.round(lat.reduce((a, b) => a + b, 0) / lat.length),
          median: pct(lat, 50),
          p95: pct(lat, 95),
          max: Math.max(...lat),
        },
      },
    };
    writeFileSync(REPORT!, JSON.stringify({ summary, stability, rows }, null, 2));
    expect(first.length).toBe(set.items.length);
  },
);
