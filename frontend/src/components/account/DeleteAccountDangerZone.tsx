'use client';

import { useState } from 'react';

export interface DeleteAccountDangerZoneCopy {
  dangerZoneHeading: string;
  dangerZoneNote: string;
  /**
   * The single reviewed destructive warning — `navBar.deleteAccountConfirm`,
   * which enumerates every category deletion destroys. It is passed in rather
   * than re-authored here so no second copy of it can exist
   * (accountDeletionCopy.spec asserts exactly that).
   */
  warning: string;
  deleteAccountLabel: string;
  confirmationLabel: string;
  confirmationHint: string;
  confirmationMismatch: string;
  deletePermanently: string;
  deletingLabel: string;
  deleteFailed: string;
}

export interface DeleteAccountDangerZoneProps {
  /** The signed-in caller's own address — the string that must be typed back. */
  email: string;
  copy: DeleteAccountDangerZoneCopy;
  /** The real DELETE /users/me action, injected so it can be driven in tests. */
  onDelete: () => Promise<void>;
  /**
   * Announced to the parent on success. The deletion clears the session, so
   * this component's own host row unmounts immediately afterwards; the
   * confirmation therefore belongs to the PAGE, which survives, not here.
   * Found by the real-browser harness: without it the caller's last screen
   * after deleting was "Sign in to manage your account".
   */
  onDeleted: () => void;
}

/**
 * ACCOUNT DESTRUCTIVE-ACTION SAFETY — the ONLY surface in the product from
 * which an account can be deleted.
 *
 * WHY IT EXISTS. Deletion used to be a red entry in the header's account
 * popup, immediately below Sign Out, gated by a native window.confirm(). Two
 * adjacent controls — one ending a session, one destroying the account — is an
 * accidental-action hazard: the confirm dialog's default focus and a reflexive
 * Enter dismiss it as readily as the popup itself.
 *
 * WHAT DELIBERATE INTENT MEANS HERE, CONCRETELY:
 *   1. a dedicated route the caller had to navigate to (/account/settings);
 *   2. the full, un-abbreviated destructive warning, always visible — not
 *      revealed by the click that performs the action;
 *   3. a typed confirmation of the caller's OWN address, compared exactly;
 *   4. a final, separately-labelled "Delete account permanently" control that
 *      is `disabled` until (3) matches, so it is not merely styled as
 *      unavailable but is genuinely inoperable by mouse AND by keyboard.
 *
 * WHAT IS DELIBERATELY NOT HERE. Re-authentication. The existing auth
 * architecture is a Google OAuth redirect plus an httpOnly session cookie and
 * exposes no re-auth endpoint; implementing one is a backend/Auth change,
 * which this task is not authorized to make. DELETE /users/me is unchanged.
 */
export function DeleteAccountDangerZone({
  email,
  copy,
  onDelete,
  onDeleted,
}: DeleteAccountDangerZoneProps): JSX.Element {
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<'idle' | 'deleting' | 'failed'>('idle');

  /*
    Exact comparison against the caller's own address. Trimmed only for
    leading/trailing whitespace, which a paste or an autocomplete can add and
    which no address contains; never lowercased, never a prefix match, never a
    "close enough" comparison.
  */
  const matches = typed.trim() === email;
  const canDelete = matches && state !== 'deleting';

  async function handleDelete(): Promise<void> {
    if (!matches) return;
    setState('deleting');
    try {
      await onDelete();
      onDeleted();
    } catch {
      setState('failed');
    }
  }

  return (
    <section aria-labelledby="danger-zone-heading" className="mt-10 rounded-lg border border-red-500/40 p-5">
      <h2 id="danger-zone-heading" className="text-lg font-semibold text-red-400">
        {copy.dangerZoneHeading}
      </h2>
      <p className="mt-1 text-sm text-ink-secondary">{copy.dangerZoneNote}</p>

      <h3 className="mt-5 text-base font-medium text-ink-primary">{copy.deleteAccountLabel}</h3>
      {/* The warning is ALWAYS visible, never behind the action. */}
      <p className="mt-2 text-sm text-ink-secondary">{copy.warning}</p>

      <label htmlFor="delete-account-confirmation" className="mt-5 block text-sm text-ink-primary">
        {copy.confirmationLabel}
      </label>
      <input
        id="delete-account-confirmation"
        name="delete-account-confirmation"
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        aria-describedby="delete-account-confirmation-hint"
        className="mt-2 w-full max-w-md rounded border border-cyan-500/25 bg-transparent px-3 py-2 text-sm text-ink-primary"
      />
      <p id="delete-account-confirmation-hint" className="mt-2 text-xs text-ink-secondary">
        {copy.confirmationHint}
      </p>
      {typed.trim().length > 0 && !matches && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {copy.confirmationMismatch}
        </p>
      )}

      <button
        type="button"
        disabled={!canDelete}
        aria-disabled={!canDelete}
        onClick={() => void handleDelete()}
        className="mt-5 rounded border border-red-500/50 px-4 py-2 text-sm text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state === 'deleting' ? copy.deletingLabel : copy.deletePermanently}
      </button>

      {state === 'failed' && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {copy.deleteFailed}
        </p>
      )}
    </section>
  );
}
