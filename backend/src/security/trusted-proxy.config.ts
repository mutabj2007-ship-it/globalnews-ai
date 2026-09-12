import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thrown when TRUST_PROXY holds a value this application refuses to act on.
 * Never includes anything beyond the offending token itself, which is a
 * topology description rather than a secret.
 */
export class TrustProxyConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustProxyConfigurationError';
  }
}

/**
 * What Express's `trust proxy` setting is allowed to become here.
 *
 * `false`      — trust nothing. `req.ip` is the socket peer. Today's behaviour.
 * `number`     — trust N hops closest to this server.
 * `string[]`   — trust only these addresses/subnets (the safer form; see below).
 *
 * `true` is deliberately absent from this union. See resolveTrustProxySetting.
 */
export type TrustProxySetting = false | number | readonly string[];

/** Upper bound on the hop form. No real topology puts ten proxies in front of an origin. */
const MAX_TRUSTED_HOPS = 10;

/** Express's own named ranges, accepted verbatim inside an allowlist. */
const ALLOWLIST_PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal']);

const DISABLED_TOKENS = new Set(['', '0', 'false', 'off', 'no', 'none', 'disabled']);

/**
 * Tokens that would mean "trust everything". Enumerated and rejected by name
 * rather than merely failing validation, so the error explains WHY rather than
 * reading as a typo.
 */
const UNRESTRICTED_TOKENS = new Set(['true', 'yes', 'on', '*', 'all', 'any']);

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/;
const IPV6_PATTERN = /^[0-9a-f:]+(?:\/(\d{1,3}))?$/i;

function isValidIpv4Entry(token: string): boolean {
  const match = IPV4_PATTERN.exec(token);
  if (!match) return false;

  const octets = [match[1], match[2], match[3], match[4]].map(Number);
  if (octets.some((octet) => octet > 255)) return false;

  if (match[5] === undefined) return true;

  const prefix = Number(match[5]);
  return prefix >= 0 && prefix <= 32;
}

function isValidIpv6Entry(token: string): boolean {
  if (!token.includes(':')) return false;

  const match = IPV6_PATTERN.exec(token);
  if (!match) return false;

  if (match[1] === undefined) return true;

  const prefix = Number(match[1]);
  return prefix >= 0 && prefix <= 128;
}

/**
 * Structural validation only, deliberately: this confirms a token is
 * SHAPED like an address or subnet, never that the address exists or that
 * it is the proxy you meant. Express itself performs the real parsing and
 * will reject anything malformed that slips past this — the point here is
 * to fail at boot with a clear message rather than deep inside proxy-addr.
 */
function isValidAllowlistEntry(token: string): boolean {
  return ALLOWLIST_PRESETS.has(token) || isValidIpv4Entry(token) || isValidIpv6Entry(token);
}

