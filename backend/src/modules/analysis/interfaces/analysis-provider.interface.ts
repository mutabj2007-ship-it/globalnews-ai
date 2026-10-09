import type { ResponseLanguage } from '../prompt/build-analysis-prompt.util';
import type {
  AnalysisEvidenceState,
  ComparisonCountryCoverage,
  ConversationSubjectAnchor,
  EventAnchor,
  EventEvidenceRelation,
  NewsArticle,
} from '@globalnews-ai/shared';

/**
 * Milestone #40 (authoritative-context correction) — the exact,
 * deterministic X/Y pair AnalysisService already derived via
 * deriveRelationalSearchQueries() for the current request, when the
 * question matched Milestone #37's relational pattern set. This is the
 * single source of truth for relational direction semantics: neither
 * this interface, any provider, nor the prompt layer parses or
 * re-derives X/Y from the question text — they only ever receive and
 * forward this exact object. Absent for any non-relational request
 * (ordinary M35/M36 generic queries, country/city retrieval).
 */
/**
 * EXECUTIVE-BRIEF-STRUCTURAL-COMPLIANCE-RECOVERY-1 — the shape of the
 * development-breadth fact carried to the provider. Mirrors
 * `DevelopmentBreadth` (validation/brief-compliance.util.ts) exactly.
 */
/**
 * PR #40 BLOCKER 1 — the AI-facing freshness fact.
 *
 *   'publisher'  the outlet stated this publication time.
 *   'observed'   an aggregator recorded SEEING the report at this time; an
 *                upper bound on publication, never the publication time.
 *   'unknown'    `publishedAtBasis` was absent; the time's meaning is unproven.
 */
export type EvidenceTimestampBasis = 'publisher' | 'observed' | 'unknown';

export interface EvidenceFreshnessFact {
  readonly timestamp: string;
  readonly basis: EvidenceTimestampBasis;
}

export interface AnalysisDevelopmentBreadth {
  /** Distinct stories after duplicate clustering. */
  readonly clusters: number;
  /** Distinct editorial domains across the retrieved set. */
  readonly categories: number;
  /** True when a single blended paragraph is NOT an acceptable answer. */
  readonly multiDevelopment: boolean;
  /**
   * ASK R2 LIVE-GATE REPAIR (P0-2) — the reader's own output contract (opening / table / closing)
   * shapes the brief: ONE "summary" filled in the contract's order, instead of the two-field
   * primary/additional split that fought it live. The compliance verdict is unchanged.
   */
  readonly readerContract?: boolean;
  /**
   * ASK R2 A/B/C BLOCKER REPAIR R1 — the reader's contract asks for a TABLE: the brief is generated
   * as three required fields (briefOpening, briefTable, briefClosing) joined in that order into
   * `summary` inside the provider. Live Alpha A: asked for "a two-sentence summary. Then … a compact
   * table", the one "summary" field came back as the two sentences only, twice (≈500 tokens).
   */
  readonly readerContractTable?: boolean;
}

export interface AnalysisRelationalContext {
  x: string;
  y: string;
}

/** PR #70 prompt boundary — trusted rules (system) and delimited retained data (user). */
export interface GovernedPromptParts {
  readonly rules: string;
  readonly data: string;
}

export interface AnalysisProviderInput {
  query: string;
  comparisonCoverage?: ComparisonCountryCoverage[];
  /** Already deduped/clustered and bounded to a reasonable count. */
  articles: NewsArticle[];
  /**
   * Milestone #40 (authoritative-context correction) — present only
   * when this request's query matched Milestone #37's relational
   * pattern set. A provider MAY use this to attempt relational
   * evidence-direction classification (see build-analysis-prompt.util.ts);
   * it must never be treated as license to fabricate assessments when
   * absent — validateAnalysisResult() independently and unconditionally
   * enforces that relationalEvidenceAssessments stay empty whenever
   * this field is absent, regardless of what any provider emits.
   */
  relationalContext?: AnalysisRelationalContext;

  /**
   * Milestone #47 — the language the provider must produce its
   * response in. Absent (or 'en') means English — the existing,
   * unmodified prompt behavior — so every pre-Milestone-#47 caller
   * that never sets this field is completely unaffected.
   */
  responseLanguage?: ResponseLanguage;

