import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thrown when NODE_ENV=production but FRONTEND_ORIGIN is missing,
 * empty, or whitespace-only. Never includes the configured value.
 */
export class CorsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorsConfigurationError';
  }
}

/** Unchanged from pre-M34 behavior — the development-only fallback origin. */
const DEVELOPMENT_FALLBACK_ORIGIN = 'http://localhost:3000';

function isUsableFrontendOrigin(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Milestone #34 — the single shared definition of what CORS origin to
 * use, so backend/src/main.ts's app.enableCors() call and
 * CorsStartupValidator's fail-closed production guard can never
 * disagree (per CTO architecture rule). Mirrors isUsableGNewsApiKey
 * (Milestone #33, news/providers/provider.tokens.ts) and
 * isUsableOpenAiApiKey (Milestone #30, analysis/providers/provider.tokens.ts):
 * a whitespace-only value is not usable — deliberately not a plain
 * truthiness check.
 *
 * Development (nodeEnv !== 'production'): a usable FRONTEND_ORIGIN is
 * used verbatim (trimmed); otherwise falls back to
 * DEVELOPMENT_FALLBACK_ORIGIN — unchanged from pre-M34 behavior.
 *
 * Production (nodeEnv === 'production'): FRONTEND_ORIGIN must be
 * usable or this throws CorsConfigurationError — DEVELOPMENT_FALLBACK_ORIGIN
 * is never reachable in production. No network request is made to
 * verify the origin; a well-formed, nonblank value is considered
 * configured for startup purposes.
 *
 * CORS is a browser same-origin convenience, not an authentication or
 * API security boundary — non-browser clients are unaffected by this
 * setting either way. Rate limiting (ThrottlerModule in app.module.ts)
 * is this milestone's actual abuse-control mechanism.
 */
export function resolveFrontendOrigin(
  nodeEnv: string | undefined,
  frontendOrigin: string | undefined,
): string {
  const isProduction = nodeEnv?.trim().toLowerCase() === 'production';
  const usable = isUsableFrontendOrigin(frontendOrigin);

  if (!isProduction) {
    return usable ? (frontendOrigin as string).trim() : DEVELOPMENT_FALLBACK_ORIGIN;
  }

  if (!usable) {
    const reason =
      frontendOrigin === undefined || frontendOrigin === ''
        ? 'FRONTEND_ORIGIN is missing or empty.'
        : 'FRONTEND_ORIGIN is whitespace-only.';

    throw new CorsConfigurationError(
      `Production CORS configuration requires a valid FRONTEND_ORIGIN. ${reason}`,
    );
  }

  return (frontendOrigin as string).trim();
}

/**
 * Milestone #34 — fail-closed startup guard, mirroring
 * AnalysisStartupValidator (M30) / NewsStartupValidator (M33) exactly:
 * registered as a plain provider so Nest's OnApplicationBootstrap
 * lifecycle invokes it automatically.
 *
 * Note on timing: backend/src/main.ts calls app.enableCors() before
 * app.listen() — and Nest's OnApplicationBootstrap hooks fire as part
 * of listen()'s internal init(), i.e. AFTER enableCors() has already
 * run. So it is main.ts's own direct call to resolveFrontendOrigin()
 * (not this validator) that actually produces the fail-closed effect
 * at real boot time. This validator exists as the same DI-testable,
 * defense-in-depth guard established for OPENAI_API_KEY/GNEWS_API_KEY —
 * both main.ts and this validator call the identical
 * resolveFrontendOrigin() function, so they can never disagree about
 * what's usable, and this validator still independently throws (and
 * still fails the boot) if it is ever reached with a bad value.
 */
@Injectable()
export class CorsStartupValidator implements OnApplicationBootstrap {
  private readonly logger = new Logger(CorsStartupValidator.name);

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const frontendOrigin = this.config.get<string>('FRONTEND_ORIGIN');

    // Throws CorsConfigurationError in production when unusable — this
    // is the same function main.ts calls, so behavior can't diverge.
    const resolved = resolveFrontendOrigin(nodeEnv, frontendOrigin);

    this.logger.log(
      nodeEnv?.trim().toLowerCase() === 'production'
        ? `NODE_ENV=production: CORS restricted to configured FRONTEND_ORIGIN ("${resolved}").`
        : `NODE_ENV=${nodeEnv ?? 'undefined'}: CORS origin resolved to "${resolved}".`,
    );
  }
}
