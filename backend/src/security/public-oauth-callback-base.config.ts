import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PUBLIC_BACKEND_ORIGIN_ENV,
  resolvePublicBackendOrigin,
} from './public-backend-origin.config';

/**
 * Thrown when PUBLIC_OAUTH_CALLBACK_BASE holds a value this application refuses
 * to build an OAuth redirect URI from.
 */
export class PublicOAuthCallbackBaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicOAuthCallbackBaseConfigurationError';
  }
}

export const PUBLIC_OAUTH_CALLBACK_BASE_ENV = 'PUBLIC_OAUTH_CALLBACK_BASE';

/**
 * M-ALPHA-AUTH OPTION A — the browser-visible base of this application's OAuth
 * callback.
 *
 * ─── WHY THIS EXISTS SEPARATELY FROM PUBLIC_BACKEND_ORIGIN ───────────────────
 *
 * Under Option A the account surfaces are reached through the FRONTEND origin's
 * own /api path, so that the session cookie is first-party. The OAuth callback is
 * one of those surfaces. Its browser-visible base is therefore
 *
 *     <FRONTEND>/api
 *
 * which PUBLIC_BACKEND_ORIGIN cannot express and must not be made to. That
 * variable is validated origin-only by the B-2 repair — deliberately, after a
 * real redirect_uri_mismatch incident — and .env.example documents it as "NOT
 * the frontend origin". Both of those statements are correct and neither is
 * changed here. public-backend-origin.config.ts is not touched by one line.
 *
 * MY EARLIER DEPLOYMENT INSTRUCTION WAS THE THING THAT WAS WRONG. It said to set
 * PUBLIC_BACKEND_ORIGIN to <FRONTEND>/api, which violates that contract twice —
 * a path where none is allowed, and the frontend origin in a variable documented
 * as not being it. The validator refusing to boot was the system working.
 *
 * ─── WHY NOT JUST DROP THE /api ──────────────────────────────────────────────
 *
 * Because the callback would then never arrive. With the base at <FRONTEND> the
 * redirect URI is <FRONTEND>/auth/google/callback, and frontend/next.config.mjs
 * proxies exactly six families, ALL of them under /api — there is no rewrite
 * rooted at a bare /auth, and frontend/src/app has no `auth` segment. The
 * callback would 404 against the Next router, the token exchange would never
 * happen, and no session would ever be created.
 *
 * ─── THE CONTRACT ────────────────────────────────────────────────────────────
 *
 * OPTIONAL, and its absence means "behave exactly as before". Unset, this module
 * defers to resolvePublicBackendOrigin() — the same call AuthService made
 * before this milestone, including its http://localhost:4000 development
 * fallback. A deployment that sets nothing is bit-for-bit unchanged.
 *
 * ROLLBACK IS THEREFORE ONE VARIABLE. Option A is "set it"; rollback is "unset
 * it". No second variable to keep in agreement, no value to edit in two
 * directions, and no Google Console change either way provided both redirect
 * URIs stay registered.
 *
 * PRESENT BUT MALFORMED IS ALWAYS FATAL, IN EVERY ENVIRONMENT — including
 * development. A silently ignored setting looks configured and is not, which is
 * the failure mode the B-2 repair was written to end; this module does not
 * reintroduce it one variable over.
 */

/**
 * A path is permitted here — that is the entire difference from
 * PUBLIC_BACKEND_ORIGIN — but only a deliberately narrow one.
 *
 * Lowercase alphanumerics, hyphens and separators, one or more segments, no
 * trailing slash. It cannot express a dot segment, a doubled slash, an encoded
 * character, a query, a fragment or an authority, so a second host is not
 * merely rejected downstream: it is unrepresentable. `/api` matches; so would
 * `/api/v2`. Nothing that could redirect a browser elsewhere does.
 */
const ALLOWED_CALLBACK_PATH = /^(\/[a-z0-9-]+)+$/;

/** Bound on the whole value. Every legitimate base is far shorter. */
const MAX_CALLBACK_BASE_LENGTH = 200;

