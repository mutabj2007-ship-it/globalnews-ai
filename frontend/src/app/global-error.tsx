'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getFailureCopy } from '@/lib/i18n/failureCopy';
import { readLanguageCookie } from '@/lib/i18n/languages';

/**
 * MVP FAILURE FLOOR — THE LAST RESORT.
 *
 * Next renders this only when the ROOT LAYOUT ITSELF threw. It therefore
 * REPLACES that layout: it must supply its own <html> and <body>, and it runs
 * in a document where nothing the layout provides can be assumed to exist.
 *
 * ── WHY THIS FILE DELIBERATELY BREAKS THREE OF THIS LANE'S OWN HABITS ─────
 *
 * 1. IT DOES NOT USE `FailureSurface`, `PageCanvas` OR ONE TAILWIND CLASS.
 *    Those resolve through the stylesheet the root layout imports — the layout
 *    that just failed. A last-resort boundary whose legibility depends on the
 *    thing that broke is not a last resort. Every value below is inline, so
 *    this page renders correctly with NO stylesheet at all.
 *
 * 2. EVERY VALUE IS STILL A RELEASED CLAUDE DESIGN TOKEN, quoted by hand:
 *      #04060c   cd.void                 page base
 *      #e8f1ff   cd.ink.primary          heading
 *      #a7c0d8   cd.ink.secondary        body
 *      #7dd3fc   cd.ink.label            eyebrow
 *      #22d3ee   cd.ink.link             retry
 *      #9db8d2   cd.ink.control          home
 *      #5b7fa6   cd.ink.meta             reference
 *      rgba(56,189,248,.28)  cd.edge-control-active
 *      rgba(56,189,248,.12)  cd.edge-structural
 *    The type sizes are the released cd-screen-title (26px), cd-hero-copy
 *    (16px), cd-mono-section (12px), cd-mono-nav (11px) and cd-mono-meta
 *    (10.5px). This is a transcription of the design system, not a second one
 *    — `failureSurfaces.spec.ts` asserts every hex against tailwind.config.ts
 *    so the copy cannot drift from its source.
 *
 * 3. THE WAY HOME IS A PLAIN <a>, NOT `next/link`. A client-side navigation
 *    would ask the router to do the work, and the router lives inside the
 *    application that failed to start. A full document load is the only
 *    recovery that is actually independent of the fault.
 *
 * The font families fall back to the system stacks, because the layout's
 * `--font-cd-*` variables are not defined in this document. That is a real,
 * accepted difference from every other surface, and it is the correct trade:
 * legible in the system face beats unstyled in the brand one.
 *
 * ── LANGUAGE ──────────────────────────────────────────────────────────────
 *
 * Same rule as `error.tsx`: English on the first render, corrected from the
 * released `readLanguageCookie` after mount, so the client's first output
 * cannot disagree with the server's. `<html lang>` follows the same value.
 */

const PAGE: CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#04060c',
  color: '#e8f1ff',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

const COLUMN: CSSProperties = { maxWidth: '34rem', padding: '0 24px' };

const EYEBROW: CSSProperties = {
  margin: 0,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '12px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#7dd3fc',
};

const HEADING: CSSProperties = {
  margin: '12px 0 0',
  fontSize: '26px',
  lineHeight: 1.2,
  letterSpacing: '-0.01em',
  fontWeight: 600,
  color: '#e8f1ff',
};

const BODY: CSSProperties = {
  margin: '12px 0 0',
  fontSize: '16px',
  lineHeight: 1.55,
  color: '#a7c0d8',
};

const ACTIONS: CSSProperties = {
  marginTop: '20px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  alignItems: 'center',
};

const CONTROL: CSSProperties = {
  minHeight: '44px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 18px',
  borderRadius: '999px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  background: 'transparent',
  cursor: 'pointer',
};

const RETRY: CSSProperties = {
  ...CONTROL,
  border: '1px solid rgba(56,189,248,.28)',
  color: '#22d3ee',
};

const HOME: CSSProperties = {
  ...CONTROL,
  border: '1px solid rgba(56,189,248,.12)',
  color: '#9db8d2',
};

const REFERENCE: CSSProperties = {
  marginTop: '18px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '10.5px',
  textTransform: 'uppercase',
  color: '#5b7fa6',
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  const [language, setLanguage] = useState<LanguageCode>('en');

  useEffect(() => {
    setLanguage(readLanguageCookie() ?? 'en');
  }, []);

  const copy = getFailureCopy(language);

  return (
    <html lang={language}>
      <body style={PAGE}>
        <main style={COLUMN}>
          <p style={EYEBROW}>{copy.globalError.eyebrow}</p>
          <h1 style={HEADING}>{copy.globalError.heading}</h1>
          <p style={BODY}>{copy.globalError.body}</p>

          <div style={ACTIONS}>
            <button type="button" onClick={reset} style={RETRY}>
              {copy.globalError.retry}
            </button>
            <a href="/" style={HOME}>
              {copy.globalError.home}
            </a>
          </div>

          {/* The digest only. Never the message, never the stack. */}
          {error.digest !== undefined && error.digest.length > 0 && (
            <p style={REFERENCE}>
              {copy.referenceLabel} {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
