import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thrown when PUBLIC_BACKEND_ORIGIN holds a value this application refuses to
 * build a public OAuth callback URL from. The offending value is echoed
 * because a public origin is a topology description, never a secret — the
 * same judgement trusted-proxy.config.ts already documents for TRUST_PROXY.
 */
export class PublicBackendOriginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicBackendOriginConfigurationError';
  }
}

export const PUBLIC_BACKEND_ORIGIN_ENV = 'PUBLIC_BACKEND_ORIGIN';

/**
 * The development-only fallback, and it is a FIXED STRING ON PURPOSE.
 *
 * The obvious alternative — deriving it from PORT — is wrong here.
 * docker-compose.yml maps '${BACKEND_PORT:-4000}:4000' while setting PORT=4000
 * INSIDE the container, so PORT is the port this process listens on and can
 * differ from the port a browser actually reaches. A derived value would be
 * silently wrong the moment BACKEND_PORT changes, and "silently wrong" is the
 * precise failure class this whole file exists to remove.
 *
 * This string matches the development redirect URI documented in .env.example
 * and registered in Google Cloud Console. Anyone who moves the port sets
 * PUBLIC_BACKEND_ORIGIN explicitly.
 */
const DEVELOPMENT_FALLBACK_ORIGIN = 'http://localhost:4000';

function isUsable(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Structural validation, then normalisation through the URL parser itself.
 *
 * `URL.origin` is what does the normalising: it drops a trailing slash,
 * lower-cases the host and removes a default port, so 'https://API.Example.com/'
 * and 'https://api.example.com:443' both resolve to 'https://api.example.com'.
 * Google compares redirect_uri BYTE FOR BYTE against the registered value, so
 * normalising here rather than hoping every deployment types it identically is
 * the difference between a working sign-in and redirect_uri_mismatch.
 *
 * WHAT IS REFUSED, AND WHY EACH ONE IS REFUSED RATHER THAN REPAIRED:
 *
 *   not a parseable absolute URL  A bare host has no scheme, and guessing one
 *                                 is how http:// gets chosen for a production
 *                                 deployment by accident.
 *   a scheme other than http/https  A callback URL is fetched by a browser.
 *   http:// in production         THIS IS THE DEFECT THIS FILE EXISTS TO CLOSE.
 *                                 Deriving the origin from the request produced
 *                                 http:// behind a TLS terminator and Google
 *                                 refused. Accepting a configured http:// origin
 *                                 in production would let the same failure
 *                                 return through configuration instead of
 *                                 through code.
 *   a path, query or fragment     This is an ORIGIN. '/auth/google/callback' is
 *                                 appended by the caller; a value already
 *                                 carrying a path would produce a doubled one.
 *                                 A BARE TRAILING SLASH IS NOT A PATH — it is a
 *                                 typo, and URL.origin removes it.
 *   embedded credentials          Nothing legitimate puts a userinfo component
 *                                 in a public origin, and it would end up in a
 *                                 URL handed to a third party.
 *
 * An unparseable or unusable value THROWS rather than degrading to the
 * development fallback, in development as well as in production. A silently
 * ignored setting looks configured and is not — the same reasoning
 * resolveTrustProxySetting states for its own refusal to guess.
 */
function normalizeOrigin(rawValue: string, isProduction: boolean): string {
  const trimmed = rawValue.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new PublicBackendOriginConfigurationError(
      `${PUBLIC_BACKEND_ORIGIN_ENV}="${trimmed}" is not an absolute URL. Expected a scheme and a host, ` +
        'for example "https://api.example.com".',
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new PublicBackendOriginConfigurationError(
      `${PUBLIC_BACKEND_ORIGIN_ENV}="${trimmed}" uses the "${url.protocol.replace(':', '')}" scheme. ` +
        'Only http and https are usable as a public backend origin.',
    );
  }

  if (isProduction && url.protocol !== 'https:') {
    throw new PublicBackendOriginConfigurationError(
      `${PUBLIC_BACKEND_ORIGIN_ENV}="${trimmed}" is not https. A production OAuth callback origin must be ` +
        'https, because Google compares the redirect_uri against the registered value and an http origin ' +
        'is exactly the mismatch this setting exists to prevent.',
    );
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new PublicBackendOriginConfigurationError(
      `${PUBLIC_BACKEND_ORIGIN_ENV} must not contain embedded credentials. It is a public address.`,
    );
  }

  // A single '/' is what the parser produces for an origin with no path, and a
  // trailing slash normalises to the same thing. Anything longer is a real path.
  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new PublicBackendOriginConfigurationError(
      `${PUBLIC_BACKEND_ORIGIN_ENV}="${trimmed}" carries a path, query or fragment. It must be an origin ` +
        'only — the callback path is appended by the application.',
    );
  }

  return url.origin;
}