function isUsable(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeCallbackBase(rawValue: string, isProduction: boolean): string {
  const trimmed = rawValue.trim();

  if (trimmed.length > MAX_CALLBACK_BASE_LENGTH) {
    throw new PublicOAuthCallbackBaseConfigurationError(
      `${PUBLIC_OAUTH_CALLBACK_BASE_ENV} is longer than ${MAX_CALLBACK_BASE_LENGTH} characters. ` +
        'A public callback base is an origin plus at most a short path prefix.',
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new PublicOAuthCallbackBaseConfigurationError(
      `${PUBLIC_OAUTH_CALLBACK_BASE_ENV}="${trimmed}" is not an absolute URL. Expected a scheme and a ` +
        'host, for example "https://app.example.com/api".',
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new PublicOAuthCallbackBaseConfigurationError(
      `${PUBLIC_OAUTH_CALLBACK_BASE_ENV}="${trimmed}" uses the "${url.protocol.replace(':', '')}" ` +
        'scheme. Only http and https are usable as a public callback base.',
    );
  }

  /*
    Same rule and same reason as the B-2 repair: Google compares redirect_uri
    byte for byte against the registered value, and an http URI in production is
    exactly the mismatch these guards exist to prevent.
  */
  if (isProduction && url.protocol !== 'https:') {
    throw new PublicOAuthCallbackBaseConfigurationError(
      `${PUBLIC_OAUTH_CALLBACK_BASE_ENV}="${trimmed}" is not https. A production OAuth callback base ` +
        'must be https.',
    );
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new PublicOAuthCallbackBaseConfigurationError(
      `${PUBLIC_OAUTH_CALLBACK_BASE_ENV} must not contain embedded credentials. It is a public address.`,
    );
  }

  if (url.search.length > 0 || url.hash.length > 0) {
    throw new PublicOAuthCallbackBaseConfigurationError(
      `${PUBLIC_OAUTH_CALLBACK_BASE_ENV}="${trimmed}" carries a query or fragment. A callback base is ` +
        'an origin plus an optional path prefix only — the callback path is appended by the application.',
    );
  }

  /*
    `new URL()` normalises some hostile shapes away before we see them - it
    collapses `/a/../b` and resolves `//` in places - so the RAW value is checked
    for them too. Validating only the normalised form would accept an input that
    reads as one thing in the Railway UI and another to this process.
  */
  if (trimmed.includes('..')) {
    throw new PublicOAuthCallbackBaseConfigurationError(
      `${PUBLIC_OAUTH_CALLBACK_BASE_ENV}="${trimmed}" contains a dot segment.`,
    );
  }

  const path = url.pathname;

  if (path === '/') {
    // No path prefix at all is legitimate: it is the rollback shape, and it is
    // what an ordinary backend-hosted callback looks like.
    return url.origin;
  }

  if (path.endsWith('/')) {
    throw new PublicOAuthCallbackBaseConfigurationError(
      `${PUBLIC_OAUTH_CALLBACK_BASE_ENV}="${trimmed}" ends with a slash. Write the base without a ` +
        'trailing slash — the callback path is appended by the application.',
    );
  }

  if (!ALLOWED_CALLBACK_PATH.test(path)) {
    throw new PublicOAuthCallbackBaseConfigurationError(
      `${PUBLIC_OAUTH_CALLBACK_BASE_ENV}="${trimmed}" has a path this application will not build a ` +
        'redirect URI from. Allowed: one or more segments of lowercase letters, digits and hyphens, ' +
        'for example "/api".',
    );
  }

  return `${url.origin}${path}`;
}

/**
 * Resolves the base the OAuth callback URI is built on.
 *
 * Unset or blank -> defers to resolvePublicBackendOrigin(), i.e. exactly the
 * behaviour that shipped before this milestone. Present -> validated strictly,
 * and a malformed value throws in every environment.
 *
 * Both callers of the redirect URI go through ONE call to this function, so the
 * authorization request and the token exchange cannot disagree.
 */
export function resolvePublicOAuthCallbackBase(
  nodeEnv: string | undefined,
  publicOAuthCallbackBase: string | undefined,
  publicBackendOrigin: string | undefined,
): string {
  const isProduction = nodeEnv?.trim().toLowerCase() === 'production';

  if (!isUsable(publicOAuthCallbackBase)) {
    return resolvePublicBackendOrigin(nodeEnv, publicBackendOrigin);
  }

  return normalizeCallbackBase(publicOAuthCallbackBase as string, isProduction);
}

/**
 * Boot-time guard, registered in app.module.ts beside
 * PublicBackendOriginStartupValidator and for the same reason: this value is
 * consumed PER REQUEST inside AuthService, so without a validator a deployment
 * with a malformed base would start healthy, pass its healthcheck, serve traffic
 * and fail only when the first person pressed Sign In.
 *
 * It logs the effective callback URI, which is the single most useful line in
 * the boot log for this milestone: it is the exact string that must be
 * registered in Google Cloud Console.
 */
@Injectable()
export class PublicOAuthCallbackBaseStartupValidator implements OnApplicationBootstrap {
  private readonly logger = new Logger(PublicOAuthCallbackBaseStartupValidator.name);

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const callbackBase = this.config.get<string>(PUBLIC_OAUTH_CALLBACK_BASE_ENV);
    const backendOrigin = this.config.get<string>(PUBLIC_BACKEND_ORIGIN_ENV);

    // The same function AuthService calls, so the two cannot diverge.
    const resolved = resolvePublicOAuthCallbackBase(nodeEnv, callbackBase, backendOrigin);
    const source = isUsable(callbackBase)
      ? PUBLIC_OAUTH_CALLBACK_BASE_ENV
      : `${PUBLIC_BACKEND_ORIGIN_ENV} (${PUBLIC_OAUTH_CALLBACK_BASE_ENV} unset)`;

    this.logger.log(
      `OAuth callback base: ${resolved} from ${source}. ` +
        `Effective callback URI: ${resolved}/auth/google/callback. ` +
        'This exact URI must be registered in Google Cloud Console.',
    );
  }
}
