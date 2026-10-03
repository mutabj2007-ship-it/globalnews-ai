import { readFileSync, writeFileSync } from 'node:fs';
import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { readContinuationEllipsis } from '../../analysis/anchor/continuation-ellipsis.util';
import { evidencesRelationship } from '../../analysis/relevance/relationship-evidence.util';
import type { RelationKind } from '../../ask-router/bilateral-relationship';
import { servesIntent } from '../companion-relevance';
import { inheritedConversationCountry } from './conversation-place';
import { readConversationalTurn } from './conversation-state';

/**
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 §45 / §43 — THE BLIND EVALUATION HARNESS.
 *
 * Scores an externally authored evaluation set (ASK_BLIND_SET=<json>) through the same
 * deterministic layers the service runs before any model or provider: the conversation state
 * (composition / inherited place), the integrated router (frozen C), the executor's zero-compute
 * decisions, and the task-relevance readers. It reports RAW denominators per category and per
 * expectation to ASK_BLIND_REPORT (never to the console, so the set is not read while scoring).
 * Skipped when no set is supplied. Pure: no I/O beyond the two files, no model, no provider.
 */
const SET = process.env.ASK_BLIND_SET;
const REPORT = process.env.ASK_BLIND_REPORT;
const run = SET && REPORT ? it : it.skip;

interface BlindItem {
  id: string;
  category: string;
  language: 'en' | 'pl';
  turns: string[];
  expect: {
    newsCall: boolean | null;
    answerKind: 'BACKGROUND' | 'REPORTING' | 'CLARIFY' | 'ANY';
    places: string[] | null;
    carriesFromEarlier: boolean | null;
    survivesNewsOutage: boolean | null;
  };
  evidence: null | {
    task: 'travel' | 'relationship';
    countries: string[];
    relation: string | null;
    items: { title: string; summary: string; relevant: boolean }[];
  };
}

interface Observed {
  answered: string;
  newsCall: boolean;
  answerKind: 'BACKGROUND' | 'REPORTING' | 'CLARIFY' | 'COMPUTE' | 'UNAVAILABLE';
  places: string[];
  carries: boolean;
  survives: boolean;
  requirement: string | null;
  terminal: string;
}

function observe(item: BlindItem): Observed {
  const lang = item.language;
  const final = item.turns[item.turns.length - 1];
  const earlier = item.turns.slice(0, -1).map((question) => ({ question, language: lang }));
  const newestFirst = [...earlier].reverse();
  const turn = readConversationalTurn(final, lang, newestFirst);
  const answered = turn?.composition?.effectiveQuestion ?? final;
  const place =
    turn?.composition == null ? inheritedConversationCountry(final, lang, newestFirst) : null;
  const route = routeAskR2(
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
    },
    { specialistRegistry: specialistRegistryFixture },
  );
  const terminal = route.plan.terminalState;
  const requiresNews = route.plan.evidenceRequests.some(
    (e) => e.required && e.evidenceClass === 'NEWS_REPORTING',
  );
  /* the executor's zero-compute decisions, in its order */
  const constraintOnly = turn?.constraintOnly === true && turn.composition === null;
  const objectiveMissing =
    route.knowledgeRequirement === 'DECISION_SUPPORT' && route.decisionObjective === null;
  const bareEllipsis = readContinuationEllipsis(answered) !== null;
  const clarify =
    constraintOnly ||
    objectiveMissing ||
    (bareEllipsis && terminal !== 'REFERENCE_BACKGROUND_ONLY') ||
    terminal === 'CLARIFICATION_REQUIRED' ||
    terminal === 'BROADENING_OFFERED';
  const computed = route.plan.evidenceRequests.some(
    (e) => e.required && e.evidenceClass === 'COMPUTATION',
  );
  const background = !clarify && terminal === 'REFERENCE_BACKGROUND_ONLY';
  const newsCall =
    !clarify && !background && !computed && terminal === 'EXECUTABLE' && requiresNews;
  const answerKind: Observed['answerKind'] = clarify
    ? 'CLARIFY'
    : computed
      ? 'COMPUTE'
      : background
        ? 'BACKGROUND'
        : newsCall
          ? 'REPORTING'
          : 'UNAVAILABLE';
  const places = [
    ...new Set([
      ...route.envelope.geography.candidates.map((c) => c.value),
      ...(route.relationship?.countries ?? []),
      ...(route.outcome.status === 'NOT_READ'
        ? []
        : route.outcome.reading.geography.map((g) => g.value).filter((v) => v !== 'CONTESTED')),
    ]),
  ];
  return {
    answered,
    newsCall,
    answerKind,
    places,
    carries: turn?.composition != null || place !== null,
    /* a useful answer survives a news outage: no news needed, a partial (stable part) answer, or
       an honest ask-back */
    survives:
      !newsCall ||
      route.knowledgeRequirement === 'MIXED_REFERENCE_CURRENT' ||
      answerKind === 'CLARIFY',
    requirement: route.knowledgeRequirement,
    terminal,
  };
}

