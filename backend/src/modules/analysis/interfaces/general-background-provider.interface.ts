import type { AnalysisFailureReason, LanguageCode } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GENERAL BACKGROUND EXECUTION R1 — THE GENERAL-BACKGROUND PROVIDER SEAM
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Frozen C already plans a `REFERENCE_BACKGROUND_ONLY` terminal for a stable,
 * non-time-sensitive question (`RoutingPlan.modelPriorPermitted`,
 * `modelPriorCitable: false` — never touched here). What was missing was an
 * EXECUTOR for that terminal: before this seam, `AskR2ExecutionAdapter` fell
 * through into the news-retrieval analysis path for these questions, which
 * either (a) burned an irrelevant news search and returned a "no evidence"
 * refusal for an ordinary explanatory question, or (b) mislabelled a
 * coincidental news-analysis result as background.
 *
 * This interface is deliberately NOT `AnalysisProvider`: that provider's
 * `buildAnalysisMessages` prompt and JSON schema are evidence-citation
 * machinery (cite these articles, by index, under these rules) — reusing it
 * with `articles: []` would either produce a citation-shaped answer with
 * nothing to cite, or silently coax the model into fabricating a citation
 * shape. A general-background answer is a structurally different job: plain
 * text, no articles, no citation, no source. Two small, dedicated
 * implementations (OpenAI-backed, mock) mirror the existing AnalysisProvider
 * pair without touching it.
 */
export interface GeneralBackgroundInput {
  readonly question: string;
  readonly responseLanguage: LanguageCode;
  /** Ask R2 Gate E ceiling (ASK_MODEL_MAX_ATTEMPTS = 1 today). Never raised here. */
  readonly maxModelAttempts?: number;
  readonly signal?: AbortSignal;
  readonly usageSink?: (usage: { promptTokens: number; completionTokens: number }) => void;
  /**
   * ASK INTELLIGENCE BINDING LIVE ACCEPTANCE REPAIR R1 (PR #70 prompt boundary) — present only
   * when the Ask coordinator considered governed contributors:
   *   rules  trusted GlobalNewsAI policy → appended to the SYSTEM prompt;
   *   data   source-derived retained records, JSON inside GOVERNED_RETAINED_DATA delimiters →
   *          appended to the USER/evidence message, never to the system prompt.
   * Absent on every other call, which keeps those prompts byte-identical.
   */
  readonly governed?: { readonly rules: string; readonly data: string };
  /**
   * TRUST & CONVERSATIONAL EXPERIENCE R1 — the reader's OWN previous question in this thread,
   * present only for a follow-up ("Compare it with Kenya" after a Tanzania safari question).
   * Untrusted reader text: it travels as delimited data in the USER message, never as rules.
   */
  readonly priorQuestion?: string;
}

export interface GeneralBackgroundOutput {
  /**
   * `null` means the model judged the question unanswerable from background
   * alone (it needs current/live information, or the model could not answer
   * responsibly) — never a fabricated "I don't know" citation, just an
   * absence the caller maps to the existing CAPABILITY_UNAVAILABLE state.
   */
  readonly text: string | null;
}

export class GeneralBackgroundProviderError extends Error {
  constructor(
    message: string,
    public readonly failureReason: AnalysisFailureReason,
    public readonly retryable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GeneralBackgroundProviderError';
  }
}

export interface GeneralBackgroundProvider {
  readonly id: string;
  readonly displayName: string;
  readonly isMock: boolean;
  answerBackground(input: GeneralBackgroundInput): Promise<GeneralBackgroundOutput>;
}
