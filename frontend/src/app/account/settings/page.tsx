'use client';

import { useState } from 'react';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { DeleteAccountDangerZone } from '@/components/account/DeleteAccountDangerZone';
import { useAccount } from '@/lib/hooks/useAccount';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ACCOUNT DESTRUCTIVE-ACTION SAFETY — the dedicated settings surface the
 * Product Owner ruling requires, and the only route from which an account can
 * be deleted.
 *
 * SCOPE, DELIBERATELY NARROW: this is not a redesign of the account area. It
 * is the identity row the account popup already showed, plus the Danger Zone
 * the deletion action was moved into. Nothing else was built here.
 */
export default function AccountSettingsPage(): JSX.Element {
  const { user, isLoading, deleteAccount } = useAccount();
  /*
    Deleting clears the session, so `user` becomes null and the signed-in
    branch below unmounts in the same render. Without this the caller's last
    screen after deleting their account was the sign-in prompt, which reads as
    if nothing happened. The real-browser harness caught it.
  */
  const [deleted, setDeleted] = useState(false);
  /*
    This route is reached from the header's account menu, which only exists
    for a signed-in caller; English is the same default every other client
    route on this line uses when it has no server-provided language.
  */
  const dictionary = getDictionary('en');
  const t = dictionary.accountSettings;

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <NavBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold text-ink-primary">{t.heading}</h1>

        {!isLoading && !user && deleted && (
          <section className="mt-6 rounded-lg border border-cyan-500/25 p-5">
            <h2 className="text-lg font-semibold text-ink-primary">{t.deletedHeading}</h2>
            <p className="mt-2 text-sm text-ink-secondary">{t.deletedNote}</p>
          </section>
        )}

        {!isLoading && !user && !deleted && (
          <p className="mt-4 text-ink-secondary">{t.signInPrompt}</p>
        )}

        {user && (
          <>
            <p className="mt-4 text-ink-secondary">{t.intro}</p>
            <p className="mt-4 text-sm text-ink-secondary">
              <span className="block">{dictionary.navBar.signedInAs}</span>
              <span className="block font-medium text-ink-primary">{user.email}</span>
            </p>

            <DeleteAccountDangerZone
              email={user.email}
              onDelete={deleteAccount}
              onDeleted={() => setDeleted(true)}
              copy={{
                dangerZoneHeading: t.dangerZoneHeading,
                dangerZoneNote: t.dangerZoneNote,
                /* The ONE reviewed destructive warning, not a second copy of it. */
                warning: dictionary.navBar.deleteAccountConfirm,
                deleteAccountLabel: dictionary.navBar.deleteAccount,
                confirmationLabel: t.confirmationLabel,
                confirmationHint: t.confirmationHint,
                confirmationMismatch: t.confirmationMismatch,
                deletePermanently: t.deletePermanently,
                deletingLabel: t.deletingLabel,
                deleteFailed: t.deleteFailed,
              }}
            />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