  /**
   * EXECUTIVE-BRIEF-STRUCTURAL-COMPLIANCE-RECOVERY-1 — THE AUTHORITATIVE
   * BREADTH, MEASURED ONCE.
   *
   * This is the value AnalysisService ALREADY computed with
   * `detectDevelopmentBreadth(deduped)` from the exact `articles` array
   * carried on this same input, and it is the SAME value
   * `assessBriefCompliance()` will judge the returned summary against
   * afterwards. It is not a second measurement and it costs nothing — no
   * extra provider call, no extra retrieval, no extra clustering pass.
   *
   * WHY IT EXISTS. The validator rejected briefs using an arithmetic the
   * model was never shown: the service knew this evidence set carried N
   * clusters across M domains, graded the answer against N and M, and told
   * the model only that it should "organise by material development". The
   * governing rule of this correction is that THE MODEL AND THE VALIDATOR
   * MUST RECEIVE THE SAME ALREADY-COMPUTED BREADTH FACT. This field is that
   * fact travelling to the model.
   *
   * It is structurally identical to `DevelopmentBreadth` in
   * validation/brief-compliance.util.ts, declared here rather than imported
   * for the same reason `AnalysisRelationalContext` is: the provider contract
   * does not depend on the validation module.
   *
   * ABSENT MEANS NOT MEASURED. The prompt then emits nothing extra and the
   * request is byte-identical to pre-recovery behaviour, so a provider or a
   * caller that never sets this is completely unaffected.
   */
  developmentBreadth?: AnalysisDevelopmentBreadth;

  /**
   * ASK/SEARCH R1 CLOSURE — what the evidence IS (live / retained /
   * degraded-fallback), stamped by AnalysisService with the one shared
   * derivation. A provider renders it into the prompt; it never re-derives it.
   * Absent means 'live' semantics for pre-existing callers.
   */
  evidenceState?: AnalysisEvidenceState;
  /**
   * PR #40 BLOCKER 1 — the newest evidence timestamp TOGETHER WITH what kind
   * of time it is, taken from that one article. Never a bare timestamp: an
   * 'observed' time (GDELT) is only an upper bound on publication, and an
   * absent basis proves nothing (shared/src/news.ts `publishedAtBasis`).
   */
  newestEvidence?: EvidenceFreshnessFact;

  /**
   * ASK CONVERSATIONAL EVIDENCE ANCHORING R1 — the structured event anchor and
   * each evidence item's relation to it, aligned with `articles` by index.
   * Absent for questions that do not reason about an event.
   */
  eventAnchor?: EventAnchor;
  eventEvidenceRelations?: EventEvidenceRelation[];

  /**
   * TOPIC CONTINUITY R1 — the continued non-event subject, when this answer
   * continues one. Only its subject span and disclosure codes reach the prompt;
   * nothing from any prior answer does.
   */
  conversationSubject?: ConversationSubjectAnchor;

  /**
   * MY INTELLIGENCE R1 — present only for a multi-story selection: which
   * action the reader ran and over how many selected stories. The stories
   * themselves are `articles`, resolved from retained reporting.
   */
  selection?: SelectionPromptContext;

  /**
   * ASK INTELLIGENCE BINDING LIVE ACCEPTANCE REPAIR R1 (PR #70 prompt boundary) — present only
   * when the Ask coordinator considered governed contributors:
   *   rules  trusted GlobalNewsAI policy → appended to the SYSTEM prompt;
   *   data   source-derived retained records, JSON inside GOVERNED_RETAINED_DATA delimiters →
   *          appended to the USER/evidence message, never to the system prompt.
   * Absent on every other call, which keeps those prompts byte-identical.
   */
  governed?: GovernedPromptParts;

  /**
   * BETA-ASK-005 — the bounded PUBLICATION window the evidence was restricted to. Rendered as
   * a system rule: it bounds publication, never the event. Absent on every other call.
   */
  reportingWindow?: { readonly statedPeriod: string; readonly from: string; readonly to: string };

  /**
   * BETA-ASK-004 R1B — the evidence was gathered by a multi-facet plan (compound / event), so
   * separately admitted reports must not be joined into a causal link none of them states.
   */
  evidenceLinkageGuard?: boolean;