/**
 * B-2 repair — the single shared definition of the origin at which a BROWSER
 * reaches this backend, and therefore of the OAuth redirect URI.
 *
 * This is the fourth member of the family E1 established for FRONTEND_ORIGIN,
 * GNEWS_API_KEY, OPENAI_API_KEY and TRUST_PROXY: a pure resolver plus an
 * OnApplicationBootstrap validator that calls the identical function, so two
 * call sites can never disagree about what is usable.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AT ALL
 *
 * The redirect URI used to be built from the request:
 *   `${request.protocol}://${request.get('host')}/auth/google/callback`
 * `req.protocol` reflects X-Forwarded-Proto only when Express's `trust proxy`
 * is truthy, and that setting ships as false. Behind a TLS-terminating proxy —
 * which is every public HTTPS deployment of this application — the derived
 * value was therefore `http://...`, while the URI registered with Google is
 * `https://...`. Google refused the authorization request, and because accounts
 * gate history, support and the whole admin platform, sign-in took all of them
 * down with it. Nothing detected it at startup.
 *
 * Two independent client-controlled inputs are removed by this change: the
 * protocol, which was wrong by default, and the Host header, which is supplied
 * by the caller and had no business deciding where Google sends a user.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS NOT
 *
 * It is NOT a replacement for TRUST_PROXY and it does not weaken it. TRUST_PROXY
 * remains necessary and remains exactly as it was: it decides `req.ip`, and
 * therefore rate-limit identity. This change makes OAUTH INDEPENDENT of proxy
 * trust rather than relaxing proxy trust — one fewer thing riding on a setting
 * whose stated purpose is something else entirely.
 *
 * Accepted values:
 *   production   an https origin, no path/query/fragment. MANDATORY.
 *   development  the same, http permitted; unset falls back to
 *                DEVELOPMENT_FALLBACK_ORIGIN above.
 *   anything malformed, in EITHER environment -> throws.
 */
export function resolvePublicBackendOrigin(
  nodeEnv: string | undefined,
  publicBackendOrigin: string | undefined,
): string {
  const isProduction = nodeEnv?.trim().toLowerCase() === 'production';

  if (!isUsable(publicBackendOrigin)) {
    if (!isProduction) {
      return DEVELOPMENT_FALLBACK_ORIGIN;
    }

    const reason =
      publicBackendOrigin === undefined || publicBackendOrigin === ''
        ? `${PUBLIC_BACKEND_ORIGIN_ENV} is missing or empty.`
        : `${PUBLIC_BACKEND_ORIGIN_ENV} is whitespace-only.`;

    throw new PublicBackendOriginConfigurationError(
      `Production OAuth configuration requires ${PUBLIC_BACKEND_ORIGIN_ENV} — the origin at which a browser ` +
        `reaches this backend, matching the redirect URI registered with Google. ${reason}`,
    );
  }

  return normalizeOrigin(publicBackendOrigin as string, isProduction);
}

/**
 * B-2 repair — the fail-closed startup guard.
 *
 * THIS VALIDATOR DIFFERS FROM ITS TWO NEIGHBOURS IN ONE WAY THAT MATTERS, AND
 * REMOVING IT WOULD REINSTATE HALF THE DEFECT.
 *
 * For CORS and trust-proxy, main.ts calls the resolver directly before
 * app.listen(), so main.ts is what produces the fail-closed effect at boot and
 * the validator is defence in depth. Here the origin is consumed PER REQUEST,
 * inside AuthService, so without this provider nothing would evaluate the
 * configuration at boot at all: a production deployment with
 * PUBLIC_BACKEND_ORIGIN unset would start healthy, pass its healthcheck, serve
 * traffic, and fail only when the first person pressed Sign In.
 *
 * That is the original defect wearing a different hat. This validator is the
 * fail-closed mechanism, not a second opinion about one.
 */
@Injectable()
export class PublicBackendOriginStartupValidator implements OnApplicationBootstrap {
  private readonly logger = new Logger(PublicBackendOriginStartupValidator.name);

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const publicBackendOrigin = this.config.get<string>(PUBLIC_BACKEND_ORIGIN_ENV);

    // The same function AuthService calls, so the two cannot diverge.
    const resolved = resolvePublicBackendOrigin(nodeEnv, publicBackendOrigin);

    this.logger.log(
      `Public backend origin: ${resolved} (OAuth callback ${resolved}/auth/google/callback). ` +
        'This exact URI must be registered in Google Cloud Console.',
    );
  }
}
