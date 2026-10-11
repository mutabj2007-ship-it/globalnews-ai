'use client';

import { useState, type JSX } from 'react';
import { DISPLAY_NAME_MAX_CHARS, normalizeDisplayName } from '@globalnews-ai/shared';
import { followStrings } from '@/lib/ask/followStrings';

/**
 * REASON TO RETURN R1 · §7 / G6 — the reader's own preferred name, the ONLY source of the name
 * Ask may use. Previewed with the same shared rule the server applies, so what is accepted here
 * is exactly what is stored. Empty = no name (the neutral greeting). Never prefilled from the
 * email address.
 *
 * R3.1 PRODUCT OWNER ACCEPTANCE · FIX 4 — SUPERSEDED for the alias only: an account with no saved
 * name shows its automatic account alias (`alias`, assigned by the server: the email's local part
 * plus a unique number, never the address) in the field instead of a blank, with `aliasHint`
 * explaining it. Saving still writes ONLY the preferred name; an empty field falls back to the
 * alias, never to the address. The alias itself is never edited or overwritten here.
 */
export function DisplayNameEditor({
  current,
  alias = null,
  aliasHint,
  locale,
  onSave,
}: {
  readonly current: string | null;
  /** R3.1 FIX 4 — the account's automatic alias, when the server assigned one. */
  readonly alias?: string | null;
  /** R3.1 FIX 4 — the hint naming the alias (askSettingsR2Strings.aliasHint). */
  readonly aliasHint?: (alias: string) => string;
  readonly locale: string;
  readonly onSave: (name: string | null) => Promise<{ ok: true } | { ok: false; code: string | null }>;
}): JSX.Element {
  const s = followStrings(locale);
  const [value, setValue] = useState(current ?? alias ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = normalizeDisplayName(value);
  const problem = preview.ok
    ? null
    : preview.code === 'DISPLAY_NAME_TOO_LONG'
      ? s.nameTooLong
      : s.nameInvalid;

  return (
    <form
      data-account="display-name"
      className="mt-6 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !preview.ok) return;
        setBusy(true);
        void onSave(preview.value).then((outcome) => {
          setBusy(false);
          if (outcome.ok) setStatus(preview.value === null ? s.nameCleared : s.nameSaved);
          else
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
        {problem ?? (alias !== null && aliasHint !== undefined ? aliasHint(alias) : s.nameHint)}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || problem !== null}
          className="min-h-[44px] rounded-md border border-cyan-500/40 px-4 text-sm text-ink-primary disabled:opacity-60"
        >
          {s.nameSave}
        </button>
        {status !== null && (
          <span role="status" className="text-sm text-ink-secondary">
            {status}
          </span>
        )}
      </div>
    </form>
  );
}
