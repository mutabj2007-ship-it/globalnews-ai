import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';

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
export interface AnalysisDevelopmentBreadth {
  /** Distinct stories after duplicate clustering. */
  readonly clusters: number;
  /** Distinct editorial domains across the retrieved set. */
  readonly categories: number;
  /** True when a single blended paragraph is NOT an acceptable answer. */
  readonly multiDevelopment: boolean;
}

export interface AnalysisRelationalContext {
  x: string;
  y: string;
}

export interface AnalysisProviderInput {
  query: string;
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
  responseLanguage?: LanguageCode;

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
