import { readFileSync, writeFileSync } from 'node:fs';
import { routeAskR2, type AskRouteContext, type AskR2Route } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { readContinuationEllipsis } from '../../analysis/anchor/continuation-ellipsis.util';
import { FALLBACK_SEMANTIC_JOB, leavesArtifact } from '../job-execution';
import { inheritedConversationCountry } from './conversation-place';
import { readConversationalTurn } from './conversation-state';

/**
 * CTO R4 FINAL CLOSEOUT §11 — THE SECOND SEALED EVALUATION HARNESS (frozen before the set exists).
 *
 * Scores an externally authored set (ASK_R4B_SET=<json>) ONCE, through the same deterministic
 * layers the service and executor run before any model or provider, in their order:
 *   1. conversation state (composition / inherited place) from the reader's earlier turns;
 *   2. prior WORK: an earlier turn the executor answers by reasoning, whose job may leave an
 *      artifact (leavesArtifact), is assumed to have left one (the model is told to; optimistic,
 *      stated in the report);
 *   3. the integrated router with that prior work;
 *   4. an UNRESOLVED route is re-routed with the NO-CLASSIFIER fallback verdict, exactly as the
 *      adapter does without a classifier — counted separately as classifier-dependent;
 *   5. the executor's zero-compute decisions (clarification, constraint, missing objective).
 * Writes RAW denominators to ASK_R4B_REPORT (never to the console). Skipped without a set.
 *
 * P0 SEMANTIC INVERSIONS (CTO §11), reported separately:
 *   CONCEPTUAL_TO_NEWS         expected no news, the route calls news;
 *   CURRENT_TO_REASONING       expected current evidence, the route answers by reasoning only;
 *   BILATERAL_COLLAPSE         two (or more) countries expected, the route keeps fewer;
 *   CONTINUATION_LOSES_WORK    the final turn depends on earlier work, and no earlier work is
 *                              available to it, or it is sent to news / a clarification;
 *   MIXED_STABLE_ERASED        a stable + current question is not read as MIXED, so a current
 *                              retrieval failure would erase its stable half.
 */
const SET = process.env.ASK_R4B_SET;
const REPORT = process.env.ASK_R4B_REPORT;
const run = SET && REPORT ? it : it.skip;

interface SealedItem {
  id: string;
  category: string;
  language: 'en' | 'pl';
  turns: string[];
  expect: {
    newsCall: boolean;
    jobs: string[];
    referencesEarlierWork: boolean;
    planHorizonDays: number | null;
    transformation: string | null;
    mixed: boolean;
    countries: string[] | null;
  };
}

interface Observed {
  answered: string;
  job: string | null;
  source: string;
  classifierDependent: boolean;
  newsCall: boolean;
  reasoningOnly: boolean;
  clarify: boolean;
  reference: string;
  transformation: string | null;
  planHorizonDays: number | null;
  knowledge: string | null;
  countries: string[];
  terminal: string;
  priorWorkAvailable: boolean;
  leaves: boolean;
}

function routeTurn(
  question: string,
  lang: 'en' | 'pl',
  earlier: string[],
  priorWork: AskRouteContext['priorWork'],
): Observed {
  const newestFirst = earlier.map((q) => ({ question: q, language: lang })).reverse();
  const turn = readConversationalTurn(question, lang, newestFirst);
  const answered = turn?.composition?.effectiveQuestion ?? question;
  const place =
    turn?.composition == null ? inheritedConversationCountry(question, lang, newestFirst) : null;
  const go = (semanticJob?: AskRouteContext['semanticJob']): AskR2Route =>
    routeAskR2(
      {
        originalQuestion: answered,
        sourceLanguage: lang,
        normalizationLanguage: lang,
        displayLanguage: lang,
        origin: 'ASK',
      },
      {
        requestInstant: '2026-10-03T08:00:00Z',
        ...(place === null ? {} : { mapContextCountry: place }),
        ...(priorWork === undefined ? {} : { priorWork }),
        ...(semanticJob === undefined ? {} : { semanticJob }),
      },
      { specialistRegistry: specialistRegistryFixture },
    );
  let route = go();
  const classifierDependent = route.job.source === 'UNRESOLVED';
  if (classifierDependent)
    route = go({
      job: FALLBACK_SEMANTIC_JOB.job,
      needsCurrentEvidence: FALLBACK_SEMANTIC_JOB.needsCurrentEvidence,
    });
  const terminal = route.plan.terminalState;
  const requiresNews = route.plan.evidenceRequests.some(
    (e) => e.required && e.evidenceClass === 'NEWS_REPORTING',
  );
  const constraintOnly = turn?.constraintOnly === true && turn.composition === null;
  const objectiveMissing =
    route.knowledgeRequirement === 'DECISION_SUPPORT' && route.decisionObjective === null;
  const bareEllipsis = readContinuationEllipsis(answered) !== null;
  const clarify =
    constraintOnly ||
    objectiveMissing ||
    (bareEllipsis && terminal !== 'REFERENCE_BACKGROUND_ONLY') ||
    terminal === 'CLARIFICATION_REQUIRED';
  const newsCall = !clarify && requiresNews && terminal !== 'REFERENCE_BACKGROUND_ONLY';
  const horizon = route.job.temporal.find((t) => t.role === 'PLAN_HORIZON');
  const countries = [
    ...new Set([
      ...route.envelope.geography.candidates.map((c) => c.value),
      ...(route.relationship?.countries ?? []),
    ]),
  ].filter((v) => /^[A-Z]{3}$/.test(v));
  return {
    answered,
    job: route.job.job,
    source: classifierDependent ? 'FALLBACK' : route.job.source,
    classifierDependent,
    newsCall,
    reasoningOnly: !clarify && terminal === 'REFERENCE_BACKGROUND_ONLY',
    clarify,
    reference: route.job.discourseReference,
    transformation: route.job.transformation,
    planHorizonDays: horizon?.days ?? null,
    knowledge: route.knowledgeRequirement,
    countries,
    terminal,
    priorWorkAvailable: priorWork !== undefined,
    leaves: leavesArtifact(route.job),
  };
}

