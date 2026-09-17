'use client';

import { useEffect, useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { AUTH_ERROR_PARAM, isAuthErrorCode, type AuthErrorCode } from '@globalnews-ai/shared';

import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B5-A · OAUTH V1 — THE AUTH ERROR BANNER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1-BETA-SECURITY-GATES-R3 §C, frontend half. Two states, `cancelled` and
 * `failed`, and nothing else renders.
 *
 * ── THE PARAMETER IS ATTACKER-SUPPLIED, AND THAT SHAPES EVERY RULE ───────
 *
 * Anyone can send a victim to `/?auth_error=failed` and manufacture a
 * real-looking failure banner ON THE REAL SITE. That forgery cannot be
 * prevented — the URL is the visitor's to write. It can only be made INERT, and
 * every rule below is part of making it inert:
 *
 *   C-9   LOOKUP ONLY. The raw value is never interpolated into text, an
 *         attribute, a class name, a key, a URL, a fetch target or an analytics
 *         event. It selects a frozen message or it selects nothing.
 *
 *   C-10  Unknown, empty, repeated, array or object renders NOTHING — not the
 *         generic message, nothing. Fail closed, and silently: a console
 *         warning would itself be a signal that the probe landed.
 *
 *   C-14  The message gives its reader NOTHING TO ACT ON except the sign-in
 *         control already on the page. No link, no email address, no phone
 *         number. THIS IS A SECURITY PROPERTY, NOT A STYLE RULE — a support
 *         number inside that string converts a cosmetic forgery into a
 *         phishing primitive.
 *
 * ── WHY THE PARAMETER IS STRIPPED ────────────────────────────────────────
 *
 * C-11. Left in place it persists into bookmarks, shares and `Referer`, and a
 * refresh would resurrect a failure that already happened. `replaceState` also
 * keeps the landing out of history, so Back does not return the reader to their
 * own failure.
 *
 * It is stripped whenever it is PRESENT, not only when it was valid — a forged
 * unknown value should not survive in the address bar either.
 *
 * ── AND WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────────────
 *
 * No automatic retry (C-16): an auto-retry against Google is a redirect loop
 * that reads as an attack in every log it touches. No retry prompt on
 * `cancelled` (C-18) — the person chose to stop. No attempt counter, no
 * cooldown, no disabled button (C-20), and the message never escalates (C-19),
 * because an escalating message IS an attempt counter.
 */

/** C-9 — the frozen map. Lookup only; the raw value never reaches this object. */
function messageFor(code: AuthErrorCode, language: LanguageCode): string {
  const copy = getDictionary(language).authError;

  return code === 'cancelled' ? copy.cancelled : copy.failed;
}

export function AuthErrorBanner({ language }: { language: LanguageCode }): JSX.Element | null {
  const [code, setCode] = useState<AuthErrorCode | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    /*
      Read from `window` rather than `useSearchParams`, deliberately and for the
      same reason MapSignInReturn does: this must observe the URL as it actually
      is at mount, and it must not put the homepage behind a Suspense boundary
      to do it.

      `URLSearchParams.get` returns the FIRST value for a repeated parameter and
      a plain string for a bracketed one, so neither shape can reach the state
      as anything but a string — and `isAuthErrorCode` then rejects both,
      because neither 'a' nor '[x]' is in the frozen set. The type test in
      `isAuthErrorCode` is what makes that true without a special case here.
    */
    const params = new URLSearchParams(window.location.search);

    if (!params.has(AUTH_ERROR_PARAM)) return;

    const raw = params.get(AUTH_ERROR_PARAM);

    /* C-10 — admission is the shared test and nothing else. */
    if (isAuthErrorCode(raw)) setCode(raw);

    /* C-11 — strip whether or not it was admissible. */
    params.delete(AUTH_ERROR_PARAM);

    const query = params.toString();
    const next = `${window.location.pathname}${query.length > 0 ? `?${query}` : ''}${window.location.hash}`;

    window.history.replaceState(null, '', next);
  }, []);

  if (code === null || dismissed) return null;

  const copy = getDictionary(language).authError;

  return (
    <div
      /*
        C-12 — role="status" is polite: it is announced without interrupting,
        which is right for something the reader did not ask for. Dismissal is
        per visit and NOT persisted; remembering it across visits would be
        client-side attempt tracking, which C-20 forbids.
      */
      role="status"
      aria-live="polite"
      data-gn-auth-error={code}
      className="mx-auto mb-4 flex w-full max-w-3xl items-start justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink-primary"
    >
      <p className="m-0">{messageFor(code, language)}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={copy.dismissLabel}
        className="shrink-0 rounded px-2 py-1 text-ink-tertiary transition-colors hover:bg-surface-hover hover:text-ink-primary"
      >
        {'×'}
      </button>
    </div>
  );
}
