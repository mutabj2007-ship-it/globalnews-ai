import { isBetaCategory, type AskContext, type BetaCategory } from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §4 — NAVIGATION CONTINUITY.
 *
 * The problem §4 states:
 *
 *   Map → Situation → Ask → Analysis → Full Analysis
 *
 * and the user cannot easily get back. The cause is structural, not
 * cosmetic: each of those surfaces knows only its own route, so none
 * of them can render "← Rwanda" because none of them knows Rwanda was
 * ever involved.
 *
 * THIS IS NOT A ROUTER. §4: "Do not create a new global router
 * architecture unless the existing framework genuinely requires it."
 * Next.js App Router does not. This module is pure functions over a
 * small serializable value — no navigation is intercepted, no history
 * is rewritten, and browser Back keeps working exactly as it does
 * today. The contextual controls are an ADDITION alongside Back, which
 * is what §4 asks for ("Browser Back must continue working, but should
 * not be the only navigation mechanism").
 *
 * WHY THE CONTEXT TRAVELS IN THE URL rather than in a React context
 * provider or sessionStorage:
 *
 *   - a React provider is lost on a full page load, so a shared or
 *     refreshed Ask link would lose its "← Rwanda" control — the exact
 *     failure §4 describes;
 *   - sessionStorage is per-tab and invisible to the server, so a
 *     server-rendered page could not render the return control in the
 *     first paint, and opening a link in a new tab would lose it;
 *   - the URL survives reload, sharing, Back/Forward and SSR, and it
 *     is the one place Next.js already gives every surface access to.
 *
 * The cost is that the context is user-visible and user-editable. That
 * is acceptable precisely because this value is NAVIGATIONAL ONLY —
 * see the note on `subjectId` below. Nothing here is trusted for
 * authorization, and the backend re-resolves and re-validates every
 * field it acts on.
 */

/**
 * URL parameter names. Short, because they ride on every link in the
 * chain, and prefixed so they cannot collide with an existing
 * parameter on any surface (the map already uses `country`, search
 * uses `q`).
 */
export const ASK_CONTEXT_PARAMS = {
  originRoute: 'ctxFrom',
  originLabel: 'ctxFromLabel',
  countryCode: 'ctxCountry',
  countryName: 'ctxCountryName',
  subjectId: 'ctxSubject',
  subjectLabel: 'ctxSubjectLabel',
  module: 'ctxModule',
  timeWindow: 'ctxWindow',
} as const;

/**
 * Bounds mirroring the backend DTO (AskContextDto) exactly.
 *
 * Enforced on BOTH sides on purpose. The backend's bounds are the ones
 * that matter for safety; these exist so a malformed URL produces a
 * clean, locally-handled result instead of a 400 the user cannot act
 * on — and so a link with a megabyte of junk in a parameter never gets
 * built in the first place.
 */
const MAX_LENGTHS: Record<keyof typeof ASK_CONTEXT_PARAMS, number> = {
  originRoute: 200,
  originLabel: 120,
  countryCode: 10,
  countryName: 120,
  subjectId: 200,
  subjectLabel: 300,
  module: 40,
  timeWindow: 8,
};

/** The time windows the product offers. Matches AskContextDto's @IsIn. */
const ALLOWED_TIME_WINDOWS = ['24h', '7d', '30d', '90d'] as const;

function bounded(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return undefined;
  return trimmed;
}

/**
 * An origin route must be an in-app path.
 *
 * Rejecting anything that is not a single-slash-prefixed relative path
 * is the whole of this function's job, and it matters: `ctxFrom` is
 * fed to a navigation control, so accepting `https://elsewhere.test`
 * or the protocol-relative `//elsewhere.test` would turn every
 * "← Back" button in the product into an open redirect that an
 * attacker controls by crafting a link.
 */
function safeOriginRoute(value: string | null | undefined): string | undefined {
  const candidate = bounded(value, MAX_LENGTHS.originRoute);
  if (!candidate) return undefined;

  // Must start with exactly one '/', ruling out '//host' (protocol
  // relative) and any absolute URL.
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return undefined;
  // A backslash is treated as a path separator by some browsers, so
  // '/\evil.test' can behave as protocol-relative too.
  if (candidate.includes('\\')) return undefined;

  return candidate;
}

/** Reads an AskContext out of URL search parameters. Never throws. */
export function readAskContext(params: URLSearchParams): AskContext {
  const rawModule = bounded(params.get(ASK_CONTEXT_PARAMS.module), MAX_LENGTHS.module);
  const rawWindow = bounded(params.get(ASK_CONTEXT_PARAMS.timeWindow), MAX_LENGTHS.timeWindow);

  const context: AskContext = {
    originRoute: safeOriginRoute(params.get(ASK_CONTEXT_PARAMS.originRoute)),
    originLabel: bounded(params.get(ASK_CONTEXT_PARAMS.originLabel), MAX_LENGTHS.originLabel),
    // Uppercased so the value is canonical everywhere downstream, the
    // same convention the backend and shared country resolver use.
    countryCode: bounded(
      params.get(ASK_CONTEXT_PARAMS.countryCode),
      MAX_LENGTHS.countryCode,
    )?.toUpperCase(),
    countryName: bounded(params.get(ASK_CONTEXT_PARAMS.countryName), MAX_LENGTHS.countryName),
    subjectId: bounded(params.get(ASK_CONTEXT_PARAMS.subjectId), MAX_LENGTHS.subjectId),
    subjectLabel: bounded(params.get(ASK_CONTEXT_PARAMS.subjectLabel), MAX_LENGTHS.subjectLabel),
    // Validated against the closed set rather than passed through: an
    // arbitrary module string becomes part of the backend's
    // stored-result fingerprint, so accepting anything would let a
    // crafted link mint unlimited cache identities for one question —
    // every one a miss, every miss a fresh AI call.
    module: rawModule && isBetaCategory(rawModule) ? rawModule : undefined,
    timeWindow:
      rawWindow && (ALLOWED_TIME_WINDOWS as readonly string[]).includes(rawWindow)
        ? rawWindow
        : undefined,
  };

  // Strip undefined entries so an empty context serializes as {} and
  // compares cleanly in tests and in React dependency arrays.
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  ) as AskContext;
}

