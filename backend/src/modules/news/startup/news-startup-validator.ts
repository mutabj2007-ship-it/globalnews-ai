import { describeUnusableCredential } from '../../../security/placeholder-credential';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUsableGNewsApiKey } from '../providers/provider.tokens';
import { readerRightsEnforced } from '../rights/reader-rights';
import { providerAdmission } from '../rights/provider-admission';

/**
 * Thrown when the application is running in production (NODE_ENV=production)
 * but GNEWS_API_KEY is missing, empty, or whitespace-only. Never includes
 * the key's value — only the fact that it is unusable.
 */
export class NewsStartupConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewsStartupConfigurationError';
  }
}

/**
 * Milestone #33 — fail-closed startup guard for the news provider,
 * mirroring AnalysisStartupValidator's pattern exactly (see
 * analysis/startup/analysis-startup-validator.ts).
 *
 * Provider selection itself (see news.module.ts's NEWS_PROVIDERS
 * factory) already silently chooses MockNewsProvider whenever
 * GNEWS_API_KEY isn't usable — correct behavior for local/dev use.
 * What that selection logic does NOT do is refuse to boot: a
 * production deploy with a missing/blank/whitespace-only key would
 * previously start up "successfully" and silently serve synthetic
 * mock articles as if they were live reporting, with no operator-
 * visible signal at deploy time.
 *
 * This validator closes that gap. It runs once per process, via
 * Nest's OnApplicationBootstrap lifecycle hook, and:
 *
 * - Outside production (NODE_ENV is unset or anything other than
 *   "production"): does nothing but log which mode is active. A
 *   missing key is expected and MockNewsProvider is fine.
 *
 * - In production (NODE_ENV=production): requires GNEWS_API_KEY to be
 *   usable per isUsableGNewsApiKey — the exact same whitespace-safe
 *   check used by provider selection, so the two can never disagree.
 *   If it isn't usable, this throws, which surfaces as an unhandled
 *   rejection and a non-zero process exit: the application never
 *   finishes starting, and never accepts a request while
 *   misconfigured.
 *
 * Deliberately does NOT make a network/API request to GNews to verify
 * the credential — a nonblank key is considered "configured" for
 * startup purposes. An invalid/revoked key that GNews itself rejects
 * (401/403) remains a runtime provider failure, already handled by
 * GNewsProvider/NewsService — out of scope for this milestone.
 *
 * This governs boot-time configuration presence only. It does NOT
 * retry, does NOT poll, and does NOT change provider selection at
 * runtime — fixing a bad key still requires a restart.
 */
@Injectable()
export class NewsStartupValidator implements OnApplicationBootstrap {
  private readonly logger = new Logger(NewsStartupValidator.name);

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const nodeEnv = this.config.get<string>('NODE_ENV')?.trim().toLowerCase();

    if (nodeEnv !== 'production') {
      this.logger.log(
        `NODE_ENV=${nodeEnv ?? 'undefined'}: MockNewsProvider is permitted when GNEWS_API_KEY is not configured.`,
      );
      return;
    }

    const gnewsApiKey = this.config.get<string>('GNEWS_API_KEY');

    /*
      MASTER CTO R62/R64 · #96 GATE A — BOOT NO LONGER DEPENDS ON THE FREE GNEWS KEY. The guard
      above existed so a production process could never serve MockNewsProvider's synthetic
      articles as live reporting. Gate A now refuses to START any provider without a recorded
      per-use right (provider-admission.ts), the mock included, so that risk is closed at the
      provider itself. A production process with no usable key therefore boots in the
      no-permitted-news mode: health, stored (read-time withheld) answers and general-knowledge
      Ask are served; news is "not searched", with zero provider requests. Outside enforcement
      (the Jest fixture mode only) the original refusal is kept unchanged.
    */
    if (!isUsableGNewsApiKey(gnewsApiKey) && readerRightsEnforced()) {
      const reason = describeUnusableCredential('GNEWS_API_KEY', gnewsApiKey);
      this.logger.warn(
        `NODE_ENV=production: GNEWS_API_KEY is not usable (${reason}). Booting with NO news provider ` +
          'admitted: news is not searched and no mock news is served (Gate A, provider-admission.ts).',
      );
      return;
    }

    if (!isUsableGNewsApiKey(gnewsApiKey)) {
      const reason = describeUnusableCredential('GNEWS_API_KEY', gnewsApiKey);

      // Never log the key's value — only the fact that it's unusable.
      this.logger.error(
        `Refusing to start: NODE_ENV=production requires a valid GNEWS_API_KEY. ${reason} ` +
          'Set a real GNEWS_API_KEY, or run with NODE_ENV unset/development to allow MockNewsProvider.',
      );

      throw new NewsStartupConfigurationError(
        `Production news retrieval requires a valid GNEWS_API_KEY. ${reason}`,
      );
    }

    this.logger.log(
      providerAdmission({ id: 'gnews' }).admitted
        ? 'NODE_ENV=production: GNEWS_API_KEY is configured — live news retrieval is enabled.'
        : 'NODE_ENV=production: GNEWS_API_KEY is configured but GNews is NOT admitted (no recorded per-use right, Gate A): it is never called.',
    );
  }
}