/**
 * B-1 — the single shared definition of what Express's `trust proxy` should
 * be set to, so backend/src/main.ts's `app.set('trust proxy', ...)` call and
 * TrustedProxyStartupValidator can never disagree.
 *
 * This mirrors resolveFrontendOrigin (security/cors-startup-validator.ts)
 * deliberately and completely: same file layout (pure resolver plus the
 * OnApplicationBootstrap validator that consumes it), same reason (main.ts
 * runs before DI and must call the function directly), same fail-closed
 * discipline.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AT ALL
 *
 * Without it, `req.ip` is the socket peer. Behind any reverse proxy, CDN or
 * load balancer that is the PROXY's address for every visitor, so
 * @nestjs/throttler — whose default tracker is `req.ip` — gives the entire
 * public a single shared rate-limit bucket per handler. The deliberately
 * strict 5-per-minute limit on POST /analysis/news becomes five per minute
 * for the whole site rather than five per person. The limit is not wrong;
 * the key is.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHY `true` IS REJECTED RATHER THAN SUPPORTED
 *
 * `app.set('trust proxy', true)` believes the ENTIRE X-Forwarded-For chain.
 * Any client could then send `X-Forwarded-For: <anything>` and receive a
 * fresh bucket on every single request — bypassing rate limiting completely,
 * including the OpenAI cost control. That is strictly worse than the defect
 * this setting exists to fix, so it is not merely discouraged: the string
 * "true" throws here and can never reach Express.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHY THE ALLOWLIST FORM IS SAFER THAN THE HOP COUNT
 *
 * A hop count trusts whichever peer happens to connect. It is therefore safe
 * ONLY while the backend origin cannot be reached except through the proxy:
 * if the origin is directly reachable, an attacker connects to it with a
 * forged X-Forwarded-For, their own address is the single trusted hop, and
 * the forged value becomes `req.ip`.
 *
 * An allowlist carries no such precondition — an untrusted peer is not
 * trusted at all, so the same forged header is ignored. Prefer the allowlist
 * in production; use the hop count only where ingress topology guarantees the
 * origin is unreachable except through the proxy.
 *
 * ────────────────────────────────────────────────────────────────────────
 * E1-R1 — WHAT THE ALLOWLIST STILL DOES NOT BUY YOU
 *
 * The paragraph above is correct about WHICH PEER may speak. It is silent
 * about whether what that peer says is worth believing, and convergence
 * commit 396d4a7 made that distinction load-bearing.
 *
 * Six route families (/api/auth, /api/users, /api/history, /api/follows,
 * /api/support, /api/admin) are now proxied through the public Next.js
 * frontend by `rewrites` in frontend/next.config.mjs. Measured against Next
 * 14.2.35 with a real production build (E1-R2 canonical experiment), that hop
 * CONTRIBUTES NOTHING to the chain: it forwards a client-supplied
 * X-Forwarded-For verbatim and never appends its own observation. With no
 * middleware present — which is the state at 396d4a7 — a request that arrives
 * carrying no X-Forwarded-For reaches the backend with none either.
 *
 * WHAT FOLLOWS, AND WHAT DOES NOT.
 *
 * What follows: the frontend hop adds no measurement. Where the client's own
 * string is the ONLY entry in the chain, every trusting form of this setting
 * believes it. security/proxied-family-rate-limit.spec.ts shows forged
 * identities being minted freely, and a chosen address being pushed into a 429
 * by someone else's traffic.
 *
 * What does NOT follow: that the chain is empty of trustworthy entries.
 * Express resolves from the RIGHT, so an entry appended by an edge in front of
 * the frontend shadows anything the client prepended, and a public HTTPS
 * deployment has such an edge by definition — something terminates TLS. The
 * same spec asserts that case too, and the forgery loses.
 *
 * So the honest statement is conditional rather than absolute. A trusting form
 * of this setting yields a correct per-visitor identity for the proxied
 * families IF AND ONLY IF: an edge in front of the frontend sets
 * X-Forwarded-For; that edge cannot be bypassed to reach either service
 * directly; the frontend's own hop to the backend does not re-traverse that
 * edge (SERVER_INTERNAL_API_URL must point at an internal address, or the
 * client entry is overwritten with the frontend's); the hop count is not set
 * higher than the shortest chain that can actually arrive; and no frontend
 * middleware is later added, since middleware changes what is forwarded.
 *
 * Five platform properties, none checkable from inside this process, none
 * failing loudly, and each one turning rate limiting off rather than on. That
 * is the argument for keying those routes on something other than an address —
 * not that this setting cannot work, but that nothing here can tell you
 * whether it did.
 *
 * Accepted values:
 *   unset | '' | '0' | 'false' | 'off' | 'no' | 'none' | 'disabled'
 *        -> false  (unchanged behaviour)
 *   '1'..'10'
 *        -> number (hop count)
 *   'loopback' | 'linklocal' | 'uniquelocal' | IPv4 | IPv4/CIDR | IPv6 | IPv6/CIDR,
 *   comma-separated
 *        -> string[] (allowlist)
 *   anything else, including 'true'
 *        -> throws
 *
 * An unparseable value throws rather than degrading to `false`. A silently
 * ignored trust setting looks configured and is not — precisely the failure
 * class the mandatory NODE_ENV form was introduced to eliminate.
 */
export function resolveTrustProxySetting(
  nodeEnv: string | undefined,
  trustProxy: string | undefined,
): TrustProxySetting {
  void nodeEnv; // Deliberately unused: unlike CORS, this has a safe default in every environment.

  if (trustProxy === undefined) {
    return false;
  }

  const normalized = trustProxy.trim().toLowerCase();

  if (DISABLED_TOKENS.has(normalized)) {
    return false;
  }

  if (UNRESTRICTED_TOKENS.has(normalized)) {
    throw new TrustProxyConfigurationError(
      `TRUST_PROXY="${trustProxy.trim()}" would trust every X-Forwarded-For header, letting any ` +
        'client forge a fresh rate-limit identity on every request. Use a proxy count (e.g. "1") ' +
        'or an IP/CIDR allowlist (e.g. "10.0.0.0/8") instead.',
    );
  }

  if (/^\d+$/.test(normalized)) {
    const hops = Number(normalized);

    if (hops < 1 || hops > MAX_TRUSTED_HOPS) {
      throw new TrustProxyConfigurationError(
        `TRUST_PROXY="${trustProxy.trim()}" is not a usable proxy count. Expected 1-${MAX_TRUSTED_HOPS}, ` +
          'matching the number of proxies actually in front of this backend.',
      );
    }

    return hops;
  }

  const entries = normalized
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    return false;
  }

  const invalid = entries.filter((entry) => !isValidAllowlistEntry(entry));

  if (invalid.length > 0) {
    throw new TrustProxyConfigurationError(
      `TRUST_PROXY contains ${invalid.length === 1 ? 'an entry' : 'entries'} that ${
        invalid.length === 1 ? 'is' : 'are'
      } neither an IP address, a CIDR range, nor one of loopback/linklocal/uniquelocal: ` +
        `${invalid.map((entry) => `"${entry}"`).join(', ')}.`,
    );
  }

  return entries;
}

