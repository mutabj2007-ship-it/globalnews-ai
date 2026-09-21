import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BETA_FEATURE_FLAG_ENV_KEYS,
  resolveBetaFeatureFlags,
  type BetaFeatureFlags,
} from '../../../config/feature-flags';

/**
 * BETA-SIMPLE-ASK-SAND-1 §10 — the runtime feature-flag authority.
 *
 * Resolves all seven flags ONCE, at construction, and serves the same
 * frozen object thereafter.
 *
 * WHY RESOLVED ONCE RATHER THAN READ PER CALL: a flag that can change
 * mid-request is a correctness hazard for this particular feature set.
 * An operation quoted while SAND_CHARGING was off, then settled a
 * moment later while it was on, would charge a user who was shown a
 * free quote. Pinning the values for the process's lifetime makes that
 * impossible; changing a flag requires a restart, which is the normal
 * deployment mechanism on Railway anyway.
 *
 * Mirrors the existing repository pattern of a config service that
 * reads the environment once (see AnalysisConfigService).
 */
@Injectable()
export class BetaFeatureFlagsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BetaFeatureFlagsService.name);
  private readonly flags: BetaFeatureFlags;

  constructor(private readonly config: ConfigService) {
    this.flags = Object.freeze(
      resolveBetaFeatureFlags({
        betaSimpleHome: this.config.get<string>(BETA_FEATURE_FLAG_ENV_KEYS.betaSimpleHome),
        askConversationalV2: this.config.get<string>(
          BETA_FEATURE_FLAG_ENV_KEYS.askConversationalV2,
        ),
        askPersistence: this.config.get<string>(BETA_FEATURE_FLAG_ENV_KEYS.askPersistence),
        computeClassification: this.config.get<string>(
          BETA_FEATURE_FLAG_ENV_KEYS.computeClassification,
        ),
        meteredCompute: this.config.get<string>(BETA_FEATURE_FLAG_ENV_KEYS.meteredCompute),
        sandLedger: this.config.get<string>(BETA_FEATURE_FLAG_ENV_KEYS.sandLedger),
        sandCharging: this.config.get<string>(BETA_FEATURE_FLAG_ENV_KEYS.sandCharging),
      }),
    );
  }

  /**
   * Announces the resolved flag state at boot.
   *
   * SAND_CHARGING is logged at warn level when on, and only when on.
   * §10 makes charging-off the critical default of this entire
   * tranche, so an operator must never discover from a support ticket
   * that it was enabled — it has to be visible in the startup log.
   * Registered via OnApplicationBootstrap following the existing
   * AnalysisStartupValidator / NewsStartupValidator convention.
   */
  onApplicationBootstrap(): void {
    const enabled = Object.entries(this.flags)
      .filter(([, value]) => value)
      .map(([name]) => name);

    this.logger.log(
      enabled.length > 0
        ? `BETA feature flags enabled: ${enabled.join(', ')}.`
        : 'BETA feature flags: none enabled (baseline behavior).',
    );

    if (this.flags.sandCharging) {
      this.logger.warn(
        'SAND_CHARGING is ENABLED. Metered operations will consume Sand on settlement. ' +
          'This is not the BETA-SIMPLE-ASK-SAND-1 default and requires separate commercial approval.',
      );
    }
  }

  /** The resolved, frozen flag state. Never changes for this process's lifetime. */
  get(): BetaFeatureFlags {
    return this.flags;
  }
}
