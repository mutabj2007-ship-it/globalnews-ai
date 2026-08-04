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
 * Pure selection logic, extracted from the NestJS factory so it can be
 * unit-tested without a DI container.
 *
 * live when OPENAI_API_KEY is configured, mock otherwise. This is a
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
  return openAiApiKey ? openAiProvider : mockProvider;
}
