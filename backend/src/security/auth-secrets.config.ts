import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * S1 — production validation for the three OAuth/OIDC secrets.
 *
 * WHY THIS FILE EXISTS. Every other security-critical value in this codebase
 * already fails closed at boot in production: FRONTEND_ORIGIN
 * (CorsStartupValidator), GNEWS_API_KEY (NewsStartupValidator), OPENAI_API_KEY
 * (AnalysisStartupValidator), NODE_ENV and POSTGRES_PASSWORD (docker-compose,
 * mandatory with no default). Auth was the single exception, and it is the
 * most security-sensitive category of the set.
 *
 * Before S1 the only check anywhere was a PRESENCE test at request time
 * (auth.service.ts, startGoogleAuth), which throws a 503 when a value is
 * missing. That is late, quiet, and — critically — a shipped placeholder
 * passes it perfectly. A deployment that copied .env.example verbatim would
 * boot green, pass /health/ready, serve news normally, and sign users in with
 * an OAUTH_FLOW_SECRET printed in the repository.
 *
 * WHAT OAUTH_FLOW_SECRET ACTUALLY PROTECTS. It is the HMAC-SHA256 key that
 * authenticates the ephemeral OAuth flow-state cookie carrying the `state`,
 * the PKCE `code_verifier` and the OIDC `nonce` — see oauth-flow-state.ts,
 * which explains at length that HttpOnly provides confidentiality but NOT
 * integrity, and that this HMAC is the integrity control. A key an attacker
 * can read from a public repository is not a key.
 *
 * Placed in security/ alongside cors-startup-validator.ts and
 * trusted-proxy.config.ts, and — like both of those — this file holds BOTH the
 * pure resolver and the DI validator, so the two can never disagree about what
 * a given environment means.
 */

export const AUTH_SECRET_ENV_VARS = [
  'OAUTH_CLIENT_ID',
  'OAUTH_CLIENT_SECRET',
  'OAUTH_FLOW_SECRET',
] as const;

export type AuthSecretEnvVar = (typeof AUTH_SECRET_ENV_VARS)[number];

export type AuthSecretValues = Partial<Record<AuthSecretEnvVar, string | undefined>>;

/**
 * The exact values this repository ships in `.env.example`, plus the small set
 * of obvious neighbours somebody types when they mean "I have not set this
 * yet".
 *
 * MATCHING IS EXACT (after trim + lowercase), never substring. A substring
 * rule would eventually reject a legitimate random secret that happened to
 * contain one of these words, and a fail-closed guard that fires on a correct
 * configuration is worse than no guard: the next person disables it.
 *
 * `auth-secrets.config.spec.ts` READS `.env.example` from disk and asserts
 * that every value it ships for these three variables appears here. That is
 * the anti-drift control: changing the placeholder in `.env.example` without
 * updating this list fails the suite rather than silently reopening the hole.
 */
export const SHIPPED_PLACEHOLDER_VALUES: ReadonlySet<string> = new Set([
  'change_me',
  'changeme',
  'change-me',
  'replace_me',
  'replaceme',
  'placeholder',
  'your-google-oauth-client-id.apps.googleusercontent.com',
  'your-google-oauth-client-secret',
  'your_oauth_client_id',
  'your_oauth_client_secret',
  'your_oauth_flow_secret',
  'todo',
  'secret',
]);

/**
 * Advisory only. OAUTH_FLOW_SECRET is a symmetric key this system generates
 * for itself, so its strength is entirely our own choice — unlike
 * OAUTH_CLIENT_ID/OAUTH_CLIENT_SECRET, whose format Google dictates and which
 * this validator must therefore never constrain by length.
 *
 * Deliberately a WARNING and not a boot failure. The authorized scope for S1
 * is missing / blank / shipped-placeholder; a length rule is a different
 * policy, and imposing one here would break an existing deployment holding a
 * short-but-genuinely-random secret. `openssl rand -base64 32` produces 44
 * characters, which is what .env.example recommends.
 */
export const RECOMMENDED_FLOW_SECRET_MIN_LENGTH = 32;

export class AuthSecretsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthSecretsConfigurationError';
  }
}

/**
 * What a given environment means for the sign-in flow.
 *
 * - `not-production`  — no checking at all. Local guest development, and local
 *                       development WITH placeholder OAuth values, both keep
 *                       working exactly as they did before S1.
 * - `guest-only`      — production with NONE of the three set. This is a
 *                       legitimate deployment: accounts are optional and every
 *                       browse/search/map/analysis capability works without
 *                       them. Allowed, and logged so it is a visible choice
 *                       rather than an accident.
 * - `configured`      — production with all three set to usable values.
 */
export type AuthSecretsMode =
  | { kind: 'not-production' }
  | { kind: 'guest-only' }
  | { kind: 'configured'; weakFlowSecret: boolean };

function isProductionEnvironment(nodeEnv: string | undefined): boolean {
  return nodeEnv?.trim().toLowerCase() === 'production';
}