function observe(item: SealedItem): Observed {
  let priorWork: AskRouteContext['priorWork'];
  const earlier: string[] = [];
  let last: Observed | null = null;
  for (const q of item.turns) {
    last = routeTurn(q, item.language, earlier, priorWork);
    if (last.leaves && last.reasoningOnly)
      priorWork = { kind: 'CONCEPTUAL_FRAMEWORK', label: 'earlier work' };
    earlier.push(q);
  }
  return last!;
}

type Check =
  'newsCall' | 'job' | 'reference' | 'planHorizon' | 'transformation' | 'mixed' | 'countries';
type P0 =
  | 'CONCEPTUAL_TO_NEWS'
  | 'CURRENT_TO_REASONING'
  | 'BILATERAL_COLLAPSE'
  | 'CONTINUATION_LOSES_WORK'
  | 'MIXED_STABLE_ERASED';
const MIXED_KNOWLEDGE = new Set(['MIXED_REFERENCE_CURRENT', 'MIXED_ADVISORY_CURRENT']);

run('R4 second sealed evaluation — scored ONCE, raw denominators', () => {
  const set = JSON.parse(readFileSync(SET!, 'utf8').replace(/^﻿/, '')) as {
    items: SealedItem[];
  };
  const tally: Record<Check, { pass: number; total: number }> = {
    newsCall: { pass: 0, total: 0 },
    job: { pass: 0, total: 0 },
    reference: { pass: 0, total: 0 },
    planHorizon: { pass: 0, total: 0 },
    transformation: { pass: 0, total: 0 },
    mixed: { pass: 0, total: 0 },
    countries: { pass: 0, total: 0 },
  };
  const rows = set.items.map((item) => {
    const o = observe(item);
    const e = item.expect;
    const failed: Check[] = [];
    const score = (c: Check, ok: boolean) => {
      tally[c].total++;
      if (ok) tally[c].pass++;
      else failed.push(c);
    };
    score('newsCall', o.newsCall === e.newsCall);
    score('job', o.job !== null && e.jobs.includes(o.job));
    if (e.referencesEarlierWork) score('reference', o.reference === 'PRIOR_WORK');
    if (e.planHorizonDays !== null) score('planHorizon', o.planHorizonDays === e.planHorizonDays);
    if (e.transformation !== null) score('transformation', o.transformation === e.transformation);
    if (e.mixed) score('mixed', o.knowledge !== null && MIXED_KNOWLEDGE.has(o.knowledge));
    if (e.countries !== null && e.countries.length > 0)
      score(
        'countries',
        e.countries.every((c) => o.countries.includes(c)),
      );
    const p0: P0[] = [];
    if (!e.newsCall && o.newsCall) p0.push('CONCEPTUAL_TO_NEWS');
    if (
      e.newsCall &&
      o.reasoningOnly &&
      !(o.knowledge !== null && MIXED_KNOWLEDGE.has(o.knowledge))
    )
      p0.push('CURRENT_TO_REASONING');
    if (
      e.countries !== null &&
      e.countries.length >= 2 &&
      !e.countries.every((c) => o.countries.includes(c))
    )
      p0.push('BILATERAL_COLLAPSE');
    if (e.referencesEarlierWork && (!o.priorWorkAvailable || o.newsCall || o.clarify))
      p0.push('CONTINUATION_LOSES_WORK');
    if (e.mixed && !(o.knowledge !== null && MIXED_KNOWLEDGE.has(o.knowledge)))
      p0.push('MIXED_STABLE_ERASED');
    return {
      id: item.id,
      category: item.category,
      language: item.language,
      pass: failed.length === 0,
      failed,
      p0,
      observed: o,
    };
  });
  const group = (key: 'category' | 'language') => {
    const out: Record<string, { pass: number; total: number; p0: number }> = {};
    for (const r of rows) {
      const g = (out[r[key]] ??= { pass: 0, total: 0, p0: 0 });
      g.total++;
      if (r.pass) g.pass++;
      if (r.p0.length > 0) g.p0++;
    }
    return out;
  };
  const p0Counts: Record<P0, number> = {
    CONCEPTUAL_TO_NEWS: 0,
    CURRENT_TO_REASONING: 0,
    BILATERAL_COLLAPSE: 0,
    CONTINUATION_LOSES_WORK: 0,
    MIXED_STABLE_ERASED: 0,
  };
  rows.forEach((r) => r.p0.forEach((p) => p0Counts[p]++));
  const jobDistribution: Record<string, number> = {};
  rows.forEach((r) => {
    const k = r.observed.job ?? 'NULL';
    jobDistribution[k] = (jobDistribution[k] ?? 0) + 1;
  });
  writeFileSync(
    REPORT!,
    JSON.stringify(
      {
        overall: { pass: rows.filter((r) => r.pass).length, total: rows.length },
        p0Items: rows.filter((r) => r.p0.length > 0).length,
        p0: p0Counts,
        byLanguage: group('language'),
        byCategory: group('category'),
        byCheck: tally,
        jobDistribution,
        classifierDependent: rows.filter((r) => r.observed.classifierDependent).length,
        rows,
      },
      null,
      2,
    ),
  );
  expect(rows.length).toBe(set.items.length);
});
