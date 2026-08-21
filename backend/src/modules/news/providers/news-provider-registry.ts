import type { NewsProvider } from '../interfaces';

/**
 * E1 — one real provider candidate, paired with whether this
 * deployment has actually configured it.
 *
 * `isConfigured` is supplied by the caller (news.module.ts's
 * NEWS_PROVIDERS factory) rather than computed here, so this file
 * never learns the name of any environment variable and stays a pure,
 * synchronously testable function. Adding a second real provider means
 * appending one entry to the `realCandidates` array at the call site —
 * nothing in this file changes.
 */
export interface RealNewsProviderCandidate {
  readonly provider: NewsProvider;

  /**
   * Whether this deployment has genuinely configured this provider
   * (e.g. a usable API key is present). Never a guess and never a
   * liveness check: an unreachable-but-configured provider is still
   * "configured" here, and its failure is handled at request time by
   * NewsService's Promise.allSettled isolation, not by silently
   * dropping it from the active set at boot.
   */
  readonly isConfigured: boolean;
}

/**
 * E1 — raised when the registry is asked to treat a mock provider as
 * real, or a real provider as the mock fallback. This is a
 * construction-time programming error, not a runtime condition, and it
 * fails closed: the module refuses to build rather than producing an
 * active provider set that could blend synthetic and real reporting.
 */
export class NewsProviderRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewsProviderRegistrationError';
  }
}

export interface NewsProviderSelectionInput {
  /**
   * Every REAL provider this build knows how to run, in registration
   * order. Registration order is the deployment's declared preference
   * order and is the final tiebreaker for cross-provider duplicate
   * winner selection (see cross-provider-dedup.util.ts) — so it must
   * stay a deliberate, stable list, never a set.
   */
  readonly realCandidates: readonly RealNewsProviderCandidate[];

  /**
   * The single demo/sample provider, used ONLY when zero real
   * providers are configured.
   */
  readonly mockProvider: NewsProvider;
}

/**
 * E1 — the active-provider rule, in one place.
 *
 * BEFORE E1 this was an exclusive ternary inside news.module.ts:
 * `hasGNewsKey ? [gnewsProvider] : [mockNewsProvider]` — structurally
 * incapable of holding two real providers at once.
 *
 * AFTER E1 the rule is accumulating, and unchanged in its guarantees:
 *
 * - At least one real provider configured  -> EVERY configured real
 *   provider is active, in registration order. The mock provider is
 *   excluded entirely.
 * - Zero real providers configured         -> exactly [mockProvider].
 *
 * MockNewsProvider is therefore never mixed with a real provider under
 * any input. That is enforced structurally here (the two branches are
 * mutually exclusive and neither can produce a blended array), and the
 * guards below make the inverse mistakes — a mock masquerading as a
 * real candidate, or a real provider passed as the mock fallback —
 * impossible to express rather than merely discouraged.
 *
 * With exactly one real candidate configured this returns the same
 * single-element array the pre-E1 ternary returned, so today's
 * deployed behaviour is byte-for-byte unchanged.
 */
export function selectActiveNewsProviders({
  realCandidates,
  mockProvider,
}: NewsProviderSelectionInput): NewsProvider[] {
  for (const candidate of realCandidates) {
    if (candidate.provider.isMock) {
      throw new NewsProviderRegistrationError(
        `Provider "${candidate.provider.id}" reports isMock=true but was registered as a real ` +
          'news provider. Mock providers must never be admitted to the real provider set.',
      );
    }
  }

  if (!mockProvider.isMock) {
    throw new NewsProviderRegistrationError(
      `Provider "${mockProvider.id}" reports isMock=false but was registered as the mock ` +
        'fallback provider. The mock fallback must be a genuinely synthetic provider.',
    );
  }

  const configuredRealProviders = realCandidates
    .filter((candidate) => candidate.isConfigured)
    .map((candidate) => candidate.provider);

  if (configuredRealProviders.length > 0) {
    return configuredRealProviders;
  }

  return [mockProvider];
}

/**
 * E1 — every REGISTERED provider (real and mock alike), in a stable
 * order, regardless of which ones are currently active for reads.
 *
 * This backs ALL_NEWS_PROVIDERS, which exists so
 * GET /news/providers/health can report a configured-but-inactive
 * provider's status without that provider ever contributing an
 * article to a response. Keeping it separate from the active set is
 * what guarantees mock and real article data are never blended — see
 * provider.tokens.ts.
 */
export function collectRegisteredNewsProviders({
  realCandidates,
  mockProvider,
}: NewsProviderSelectionInput): NewsProvider[] {
  return [mockProvider, ...realCandidates.map((candidate) => candidate.provider)];
}