  /**
   * PUBLIC BETA HARDENING R1B — an open-ended headlines request: what the evidence set can claim
   * to cover. LIVE = the live headline providers answered; LIMITED = a live source was refused
   * or only regional publisher feeds answered; RETAINED = previously retrieved reports only.
   */
  broadHeadlinesCoverage?: 'LIVE' | 'LIMITED' | 'RETAINED';

  /**
   * Optional caller cancellation. AnalysisService uses this only for the
   * authoritative response deadline: when the reader can no longer receive a
   * result, an in-flight model request must not keep spending tokens merely to
   * populate a cache nobody asked for.
   *
   * Providers that do not perform network work may ignore it. A real provider
   * must refuse/abort promptly when it is already aborted.
   */
  signal?: AbortSignal;

  /**
   * ASK R2 INTEGRATION R1 · GATE E — a CALLER-IMPOSED ceiling on model attempts. The
   * public Ask path passes `ASK_MODEL_MAX_ATTEMPTS` (1, F 02 R-1: no retry multiplies a
   * reader's spend). Absent → the provider's own accepted policy, unchanged for /analysis.
   * A provider may only ever make FEWER attempts than this, never more.
   */
  maxModelAttempts?: number;

  /**
   * ASK R2 INTEGRATION R1 · GATE E — where the provider reports the tokens a successful
   * call actually used, so the compute meter settles on ACTUAL units (F 01 L-9/L-14).
   * Called at most once, only on success, with counts only — never content or keys.
   */
  usageSink?: (usage: { readonly promptTokens: number; readonly completionTokens: number }) => void;

  /**
   * @deprecated EXECUTIVE-BRIEF-STRUCTURAL-COMPLIANCE-RECOVERY-1 — NOT SUPPLIED
   * BY ANY CALLER. The synchronous repair was removed by Alpha Budget R1
   * (`shared/src/analysis-budget.ts` derives the total WITHOUT it), so
   * AnalysisService never sets this field. The plumbing is retained, not
   * removed: it is the declared shape a governed ASYNCHRONOUS repair would
   * reuse, and deleting it would be a wider change than this correction needs.
   * Treat it as dead on the synchronous path.
   *
   * PO ruling D (C906) — the ONE targeted repair the service may request when
   * a brief fails the structural compliance check.
   *
   * Absent on every ordinary call, so a provider that ignores it behaves
   * exactly as before. When present it is appended to the system prompt as an
   * additional, explicitly bounded instruction; it never replaces the base
   * prompt, so every rule about evidence ids, invention and geographic scope
   * still binds the repaired answer.
   *
   * The service sends it at most once per request. There is no retry loop
   * here and there must never be one: a second failure is reported, not
   * re-asked.
   */
  repairDirective?: string;
}

/**
 * The contract every AI analysis provider must implement.
 *
 * Mirrors the NewsProvider pattern from the news module: AnalysisService
 * never references a concrete provider (OpenAI, or any future provider)
 * by name — it only depends on this interface via a DI token, so a new
 * provider can be added by writing one class and registering it in
 * AnalysisModule.
 *
 * A provider's output is NOT assumed to be valid. `analyzeNews` returns
 * `unknown` on purpose — AnalysisService is responsible for validating
 * whatever comes back (via validateAnalysisResult) before it is ever
 * trusted or returned to the frontend. This keeps "never trust model
 * output until validated" true regardless of which provider produced it.
 */
export interface AnalysisProvider {
  /** Stable machine-readable identifier, e.g. "openai", "mock-analysis". */
  readonly id: string;

  /** Human-readable name. */
  readonly displayName: string;

  /** Whether this provider returns synthetic/demo analysis rather than a real AI result. */
  readonly isMock: boolean;

  /** Produces a candidate analysis. Callers must validate the result before trusting it. */
  analyzeNews(input: AnalysisProviderInput): Promise<unknown>;
}

/** MY INTELLIGENCE R1 — the selection facts the prompt needs. */
export interface SelectionPromptContext {
  readonly action: import('@globalnews-ai/shared').MultiStoryAction;
  readonly storyCount: number;
}
