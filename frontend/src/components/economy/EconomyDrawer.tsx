import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';

/**
 * ECON-UI-1 — THE REPLACEMENT DRAWER. Sustained investigation.
 *
 * REPLACEMENT, NOT ACCUMULATION. The drawer replaces the attention-queue column in place;
 * opening a second drawer replaces the first. This component holds no stack and exposes
 * no "push" — the caller owns ONE drawer id, so a second drawer is structurally the same
 * act as changing which one is open.
 *
 * It never pushes the first viewport off screen and never stacks below the substrate as a
 * scrolling page: it is a grid column, so it cannot.
 *
 * Width is per-content (460–620px) and is FIXED at every breakpoint — a wider screen
 * widens the substrate, not the drawer.
 */
/**
 * `SOURCES` IS A ROUTING TARGET THE REGISTER ALREADY NAMED.
 *
 * The first-viewport zoning model lists what is *"Not resident, always reachable"* and
 * sources is one of the four. The implementation had drawers for the other three —
 * timeline, relationships (the transmission chain) and evidence of revision — and none for
 * sources, so the source and observation-base explanation had nowhere to go but the first
 * viewport. Adding the member builds a target the accepted register specifies; it is not a
 * new region and nothing about the zoning changes.
 */
export type DrawerKind =
  | 'REVISION_TRACK' | 'COMPETING_READINGS' | 'TRANSMISSION_CHAIN'
  | 'POLICY_EVENT' | 'WATCH_CONFIG' | 'TIMELINE' | 'INDICATOR_CARD' | 'SOURCES';

/** Widths the Phase 2 board fixes per drawer content. */
export const DRAWER_WIDTH_PX: Readonly<Record<DrawerKind, number>> = {
  INDICATOR_CARD: 520,
  REVISION_TRACK: 520,
  COMPETING_READINGS: 620,
  TRANSMISSION_CHAIN: 460,
  POLICY_EVENT: 520,
  WATCH_CONFIG: 520,
  TIMELINE: 520,
  // Prose, at the same width the other prose drawers use. A wider screen widens the
  // substrate, never this.
  SOURCES: 520,
};

export function EconomyDrawer({
  title, meta, locale, onClose, children,
}: {
  title: string;
  meta?: string;
  locale: EconomyLocale;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element {
  const t = economyStrings(locale);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent): void {
      // Back returns to the substrate.
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section
      data-econ="drawer"
      aria-label={title}
      style={{ background: ECON_SURFACE.panel, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <header
        style={{
          padding: '14px 18px', borderBottom: `1px solid ${ECON_LINE.structure}`,
          background: ECON_SURFACE.raised, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '10px', flex: '0 0 auto',
        }}
      >
        <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 11px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.primary }}>
          {title}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {meta && (
            <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.09em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
              {meta}
            </span>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t.drawerClose}
            style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 11px)', color: ECON_INK.label, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            ✕
          </button>
        </span>
      </header>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>{children}</div>
    </section>
  );
}
