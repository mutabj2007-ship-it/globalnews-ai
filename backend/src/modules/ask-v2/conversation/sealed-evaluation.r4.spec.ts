import { readFileSync, writeFileSync } from 'node:fs';
import { routeAskR2, type AskRouteContext, type AskR2Route } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { readContinuationEllipsis } from '../../analysis/anchor/continuation-ellipsis.util';
import { FALLBACK_SEMANTIC_JOB } from '../job-execution';
import { inheritedConversationCountry } from './conversation-place';
import { readConversationalTurn } from './conversation-state';

/**
 * CTO R4 — THE SEALED EVALUATION HARNESS (frozen before the sealed set existed).
 *
 * Scores an externally authored set (ASK_R4_SET=<json>) through the same deterministic layers the
 * service and executor run before any model or provider, in their order:
 *   1. conversation state (composition / inherited place) from the reader's earlier turns;
 *   2. prior WORK: an earlier turn whose job produces work (framework, diagnosis, plan…) and that
 *      the executor would answer by reasoning is assumed to have left an artifact (the model is
 *      told to; this is the optimistic assumption, stated in the report);
 *   3. the integrated router with that prior work;
 *   4. an UNRESOLVED route is re-routed with the NO-CLASSIFIER fallback verdict, exactly as the
 *      adapter does when no classifier is available — these items are counted separately as
 *      classifier-dependent (in production the bounded classifier decides them);
 *   5. the executor's zero-compute decisions (clarification, constraint, objective missing).
 * Writes RAW denominators to ASK_R4_REPORT (never to the console). Skipped when no set is given.
 */
const SET = process.env.ASK_R4_SET;
const REPORT = process.env.ASK_R4_REPORT;
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
  };
}

const WORK_JOBS = new Set([
  'DEEP_CONCEPTUAL_ANALYSIS',
  'DECISION_SUPPORT',
  'ADVISORY',
  'PLANNING',
  'TRANSFORMATION',
  'COMPARISON',
]);

interface Observed {
  answered: string;
  job: string | null;
  source: string;
  classifierDependent: boolean;
  newsCall: boolean;
  clarify: boolean;
  reference: string;
  planHorizonDays: number | null;
  terminal: string;
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
  const horizon = route.job.temporal.find((t) => t.role === 'PLAN_HORIZON');
  return {
    answered,
    job: route.job.job,
    source: classifierDependent ? 'FALLBACK' : route.job.source,
    classifierDependent,
    /* BROADENING_OFFERED is frozen C's news terminal: the reader is offered the news search */
    newsCall: !clarify && requiresNews && terminal !== 'REFERENCE_BACKGROUND_ONLY',
    clarify,
    reference: route.job.discourseReference,
    planHorizonDays: horizon?.days ?? null,
    terminal,
  };
}

function observe(item: SealedItem): Observed {
  let priorWork: AskRouteContext['priorWork'];
  const earlier: string[] = [];
  let last: Observed | null = null;
  for (const q of item.turns) {
    last = routeTurn(q, item.language, earlier, priorWork);
    if (last.job !== null && WORK_JOBS.has(last.job) && !last.newsCall && !last.clarify)
      priorWork = { kind: 'CONCEPTUAL_FRAMEWORK', label: 'earlier work' };
    earlier.push(q);
  }
  return last!;
}

type Check = 'newsCall' | 'job' | 'reference' | 'planHorizon';

run('R4 sealed evaluation — scored, raw denominators', () => {
  const set = JSON.parse(readFileSync(SET!, 'utf8').replace(/^﻿/, '')) as {
    items: SealedItem[];
  };
  const tally: Record<Check, { pass: number; total: number }> = {
    newsCall: { pass: 0, total: 0 },
    job: { pass: 0, total: 0 },
    reference: { pass: 0, total: 0 },
    planHorizon: { pass: 0, total: 0 },
  };
  const rows = set.items.map((item) => {
    const o = observe(item);
    const failed: Check[] = [];
    const score = (c: Check, ok: boolean) => {
      tally[c].total++;
      if (ok) tally[c].pass++;
      else failed.push(c);
    };
    const e = item.expect;
    score('newsCall', o.newsCall === e.newsCall);
    score('job', o.job !== null && e.jobs.includes(o.job));
    if (e.referencesEarlierWork) score('reference', o.reference === 'PRIOR_WORK');
    if (e.planHorizonDays !== null) score('planHorizon', o.planHorizonDays === e.planHorizonDays);
    /* P0 misroutes: reasoning sent to news, or news answered by reasoning */
    const p0 =
      o.newsCall !== e.newsCall
        ? e.newsCall
          ? 'NEWS_ANSWERED_BY_REASONING'
          : 'REASONING_SENT_TO_NEWS'
        : null;
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
    const out: Record<string, { pass: number; total: number }> = {};
    for (const r of rows) {
      const g = (out[r[key]] ??= { pass: 0, total: 0 });
      g.total++;
      if (r.pass) g.pass++;
    }
    return out;
  };
  writeFileSync(
    REPORT!,
    JSON.stringify(
      {
        overall: { pass: rows.filter((r) => r.pass).length, total: rows.length },
        byLanguage: group('language'),
        byCategory: group('category'),
        byCheck: tally,
        p0: {
          reasoningSentToNews: rows.filter((r) => r.p0 === 'REASONING_SENT_TO_NEWS').length,
          newsAnsweredByReasoning: rows.filter((r) => r.p0 === 'NEWS_ANSWERED_BY_REASONING').length,
        },
        classifierDependent: rows.filter((r) => r.observed.classifierDependent).length,
        rows,
      },
      null,
      2,
    ),
  );
  expect(rows.length).toBe(set.items.length);
});
