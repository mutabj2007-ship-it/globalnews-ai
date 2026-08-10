import type { AnalysisProvider } from '../interfaces';

/**
 * Injection token for the single active AnalysisProvider.
 *
 * Unlike the news module (where multiple providers can each contribute
 * articles to one aggregated response), analysis is fundamentally a
 * single-provider operation per request — there's one AI call, not
 * several to merge. So this holds one provider, not an array.
 */
export const ANALYSIS_PROVIDER = Symbol('ANALYSIS_PROVIDER');

/**
 * Milestone #30 — the single shared definition of "is this API key
 * actually usable", so provider selection, the fail-closed startup
 * validator, and OpenAiAnalysisProvider's own defensive guard can never
 * disagree with one another. Deliberately NOT a plain truthiness check:
 * a whitespace-only value (e.g. `" "`) is truthy in JavaScript but is
 * not a usable key, and must not be silently treated as "configured"
 * by either provider selection or startup validation.
 */
export function isUsableOpenAiApiKey(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Pure selection logic, extracted from the NestJS factory so it can be
 * unit-tested without a DI container.
 *
 * live when OPENAI_API_KEY is configured (and actually usable — see
 * isUsableOpenAiApiKey), mock otherwise. This selection is boot-time
 * deterministic: it runs once when the DI container is built, and does
 * not re-evaluate for the lifetime of the process — changing which
 * provider is active requires an application restart. This is also a
 * deliberate mode switch (like GNews vs. Mock in the news module), not
 * a runtime fallback: if the key is present but the OpenAI call fails,
 * that surfaces as an error, not a silent drop into mock mode — mixing
 * real and demo analysis would misrepresent demo content as real AI
 * output.
 */
export function resolveActiveAnalysisProvider(
  openAiApiKey: string | undefined,
  mockProvider: AnalysisProvider,
  openAiProvider: AnalysisProvider,
): AnalysisProvider {
  return isUsableOpenAiApiKey(openAiApiKey) ? openAiProvider : mockProvider;
}