/** A value that is absent, empty, or whitespace-only carries no configuration. */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}

function isShippedPlaceholder(value: string): boolean {
  return SHIPPED_PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

/**
 * ALL-OR-NOTHING, deliberately.
 *
 * A half-configured production deployment — say OAUTH_CLIENT_ID set but
 * OAUTH_FLOW_SECRET forgotten — is the worst of both worlds: it looks
 * configured, it advertises sign-in, and it fails at the moment a real user
 * presses the button. The three values are one decision, so they are validated
 * as one.
 *
 * Never throws outside production. Never inspects, logs or returns any secret
 * VALUE — only which variables are unusable and why.
 */
export function resolveAuthSecretsMode(
  nodeEnv: string | undefined,
  values: AuthSecretValues,
): AuthSecretsMode {
  if (!isProductionEnvironment(nodeEnv)) {
    return { kind: 'not-production' };
  }

  const present = AUTH_SECRET_ENV_VARS.filter((name) => !isBlank(values[name]));

  if (present.length === 0) {
    return { kind: 'guest-only' };
  }

  const blank = AUTH_SECRET_ENV_VARS.filter((name) => isBlank(values[name]));

  if (blank.length > 0) {
    throw new AuthSecretsConfigurationError(
      `Google sign-in is partially configured in production: ${present.join(', ')} ` +
        `${present.length === 1 ? 'is' : 'are'} set but ${blank.join(', ')} ` +
        `${blank.length === 1 ? 'is' : 'are'} missing or blank. Set all three, or ` +
        'unset all three to run a guest-only deployment. A half-configured flow ' +
        'advertises sign-in and then fails at the moment a real user presses the button.',
    );
  }

  const placeholders = AUTH_SECRET_ENV_VARS.filter((name) =>
    isShippedPlaceholder(values[name] as string),
  );

  if (placeholders.length > 0) {
    throw new AuthSecretsConfigurationError(
      `${placeholders.join(', ')} ${placeholders.length === 1 ? 'is' : 'are'} still set to a ` +
        'placeholder value shipped in .env.example. OAUTH_FLOW_SECRET in particular is the ' +
        'HMAC key that authenticates the OAuth flow-state cookie (state, PKCE verifier, ' +
        'nonce), so a value published in this repository means anyone can forge one. ' +
        'Generate a real secret per environment, e.g. `openssl rand -base64 32`.',
    );
  }

  const flowSecret = (values.OAUTH_FLOW_SECRET as string).trim();

  return {
    kind: 'configured',
    weakFlowSecret: flowSecret.length < RECOMMENDED_FLOW_SECRET_MIN_LENGTH,
  };
}

/** Human-readable description of a resolved mode, for the boot log. Never includes a value. */
export function describeAuthSecretsMode(mode: AuthSecretsMode): string {
  switch (mode.kind) {
    case 'not-production':
      return 'not validated (NODE_ENV is not production)';
    case 'guest-only':
      return 'guest-only — no OAuth credentials configured, so sign-in is deliberately unavailable';
    case 'configured':
      return 'configured — all three OAuth values present and none is a shipped placeholder';
  }
}

/**
 * S1 — fail-closed startup guard, mirroring CorsStartupValidator (M34) and
 * TrustedProxyStartupValidator (B-1) exactly: registered as a plain provider
 * so Nest's OnApplicationBootstrap lifecycle invokes it automatically.
 *
 * Note on timing, exactly as recorded for both of those: main.ts calls
 * resolveAuthSecretsMode() directly, BEFORE app.listen(), so it is main.ts that
 * produces the fail-closed effect at real boot time — the port never opens on
 * a bad configuration. This validator exists as the DI-testable,
 * defence-in-depth guard calling the identical function, and it logs the
 * resolved mode so which sign-in posture a deployment actually got appears in
 * its boot log rather than living only in someone's memory.
 */
@Injectable()
export class AuthSecretsStartupValidator implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthSecretsStartupValidator.name);

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const mode = resolveAuthSecretsMode(this.config.get<string>('NODE_ENV'), {
      OAUTH_CLIENT_ID: this.config.get<string>('OAUTH_CLIENT_ID'),
      OAUTH_CLIENT_SECRET: this.config.get<string>('OAUTH_CLIENT_SECRET'),
      OAUTH_FLOW_SECRET: this.config.get<string>('OAUTH_FLOW_SECRET'),
    });

    if (mode.kind === 'configured' && mode.weakFlowSecret) {
      this.logger.warn(
        `OAUTH_FLOW_SECRET is shorter than ${RECOMMENDED_FLOW_SECRET_MIN_LENGTH} characters. It is ` +
          'the HMAC key protecting the OAuth flow-state cookie; a short key weakens that ' +
          'protection. Generate one with `openssl rand -base64 32`.',
      );
    }

    this.logger.log(`Auth secrets: ${describeAuthSecretsMode(mode)}.`);
  }
}
