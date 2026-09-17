import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';
import { HUD_MAX_PX, HUD_MIN_PX } from '@/lib/economy/economyConfig';

/**
 * ECON-UI-1 — THE ANCHORED HUD. Quick explanation, and nothing else.
 *
 * The routing contract is strict and every clause of it is structural here rather than
 * conventional:
 *
 *   280–360px             — width is clamped, not passed in
 *   ONE AT A TIME         — the caller owns a single open-id; there is no stack to push to
 *   NEVER SCROLLABLE      — `overflow: visible`, no max-height. Content that does not fit
 *                           is content that belongs in a drawer.
 *   NO METERED ACTION     — the type has no action slot at all. A HUD cannot contain one
 *                           because there is nowhere to put it.
 *   ZERO AI               — precomputed metadata only
 *   DISMISS               — outside click, Esc, or the anchor leaving context
 *
 * Making "no metered action" a TYPE constraint rather than a review note is deliberate:
 * the accidental-spend risk the AI Cost Map names is exactly the kind of thing that
 * arrives later as "just one button".
 */
export function AnchoredHud({
  title, body, locale, onDismiss, footNotes = [],
}: {
  title: string;
  /** Precomputed prose. Not a render-prop, so no caller can inject a control. */
  body: string;
  locale: EconomyLocale;
  onDismiss: () => void;
  footNotes?: readonly string[];
}): JSX.Element {
  const t = economyStrings(locale);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onDismiss();
    }
    function onPointer(e: MouseEvent): void {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onDismiss();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      data-econ="hud"
      role="dialog"
      aria-label={title}
      style={{
        minWidth: `${HUD_MIN_PX}px`, maxWidth: `${HUD_MAX_PX}px`,
        border: `1px solid ${ECON_LINE.accentLine}`, background: ECON_SURFACE.raised,
        padding: '15px', display: 'flex', flexDirection: 'column', gap: '11px',
        // never scrollable — see the contract above
        overflow: 'visible',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.primary }}>
          {title}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 11px)', color: ECON_INK.label, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        >
          {t.hudDismiss}
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 13px)', lineHeight: 'var(--ar-lh, 1.6)', color: ECON_INK.secondary }}>{body}</p>

      <div style={{ paddingTop: '9px', borderTop: `1px solid ${ECON_LINE.hairline}`, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {footNotes.map((n) => (
          <span key={n} style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
            {n}
          </span>
        ))}
        <span data-econ="hud-zero-ai" style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
          {t.hudZeroAi}
        </span>
      </div>
    </div>
  );
}