/** Human-readable description of a resolved setting, for the boot log. */
export function describeTrustProxySetting(setting: TrustProxySetting): string {
  if (setting === false) {
    return 'disabled - req.ip is the direct socket peer and no X-Forwarded-For header is believed';
  }

  if (typeof setting === 'number') {
    return `${setting} proxy hop(s) trusted - safe only while this backend is unreachable except through those proxies`;
  }

  return `allowlist [${setting.join(', ')}] - only these peers may supply a client address`;
}

/**
 * B-1 — fail-closed startup guard, mirroring CorsStartupValidator (M34) and
 * NewsStartupValidator (M33) exactly: registered as a plain provider so Nest's
 * OnApplicationBootstrap lifecycle invokes it automatically.
 *
 * Note on timing, exactly as recorded for CorsStartupValidator: main.ts calls
 * resolveTrustProxySetting() directly, before app.listen(), so it is main.ts
 * that produces the fail-closed effect at real boot time. This validator exists
 * as the DI-testable, defence-in-depth guard, calling the identical function so
 * the two can never disagree — and it logs the resolved model, so which trust
 * model a deployment actually got appears in its boot log rather than living
 * only in someone's memory.
 *
 * Deliberately does NOT fail boot when TRUST_PROXY is unset in production. A
 * single-container deployment behind no proxy at all is legitimate, and its
 * correct setting IS `false`. It logs a warning naming the consequence instead.
 */
@Injectable()
export class TrustedProxyStartupValidator implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrustedProxyStartupValidator.name);

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const trustProxy = this.config.get<string>('TRUST_PROXY');

    // Throws on an unusable value — the same function main.ts calls, so
    // behaviour cannot diverge between the two call sites.
    const resolved = resolveTrustProxySetting(nodeEnv, trustProxy);

    const isProduction = nodeEnv?.trim().toLowerCase() === 'production';

    if (resolved === false && isProduction) {
      this.logger.warn(
        'NODE_ENV=production with TRUST_PROXY unset: every client behind a reverse proxy, CDN or ' +
          'load balancer will share ONE rate-limit identity, because req.ip will be the proxy ' +
          "address rather than the visitor's. Correct if this backend is genuinely reached " +
          'directly; otherwise set TRUST_PROXY to an IP/CIDR allowlist.',
      );
      return;
    }

    /*
     * E1-R1 RAISED THIS AS A WARNING. E1-C2-R2 DOWNGRADED IT, ON PURPOSE, AND
     * THE REASONING IS WORTH KEEPING BECAUSE THE DIRECTION LOOKS WRONG.
     *
     * The hop-count form CAN be strictly worse than leaving this setting off:
     * `trust proxy: N` believes the Nth-from-last forwarded entry offered by
     * WHICHEVER peer connects, so where the origin can be reached BYPASSING
     * the proxies, an attacker becomes the trusted hop and their forged header
     * becomes `req.ip`. R1 warned on every production boot for that reason.
     *
     * Two things then changed, both established rather than assumed.
     *
     * FIRST, the precondition is met in this deployment. R1 argued it could
     * not be, on the grounds that the backend answers on a public origin. That
     * conflated "publicly reachable" with "reachable without traversing the
     * edge", which are different: the public hostname resolves to the platform
     * edge, so an internet caller arrives WITH an edge-set chain and is never
     * the socket peer. The operator has reviewed and accepted this.
     *
     * SECOND, and this is why a warning is now the wrong instrument: a warning
     * that fires on every boot for a condition somebody has already reviewed
     * is not a warning, it is furniture. People learn to scroll past the
     * channel, and the next line to appear in it — one that does mean
     * something — goes past with it. This file already makes that argument in
     * the other direction, declining to warn on the allowlist form for exactly
     * the same reason, and it would be inconsistent to keep this one.
     *
     * SO IT STATES THE PRECONDITION AT LOG LEVEL AND STAYS THERE. The
     * deployment still says out loud which model it got and what that model
     * depends on; it just stops implying something is wrong. NOTHING ELSE
     * SOFTENS: an unusable value still THROWS from resolveTrustProxySetting
     * before this point, and the unset-in-production case above still WARNS,
     * because both of those are genuinely unreviewed conditions.
     */
    if (typeof resolved === 'number' && isProduction) {
      this.logger.log(
        `Trust proxy: ${resolved} hop(s) trusted. This believes the forwarded address sent by ` +
          'whatever peer connects, which is sound only while this backend cannot be reached ' +
          'except through those proxies — a topology property this process cannot verify and ' +
          'which should be re-confirmed whenever ingress changes.',
      );
      return;
    }

    this.logger.log(`Trust proxy: ${describeTrustProxySetting(resolved)}.`);
  }
}
