'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { DISPLAY_NAME_MAX_CHARS, normalizeDisplayName } from '@globalnews-ai/shared';
import { followStrings } from '@/lib/ask/followStrings';

/**
 * REASON TO RETURN R1 · §7 / G6 — the reader's own preferred name. Previewed with the same shared
 * rule the server applies, so what is accepted here is exactly what is stored. Empty = no saved
 * name.
 *
 * R3.1 GOOGLE PROFILE PERSONALIZATION (PO/CTO, 2026-10-11) — this form is no longer the prominent
 * thing in Settings › Account: the account's name is DISPLAYED (AccountIdentity) and this editor
 * opens only from its optional Change action, pre-filled with the name currently shown. An empty
 * save clears the saved name, and Ask falls back to the Google profile / verified-email greeting
 * name (`hint` says so). It writes ONLY the preferred name (PATCH /users/me).
 * SUPERSEDED: the R3.1 FIX 4 alias pre-fill and alias hint (the alias is not used for display).
 */
export function DisplayNameEditor({
  current,
  locale,
  onSave,
  hint,
  cancelLabel,
  onCancel,
  onSaved,
  autoFocus = false,
}: {
  readonly current: string | null;
  readonly locale: string;
  readonly onSave: (name: string | null) => Promise<{ ok: true } | { ok: false; code: string | null }>;
  /** R3.1 — the hint under the field; the original wording when omitted. */
  readonly hint?: string;
  /** R3.1 — a Cancel button that closes the editor without saving. */
  readonly cancelLabel?: string;
  readonly onCancel?: () => void;
  /** R3.1 — called after a successful save (the identity row closes the editor). */
  readonly onSaved?: () => void;
  readonly autoFocus?: boolean;
}): JSX.Element {
  const s = followStrings(locale);
  const [value, setValue] = useState(current ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  const preview = normalizeDisplayName(value);
  const problem = preview.ok
    ? null
    : preview.code === 'DISPLAY_NAME_TOO_LONG'
      ? s.nameTooLong
      : s.nameInvalid;

  return (
    <form
      data-account="display-name"
      className="mt-2 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !preview.ok) return;
        setBusy(true);
        void onSave(preview.value).then((outcome) => {
          setBusy(false);
          if (outcome.ok) {
            setStatus(preview.value === null ? s.nameCleared : s.nameSaved);
            onSaved?.();
          } else
            setStatus(
              outcome.code === 'DISPLAY_NAME_TOO_LONG'
                ? s.nameTooLong
                : outcome.code === 'DISPLAY_NAME_INVALID'
                  ? s.nameInvalid
                  : s.nameFailed,
            );
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-ink-secondary">
        <span className="font-medium text-ink-primary">{s.nameLabel}</span>
        <input
          ref={inputRef}
          type="text"
          name="displayName"
          autoComplete="nickname"
          value={value}
          maxLength={DISPLAY_NAME_MAX_CHARS * 2}
          aria-invalid={problem !== null}
          aria-describedby="display-name-hint"
          onChange={(event) => {
            setValue(event.target.value);
            setStatus(null);
          }}
          className="min-h-[44px] rounded-md border border-cyan-500/25 bg-transparent px-3 text-ink-primary"
        />
      </label>
      <p id="display-name-hint" className="text-xs text-ink-tertiary">
        {problem ?? hint ?? s.nameHint}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || problem !== null}
          className="min-h-[44px] rounded-md border border-cyan-500/40 px-4 text-sm text-ink-primary disabled:opacity-60"
        >
          {s.nameSave}
        </button>
        {onCancel !== undefined && cancelLabel !== undefined && (
          <button
            type="button"
            data-account="display-name-cancel"
            onClick={onCancel}
            className="min-h-[44px] rounded-md px-4 text-sm text-ink-secondary"
          >
            {cancelLabel}
          </button>
        )}
        {status !== null && (
          <span role="status" className="text-sm text-ink-secondary">
            {status}
          </span>
        )}
      </div>
    </form>
  );
}
