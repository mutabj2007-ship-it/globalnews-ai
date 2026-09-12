import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * PAF-R1.1 — the frame route's request lifecycle and view decision,
 * extracted so both can be EXECUTED in a spec.
 *
 * WHY THIS MODULE EXISTS. The R1 blocker lived in an effect and a render
 * guard, and this repository's jest runs `testEnvironment: 'node'` with
 * no jsdom and no test renderer — so an effect cannot be driven by
 * mounting. `staleResponseProtection.spec.ts` already established the
 * repository's answer to that: model the behaviour, execute the model,
 * and assert the real source implements it. This module goes one step
 * further and makes the model BE the implementation, so the two cannot
 * drift: the component holds state and JSX, and every decision that
 * caused the blocker is decided here, in code a spec can run directly.
 */

/* ------------------------------------------------------------------ *
 * 1. The view decision
 * ------------------------------------------------------------------ */

export type FrameView = 'no-question' | 'loading' | 'failed' | 'frame';

export interface FrameViewState {
  readonly hasQuery: boolean;
  readonly isLoading: boolean;
  readonly response: AnalysisApiResponse | null;
  readonly fetchError: string | null;
}

/**
 * FOUR DISJOINT, EXHAUSTIVE BRANCHES, IN THIS ORDER.
 *
 * The R1 defect was a single condition that could not tell "nothing has
 * happened yet" from "a request is in flight". The order below makes
 * that distinction structural: `no-question` is decided BEFORE anything
 * about loading is consulted, so a route with no question can never
 * reach the spinner however the other three values happen to sit.
 *
 * `loading` therefore requires `hasQuery`, and `isLoading` is only ever
 * true while a request is pending — which together give the property the
 * CTO asked for: no loading state may exist without a pending request.
 */
export function resolveFrameView(state: FrameViewState): FrameView {
  if (!state.hasQuery) return 'no-question';
  if (state.isLoading) return 'loading';
  if (state.fetchError !== null) return 'failed';
  if (state.response === null) return 'failed';
  return 'frame';
}

/* ------------------------------------------------------------------ *
 * 2. The request lifecycle
 * ------------------------------------------------------------------ */

export interface AnalysisRequestPorts {
  /** Injected so a spec can count calls. Production passes analyzeNews. */
  readonly analyze: (query: string, language: LanguageCode) => Promise<AnalysisApiResponse>;
  readonly resolveErrorMessage: (error: unknown, dictionary: Dictionary) => string;
  readonly onLoading: (loading: boolean) => void;
  readonly onResult: (response: AnalysisApiResponse) => void;
  readonly onError: (message: string) => void;
  readonly onReset: () => void;
  /** The stale guard. Returns true once this request has been superseded. */
  readonly isCancelled: () => boolean;
}

export interface AnalysisRequestInput {
  readonly query: string;
  readonly language: LanguageCode;
  readonly dictionary: Dictionary;
}

/**
 * Issues AT MOST ONE analyze() call, and NONE when there is no question.
 *
 * The empty-question path resolves all three pieces of state explicitly
 * rather than returning early and leaving them at their initial values —
 * that early return, and nothing else, is what produced the R1 blocker.
 *
 * Every callback is guarded by `isCancelled()`, so a slower first request
 * can never overwrite a newer query's result, in either direction.
 */
export async function runAnalysisRequest(
  input: AnalysisRequestInput,
  ports: AnalysisRequestPorts,
): Promise<void> {
  const { query, language, dictionary } = input;

  if (query.trim().length === 0) {
    ports.onLoading(false);
    ports.onReset();
    return;
  }

  ports.onLoading(true);
  ports.onReset();

  try {
    const result = await ports.analyze(query, language);
    if (!ports.isCancelled()) ports.onResult(result);
  } catch (error: unknown) {
    if (!ports.isCancelled()) ports.onError(ports.resolveErrorMessage(error, dictionary));
  } finally {
    if (!ports.isCancelled()) ports.onLoading(false);
  }
}

/** The transition target, so the href is built in exactly one place. */
export function frameHrefFor(query: string, dimension?: string): string {
  const base = `/analysis?q=${encodeURIComponent(query)}`;
  return dimension === undefined ? base : `${base}&d=${encodeURIComponent(dimension)}`;
}