/** Writes an AskContext into URL search parameters, omitting empty fields. */
export function writeAskContext(
  context: AskContext,
  into: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(into);

  const entries: [keyof typeof ASK_CONTEXT_PARAMS, string | undefined][] = [
    ['originRoute', safeOriginRoute(context.originRoute)],
    ['originLabel', bounded(context.originLabel, MAX_LENGTHS.originLabel)],
    ['countryCode', bounded(context.countryCode, MAX_LENGTHS.countryCode)?.toUpperCase()],
    ['countryName', bounded(context.countryName, MAX_LENGTHS.countryName)],
    ['subjectId', bounded(context.subjectId, MAX_LENGTHS.subjectId)],
    ['subjectLabel', bounded(context.subjectLabel, MAX_LENGTHS.subjectLabel)],
    ['module', context.module],
    ['timeWindow', bounded(context.timeWindow, MAX_LENGTHS.timeWindow)],
  ];

  for (const [key, value] of entries) {
    const param = ASK_CONTEXT_PARAMS[key];
    if (value === undefined) {
      params.delete(param);
    } else {
      params.set(param, value);
    }
  }

  return params;
}

/** Builds an in-app href carrying this context forward. */
export function buildContextualHref(pathname: string, context: AskContext): string {
  const params = writeAskContext(context);
  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

/**
 * §4 — one contextual return control.
 *
 * `href` is always an in-app path, because it is built from
 * safeOriginRoute-validated pieces or from a literal route constant.
 */
export interface AskReturnTarget {
  /** e.g. "Rwanda", "Energy", "World Map". Rendered after the arrow. */
  label: string;
  href: string;
  /** What this control returns to. Lets a UI pick an icon per kind. */
  kind: 'origin' | 'country' | 'module' | 'subject';
}

/** Display names for the Beta categories, used when building a "← Energy" control. */
const CATEGORY_LABELS: Record<BetaCategory, string> = {
  world: 'World',
  economy: 'Economy',
  energy: 'Energy',
  security: 'Security',
  humanitarian: 'Humanitarian',
};

/**
 * §4 — the contextual return controls for a context, most specific
 * LAST.
 *
 * "Most specific last" is the breadcrumb reading order a person
 * expects (World Map → Rwanda → Energy), and it is also the order in
 * which dropping trailing entries degrades gracefully when a narrow
 * screen can only show one or two.
 *
 * §4 lists the target patterns literally:
 *   ← Rwanda      (country)
 *   ← Energy      (module)
 *   ← Analysis    (origin, when the user came from an analysis view)
 *   ← World Map   (origin)
 *
 * Each entry appears only when the context genuinely carries it, so a
 * bare Ask with no context produces an empty trail rather than an
 * invented one. A fabricated "← Home" would be worse than nothing:
 * it teaches the user the control is unreliable.
 */
export function buildReturnTrail(context: AskContext): AskReturnTarget[] {
  const trail: AskReturnTarget[] = [];

  if (context.originRoute) {
    const href = safeOriginRoute(context.originRoute);
    if (href) {
      trail.push({
        // Falls back to the route itself rather than inventing a
        // friendly name we cannot know.
        label: context.originLabel ?? href,
        href,
        kind: 'origin',
      });
    }
  }

  if (context.countryCode) {
    trail.push({
      label: context.countryName ?? context.countryCode,
      // The country surface is the map, focused on that country —
      // reusing the existing /map?country= convention rather than
      // inventing a route that does not exist yet.
      href: `/map?country=${encodeURIComponent(context.countryCode)}`,
      kind: 'country',
    });
  }

  if (context.module) {
    trail.push({
      label: CATEGORY_LABELS[context.module],
      href: buildContextualHref(`/${context.module}`, {
        countryCode: context.countryCode,
        countryName: context.countryName,
        timeWindow: context.timeWindow,
      }),
      kind: 'module',
    });
  }

  return trail;
}

/**
 * §4 — the single most relevant "back" target, for a narrow screen
 * that can show only one control.
 *
 * Returns the MOST SPECIFIC entry (the last in the trail), not the
 * first. Going back one meaningful step is what a single back control
 * should do; jumping straight to the origin would skip the
 * intermediate context the user was actually looking at.
 */
export function primaryReturnTarget(context: AskContext): AskReturnTarget | undefined {
  const trail = buildReturnTrail(context);
  return trail.length > 0 ? trail[trail.length - 1] : undefined;
}

/**
 * Captures the context to carry when leaving `pathname` for Ask.
 *
 * `existing` is the context already in play (e.g. the map already knew
 * the country); the current route becomes the new origin. Existing
 * geography/subject are preserved so the chain accumulates rather
 * than resetting at each hop — which is what makes a four-step
 * journey recoverable rather than only the last step.
 */
export function captureAskContext(input: {
  pathname: string;
  label: string;
  existing?: AskContext;
  countryCode?: string;
  countryName?: string;
  subjectId?: string;
  subjectLabel?: string;
  module?: BetaCategory;
  timeWindow?: string;
}): AskContext {
  const merged: AskContext = {
    ...input.existing,
    originRoute: safeOriginRoute(input.pathname) ?? input.existing?.originRoute,
    originLabel: input.label,
    countryCode: input.countryCode ?? input.existing?.countryCode,
    countryName: input.countryName ?? input.existing?.countryName,
    subjectId: input.subjectId ?? input.existing?.subjectId,
    subjectLabel: input.subjectLabel ?? input.existing?.subjectLabel,
    module: input.module ?? input.existing?.module,
    timeWindow: input.timeWindow ?? input.existing?.timeWindow,
  };

  return Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined),
  ) as AskContext;
}