type Check =
  'newsCall' | 'answerKind' | 'places' | 'carriesFromEarlier' | 'survivesNewsOutage' | 'evidence';

run('blind evaluation — scored, raw denominators', () => {
  const set = JSON.parse(readFileSync(SET!, 'utf8').replace(/^﻿/, '')) as { items: BlindItem[] };
  const rows: {
    id: string;
    category: string;
    language: string;
    pass: boolean;
    failed: Check[];
    observed: Observed | null;
    evidence?: { correct: number; total: number };
  }[] = [];
  const tally: Record<Check, { pass: number; total: number }> = {
    newsCall: { pass: 0, total: 0 },
    answerKind: { pass: 0, total: 0 },
    places: { pass: 0, total: 0 },
    carriesFromEarlier: { pass: 0, total: 0 },
    survivesNewsOutage: { pass: 0, total: 0 },
    evidence: { pass: 0, total: 0 },
  };
  for (const item of set.items) {
    const failed: Check[] = [];
    const score = (check: Check, ok: boolean) => {
      tally[check].total++;
      if (ok) tally[check].pass++;
      else failed.push(check);
    };
    let observed: Observed | null = null;
    let evidence: { correct: number; total: number } | undefined;
    if (item.evidence !== null && item.evidence !== undefined) {
      const ev = item.evidence;
      let correct = 0;
      for (const a of ev.items) {
        const admitted =
          ev.task === 'travel'
            ? servesIntent({ title: a.title, summary: a.summary }, 'TRAVEL')
            : evidencesRelationship(
                { title: a.title, summary: a.summary },
                {
                  countries: ev.countries,
                  relations: [(ev.relation ?? 'GENERAL') as RelationKind],
                },
              );
        if (admitted === a.relevant) correct++;
      }
      evidence = { correct, total: ev.items.length };
      score('evidence', correct === ev.items.length);
    }
    if (item.turns.length > 0 && item.category !== 'irrelevant_evidence_trap') {
      observed = observe(item);
      const e = item.expect;
      if (e.newsCall !== null) score('newsCall', observed.newsCall === e.newsCall);
      if (e.answerKind !== 'ANY')
        score(
          'answerKind',
          observed.answerKind === e.answerKind ||
            (e.answerKind === 'BACKGROUND' && observed.answerKind === 'COMPUTE'),
        );
      if (e.places !== null)
        score(
          'places',
          e.places.length === 0
            ? observed.places.length === 0
            : e.places.every((p) => observed!.places.includes(p)),
        );
      if (e.carriesFromEarlier !== null)
        score('carriesFromEarlier', observed.carries === e.carriesFromEarlier);
      if (e.survivesNewsOutage !== null)
        score('survivesNewsOutage', observed.survives === e.survivesNewsOutage);
    }
    rows.push({
      id: item.id,
      category: item.category,
      language: item.language,
      pass: failed.length === 0,
      failed,
      observed,
      ...(evidence === undefined ? {} : { evidence }),
    });
  }
  const byCategory: Record<string, { pass: number; total: number }> = {};
  for (const r of rows) {
    byCategory[r.category] ??= { pass: 0, total: 0 };
    byCategory[r.category].total++;
    if (r.pass) byCategory[r.category].pass++;
  }
  const byLanguage: Record<string, { pass: number; total: number }> = {};
  for (const r of rows) {
    byLanguage[r.language] ??= { pass: 0, total: 0 };
    byLanguage[r.language].total++;
    if (r.pass) byLanguage[r.language].pass++;
  }
  writeFileSync(
    REPORT!,
    JSON.stringify(
      {
        items: rows.length,
        passed: rows.filter((r) => r.pass).length,
        byCategory,
        byLanguage,
        byCheck: tally,
        rows,
      },
      null,
      2,
    ),
  );
  expect(rows.length).toBe(set.items.length);
});
