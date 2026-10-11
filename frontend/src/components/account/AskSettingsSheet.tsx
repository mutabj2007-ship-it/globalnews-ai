'use client';

import { useEffect, useId, useRef, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { AskSettingsGlyph } from '@/components/ask-frame/AskSettingsGlyph';
import { AccountSettingsBody } from './AccountSettingsBody';
import navStyles from '../ask-nav/askNav.module.css';
import tokens from './settingsTokens.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 SETTINGS-NAV ENGINEERING §2 — SETTINGS OVER THE CURRENT ASK VIEW
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Opened by the drawer's gear (a plain click). Below 700 px a full-height sheet, from 700 px a
 * centred 560 px dialog (askNav.module.css `.settingsSheet`). The Ask view underneath stays
 * MOUNTED, so the composer draft, the conversation and the scroll position are exactly as the
 * reader left them; Close or Escape returns to it with focus on ☰ (the shell does that).
 *
 * The content is the SAME body the /account/settings route renders (AccountSettingsBody, seven
 * groups); the route stays valid for direct load and reload. Opening this issues only the body's
 * own account read (GET /users/me) — no Ask, model or provider request.
 *
 * Keyboard: focus goes to Close on open; Tab is contained; Escape closes, except while a control
 * inside owns it (an open language list, the Appearance sub-view, a confirmation dialog).
 */
export function AskSettingsSheet({
  locale,
  title,
  closeLabel,
  onClose,
  onSignOut,
}: {
  readonly locale: DisplayLocale;
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  /** The shell's governed sign-out (visible Ask state cleared first). */
  readonly onSignOut: () => void;
}): JSX.Element {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent): void {
      const sheet = sheetRef.current;
      if (sheet === null) return;
      const active = document.activeElement;
      if (active?.closest('[role="alertdialog"]') != null) return;
      if (event.key === 'Escape') {
        if (active !== null && sheet.contains(active) && active.getAttribute('aria-expanded') === 'true') return;
        if (sheet.querySelector('[data-settings="appearance-view"]') !== null) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (first === undefined || last === undefined) return;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <>
      <div aria-hidden="true" data-settings="scrim" className={`${tokens.settingsScope} ${navStyles.settingsScrim}`} onClick={onClose} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-settings="sheet"
        className={`${tokens.settingsScope} ${navStyles.settingsSheet}`}
        {...askDirectionProps(locale)}
      >
        <div className={navStyles.settingsHead}>
          <button
            ref={closeRef}
            type="button"
            data-settings="close"
            aria-label={closeLabel}
            onClick={onClose}
            className={navStyles.drawerIconButton}
          >
            <AskSettingsGlyph name="close" />
          </button>
          <h2 id={titleId} className={navStyles.settingsTitle}>
            {title}
          </h2>
        </div>
        <div className={navStyles.settingsBody}>
          <AccountSettingsBody locale={locale} chrome="sheet" onSignOut={onSignOut} />
        </div>
      </div>
    </>
  );
}
