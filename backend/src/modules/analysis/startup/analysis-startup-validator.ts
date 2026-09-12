import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { isUsableOpenAiApiKey } from '../providers/provider.tokens';

/**
 * Thrown when production AI mode is configured (AI_EXECUTION_MODE=production)
 * but OPENAI_API_KEY is missing, empty, or whitespace-only. Never includes
 * the key's value — only the fact that it is unusable.
 */
export class AnalysisStartupConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisStartupConfigurationError';
  }
}

/**
 * Milestone #30 — fail-closed startup guard.
 *
 * Provider selection itself (see provider.tokens.ts) already silently
 * chooses mock analysis whenever OPENAI_API_KEY isn't usable — which is
 * exactly the right behavior for local/dev use, and is documented as
 * such in .env.example. What that selection logic does NOT do is refuse
 * to boot: a production deploy with a missing/blank/typo'd key would
 * previously start up "successfully" and only ever reveal the problem
 * once real traffic arrived (as mock analysis, or as a stream of
 * per-request auth failures) — never announced to an operator at
 * deploy time.
 *
 * This validator closes that gap. It runs once per process, via Nest's
 * OnApplicationBootstrap lifecycle hook (fired after all providers are
 * constructed, before the HTTP listener starts accepting traffic), and:
 *
 * - In development mode (the default — AI_EXECUTION_MODE is unset or
 *   anything other than "production"): does nothing but log which mode
 *   is active. A missing key is expected and mock analysis is fine.
 *
 * - In production mode (AI_EXECUTION_MODE=production): requires
 *   OPENAI_API_KEY to be present AND non-blank (see
 *   isUsableOpenAiApiKey — a whitespace-only value does NOT count,
 *   deliberately not relying on plain truthiness). If it isn't usable,
 *   this throws, which — because backend/src/main.ts's bootstrap() has
 *   no try/catch of its own around NestFactory.create() — surfaces as
 *   an unhandled rejection and a non-zero process exit: the application
 *   never finishes starting, and never accepts a request while
 *   misconfigured.
 *
 * This governs boot-time configuration validity only. It does NOT
 * retry, does NOT poll for the key to become valid, and does NOT change
 * provider selection at runtime — provider selection remains boot-time
 * deterministic (Milestone #30 CTO constraint); fixing a bad key still
 * requires a restart, same as changing which provider is active always
 * has.
 */
@Injectable()
export class AnalysisStartupValidator implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnalysisStartupValidator.name);

  constructor(private readonly analysisConfig: AnalysisConfigService) {}

  onApplicationBootstrap(): void {
    const config = this.analysisConfig.get();

    if (config.executionMode !== 'production') {
      this.logger.log(
        `AI_EXECUTION_MODE=${config.executionMode}: mock analysis is permitted when OPENAI_API_KEY is not configured.`,
      );
      return;
    }

    if (!isUsableOpenAiApiKey(config.openAiApiKey)) {
      const reason =
        config.openAiApiKey === undefined || config.openAiApiKey === ''
          ? 'OPENAI_API_KEY is missing or empty.'
          : 'OPENAI_API_KEY is whitespace-only.';

      // Never log the key's value — only the fact that it's unusable.
      this.logger.error(
        `Refusing to start: AI_EXECUTION_MODE=production requires a valid OPENAI_API_KEY. ${reason} ` +
          'Set a real OPENAI_API_KEY, or set AI_EXECUTION_MODE=development to allow mock analysis.',
      );

      throw new AnalysisStartupConfigurationError(
        `Production AI mode requires a valid OPENAI_API_KEY. ${reason}`,
      );
    }

    this.logger.log(
      'AI_EXECUTION_MODE=production: OPENAI_API_KEY is configured — production AI analysis is enabled.',
    );
  }
}
