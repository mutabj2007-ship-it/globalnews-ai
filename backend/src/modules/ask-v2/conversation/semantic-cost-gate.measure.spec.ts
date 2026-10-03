import { readFileSync, writeFileSync } from 'node:fs';
import { routeAskR2, type AskRouteContext } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { semanticReaderText } from '../../ask-router/semantic-ir/interpret-turn';
import {
  estimateInterpreterPromptTokens,
  semanticInterpreterUserMessage,
  SEMANTIC_INTERPRETER_MAX_TOKENS,
} from '../../ask-router/semantic-ir/semantic-interpreter';
import { leavesArtifact } from '../job-execution';
import { readConversationalTurn } from './conversation-state';

/**
 * CTO R4 SEMANTIC IR §21 — THE COST GATE (measurement, not a test of correctness).
 *
 * Every reader turn of the given corpora (SEMANTIC_COST_SETS = comma-separated JSON sets in the
 * sealed / blind item shape) is routed exactly as the service and executor do before any model:
 * conversation state from the reader's earlier turns, the bounded state, and the route. For each
 * turn: did the deterministic interpretation finish (fast path), or does it need the ONE bounded
 * semantic call? For the latter: the interpreter's prompt size (its real user message + system,
 * chars / 4) and a typical answer size (the closed fields for that IR, chars / 4; the ceiling is
 * SEMANTIC_INTERPRETER_MAX_TOKENS). Also: how many turns the R4 UNRESOLVED-only classifier would
 * have called anyway (JOB_UNRESOLVED), so the ADDED calls are separate. Skipped without sets.
 */
const SETS = process.env.SEMANTIC_COST_SETS;
const REPORT = process.env.SEMANTIC_COST_REPORT;
const run = SETS && REPORT ? it : it.skip;

interface Item {
  id: string;
  language: 'en' | 'pl';
  turns: string[];
}

run('R4 semantic IR cost gate — fast path vs one bounded interpretation', () => {
  const out: Record<string, unknown> = {};
  const all = {
    turns: 0,
    fast: 0,
    semantic: 0,
    classifierAnyway: 0,
    promptTokens: [] as number[],
    outputTokens: [] as number[],
  };
  const conflictHistogram: Record<string, number> = {};
  for (const path of SETS!.split(',')) {
    const set = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')) as { items: Item[] };
    const s = { turns: 0, fast: 0, semantic: 0, classifierAnyway: 0 };
    for (const item of set.items) {
      const earlier: string[] = [];
      let priorWork: AskRouteContext['priorWork'];
      for (const q of item.turns) {
        const newestFirst = earlier
          .map((x) => ({ question: x, language: item.language }))
          .reverse();
        const turn = readConversationalTurn(q, item.language, newestFirst);
        const answered = turn?.composition?.effectiveQuestion ?? q;
        const conversation = {
          ...(priorWork === undefined ? {} : { artifact: priorWork }),
          ...(turn?.objective ? { objective: turn.objective } : {}),
          ...(turn?.choiceSet ? { choiceSet: turn.choiceSet } : {}),
          ...(turn?.state.portableSubject ? { portableSubject: turn.state.portableSubject } : {}),
        };
        const r = routeAskR2(
          {
            originalQuestion: answered,
            sourceLanguage: item.language,
            normalizationLanguage: item.language,
            displayLanguage: item.language,
            origin: 'ASK',
          },
          {
            requestInstant: '2026-10-03T08:00:00Z',
            ...(priorWork === undefined ? {} : { priorWork }),
            conversation,
            ...(turn?.turnIndex === undefined ? {} : { turnIndex: turn.turnIndex }),
          },
          { specialistRegistry: specialistRegistryFixture },
        );
        s.turns++;
        const ir = r.semantic;
        if (ir.resolution.needsSemanticResolution) {
          s.semantic++;
          if (ir.resolution.conflicts.includes('JOB_UNRESOLVED')) s.classifierAnyway++;
          for (const c of ir.resolution.conflicts)
            conflictHistogram[c] = (conflictHistogram[c] ?? 0) + 1;
          const msg = semanticInterpreterUserMessage(
            ir,
            semanticReaderText(answered, item.language),
            {
              ...(priorWork === undefined ? {} : { artifact: priorWork }),
              objective: turn?.objective?.criterion ?? null,
              ...(turn?.choiceSet ? { choiceSet: turn.choiceSet } : {}),
              portableSubject: turn?.state.portableSubject ?? null,
            },
          );
          all.promptTokens.push(estimateInterpreterPromptTokens(msg));
          /* a typical answer: the closed fields this IR asks for */
          const answer = JSON.stringify({
            job: ir.turn.primaryJob ?? 'EXPLANATION',
            needsCurrentEvidence: ir.turn.evidence !== 'NONE',
            depth: ir.turn.depth,
            transformation: ir.turn.transformation,
            confidence: 'HIGH',
            clauses: ir.clauses.map((c) => ({
              id: c.id,
              kind: c.freshness === 'CURRENT' ? 'CURRENT' : 'STABLE',
            })),
            relation:
              ir.relationships[0] === undefined
                ? null
                : {
                    actorA: ir.relationships[0].actorA,
                    actorB: ir.relationships[0].actorB,
                    type: ir.relationships[0].relation[0],
                    object: ir.relationships[0].object,
                    venue: ir.relationships[0].venue,
                  },
            reference: ir.references.target,
          });
          all.outputTokens.push(
            Math.min(SEMANTIC_INTERPRETER_MAX_TOKENS, Math.ceil(answer.length / 4)),
          );
        } else s.fast++;
        if (leavesArtifact(r.job) && r.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY')
          priorWork = { kind: 'CONCEPTUAL_FRAMEWORK', label: 'earlier work' };
        earlier.push(q);
      }
      all.turns += 0;
    }
    all.turns += s.turns;
    all.fast += s.fast;
    all.semantic += s.semantic;
    all.classifierAnyway += s.classifierAnyway;
    out[path.split(/[\\/]/).pop()!] = {
      ...s,
      fastPathPct: +((100 * s.fast) / s.turns).toFixed(1),
      semanticPct: +((100 * s.semantic) / s.turns).toFixed(1),
    };
  }
  const mean = (xs: number[]) =>
    xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  writeFileSync(
    REPORT!,
    JSON.stringify(
      {
        bySet: out,
        total: {
          turns: all.turns,
          fastPath: all.fast,
          semantic: all.semantic,
          fastPathPct: +((100 * all.fast) / all.turns).toFixed(1),
          semanticPct: +((100 * all.semantic) / all.turns).toFixed(1),
          r4ClassifierWouldHaveCalled: all.classifierAnyway,
          addedCallsVsR4Classifier: all.semantic - all.classifierAnyway,
          maxModelCallsPerTurnForInterpretation: 1,
          meanAddedInterpretationCallsPerAsk: +(all.semantic / all.turns).toFixed(3),
          interpreterPromptTokens: {
            mean: mean(all.promptTokens),
            max: Math.max(0, ...all.promptTokens),
          },
          interpreterOutputTokens: {
            meanEstimate: mean(all.outputTokens),
            ceiling: SEMANTIC_INTERPRETER_MAX_TOKENS,
          },
        },
        conflictHistogram,
      },
      null,
      2,
    ),
  );
  expect(all.turns).toBeGreaterThan(0);
});
