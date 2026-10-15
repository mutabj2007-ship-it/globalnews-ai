'use client';

import { useRef, useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { addressableName } from '@globalnews-ai/shared';
import { accountNameSource, shownAccountName, type AccountNameFields } from '@/lib/account/accountName';
import { askGreetingStrings } from '@/lib/ask/askGreetingStrings';
import { DisplayNameEditor } from './DisplayNameEditor';
import styles from './accountSettings.module.css';

/**
 * R3.1 GOOGLE PROFILE PERSONALIZATION (PO/CTO, 2026-10-11) — Settings › Account shows the
 * reader's identity instead of a prominent name-entry form: the name Ask uses ("Chosen by you" —
 * R76: the saved name is the only source), that it is also public on comments (R76 E1 C-3), and an
 * optional Change action that opens the existing editor. Nothing is typed unless the reader asks to.
 * No email address here — the Email row below is the only place it appears.
 */
export function AccountIdentity({
  user,
  locale,
  onSave,
}: {
  readonly user: AccountNameFields;
  readonly locale: DisplayLocale;
  readonly onSave: (name: string | null) => Promise<{ ok: true } | { ok: false; code: string | null }>;
}): JSX.Element {
  const t = askGreetingStrings(locale);
  const [editing, setEditing] = useState(false);
  const changeRef = useRef<HTMLButtonElement | null>(null);
  const name = shownAccountName(user);
  const source = accountNameSource(user);
  /* R76 E1 C-2 — the saved name is the only source there is */
  const sourceLine = source === 'CHOSEN' ? t.chosenByYou : null;
  const close = (): void => {
    setEditing(false);
    /* focus returns to Change once the editor has unmounted */
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => changeRef.current?.focus());
  };

  if (editing) {
    return (
      <div data-account="identity-edit" className={styles.block}>
        <DisplayNameEditor
          current={addressableName(user.displayName) ?? name}
          locale={locale}
          onSave={onSave}
          hint={t.editHint}
          cancelLabel={t.cancel}
          onCancel={close}
          onSaved={close}
          autoFocus
        />
      </div>
    );
  }
  return (
    <div data-account="identity" className={styles.row}>
      {/* the label keeps its own width; the name and its source take the rest of the row */}
      <span className={styles.rowLabel} style={{ flex: '0 0 auto' }}>
        {t.nameLabel}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-end text-end">
        <span data-account="identity-name" dir="auto" style={{ unicodeBidi: 'isolate' }} className={styles.rowValue}>
          {name ?? t.notSet}
        </span>
        {sourceLine !== null && (
          <span data-account="identity-source" className="text-xs text-ink-tertiary">
            {sourceLine}
          </span>
        )}
        {/* R76 E1 C-3 — a saved name is also the public author label on comments */}
        {name !== null && (
          <span data-account="identity-public" className="text-xs text-ink-tertiary">
            {t.publicNote}
          </span>
        )}
      </span>
      <button
        ref={changeRef}
        type="button"
        data-account="identity-change"
        className={styles.pill}
        style={{ marginTop: 0 }}
        onClick={() => setEditing(true)}
      >
        {t.change}
      </button>
    </div>
  );
}
