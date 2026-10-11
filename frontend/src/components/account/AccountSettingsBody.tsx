'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { DeleteAccountDangerZone } from '@/components/account/DeleteAccountDangerZone';
import { DisplayNameEditor } from '@/components/account/DisplayNameEditor';
import { AskAppearanceView, AskPreferencesSection } from '@/components/account/AskPreferencesSection';
import { useAccount } from '@/lib/hooks/useAccount';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import { askDictionary } from '@/lib/ask/shell/askDictionary';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { askSettingsR2Strings } from '@/lib/ask/askSettingsR2Strings';
import { displayLocaleOf } from '@/lib/i18n/languages';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { followStrings } from '@/lib/ask/followStrings';
import { MY_UPDATES_HREF } from '@/lib/ask/followedQuestions';
import { accountSignInUrl } from '@/lib/api/accountBase';
import { askLocation, cleanAskDestination } from '@/lib/ask/askCleanNavigation';
import { useAskNavOptional } from '@/components/ask-nav/AskNavShell';
import tokens from './settingsTokens.module.css';
import styles from './accountSettings.module.css';

/**
 * ACCOUNT DESTRUCTIVE-ACTION SAFETY — the dedicated settings surface the
 * Product Owner ruling requires, and the only route from which an account can
 * be deleted.
 *
 * ASK R3 SETTINGS-NAV ENGINEERING §2 (Claude Design GLOBALNEWSAI-R3-SETTINGS-NAV-ENGINEERING.zip,
 * SHA-256 57f5102e…7e5da5e22d; frames 08–15) — the seven approved groups, in order:
 *   1 Account · 2 Language & appearance · 3 Privacy & data · 4 Followed questions ·
 *   5 Help & legal · 6 Sign out (separate card) · 7 Delete account (quiet link → the Danger Zone,
 *   unchanged: the typed-email confirmation still gates the deletion).
 * Every row is an EXISTING control or destination; nothing new is stored and no backend call was
 * added. A guest sees the groups that need no account (frame 09), with a Sign in pill and no
 * identity of any kind. An account read that FAILED (not "signed out") is reported inside the
 * Account group only, with Try again; the other groups keep working (frame 14).
 *
 * One body, three presentations: the /account/settings route ('standalone', full page in the
 * Ask shell), the gear's sheet / dialog ('sheet', AskSettingsSheet owns the title and Close) and
 * the legacy 'platform' chrome.
 */
export function AccountSettingsBody({
  language = 'en',
  locale,
  chrome,
  onSignOut,
}: {
  /**
   * ALPHA VISUAL ACCEPTANCE REPAIR R1 — the page's language, resolved on the server from the
   * active language cookie (app/account/settings/page.tsx). Platform mode passes 'en', the
   * default this surface has always rendered there.
   */
  readonly language?: LanguageCode;
  /**
   * R4 · CTO LOCALIZATION CONVERGENCE — the reader's DisplayLocale on the standalone Ask shell.
   * Its labels then come from the one Ask locale authority (askDictionary: Claude L's qualified
   * overlay) instead of the two-catalogue getDictionary, which answered English for fr / de / es /
   * pt / ar. Platform mode omits it and renders exactly as before.
   */
  readonly locale?: DisplayLocale;
  /** 'platform' renders NavBar + Footer; 'standalone' the full-page body; 'sheet' the gear's sheet. */
  readonly chrome: 'platform' | 'standalone' | 'sheet';
  /** The shell's governed sign-out, when the shell is the caller (the sheet). */
  readonly onSignOut?: () => void;
}): JSX.Element {
  const { user, isLoading, readFailed, refresh, signOut, deleteAccount, updateDisplayName } = useAccount();
  const nav = useAskNavOptional();
  /*
    Deleting clears the session, so `user` becomes null and the signed-in
    branch below unmounts in the same render. Without this the caller's last
    screen after deleting their account was the sign-in prompt, which reads as
    if nothing happened. The real-browser harness caught it.
  */
  const [deleted, setDeleted] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [view, setView] = useState<'groups' | 'appearance'>('groups');
  const [dangerOpen, setDangerOpen] = useState(false);
  /*
    ALPHA VISUAL ACCEPTANCE REPAIR R1 — the language is provided by the server wrapper instead
    of a hard-coded English dictionary.
  */
  const dictionary = locale === undefined ? getDictionary(language) : askDictionary(locale);
  const t = dictionary.accountSettings;
  const ui: DisplayLocale = locale ?? displayLocaleOf(language);
  const g = askSettingsR2Strings(ui);
  const shell = askShellStrings(ui);
  const s = shell.askNavStrings;
  const signedIn = user !== null;
  /* frame 14 — a failed read, not a signed-out answer: the Account group says so; nothing else */
  const accountUnavailable = !isLoading && !signedIn && readFailed && !deleted;
  const askSurface = chrome !== 'platform' && locale !== undefined;

  /* The shell's governed sign-out when it is the caller; on the route the same steps here:
     visible Ask state cleared first, then a clean Ask load. */
  async function signOutHere(): Promise<void> {
    if (onSignOut !== undefined) {
      onSignOut();
      return;
    }
    nav?.clear();
    try {
      await signOut();
    } catch {
      /* the fresh load below shows the session as it really is */
    }
    askLocation.assign(cleanAskDestination('/account/settings'));
  }

  const groups = (
    <>
      {/* 1 · Account */}
      {!isLoading && !deleted && (
        <section data-settings-group="account" aria-labelledby="settings-account">
          <h3 id="settings-account" className={styles.groupHeading}>
            {g.accountH}
          </h3>
          <div className={styles.card}>
            {user !== null ? (
              <>
                {/* REASON TO RETURN R1 · G6 — the name Ask may use: the reader's own, or none */}
                <div className={styles.block}>
                  <DisplayNameEditor
                    key={user.id}
                    current={user.displayName}
                    locale={ui}
                    onSave={updateDisplayName}
                  />
                </div>
                <p className={styles.row}>
                  <span className={styles.rowLabel}>{g.emailLabel}</span>
                  {/* an address is always left-to-right, also in an Arabic interface */}
                  <span dir="ltr" style={{ unicodeBidi: 'isolate' }} className={styles.rowValue}>
                    {user.email}
                  </span>
                </p>
              </>
            ) : accountUnavailable ? (
              <div data-settings="account-error" className={styles.error}>
                <p role="alert">{g.acctFail}</p>
                <button
                  type="button"
                  data-settings="account-retry"
                  aria-disabled={retrying}
                  className={styles.pill}
                  onClick={() => {
                    if (retrying) return;
                    setRetrying(true);
                    void refresh().finally(() => setRetrying(false));
                  }}
                >
                  {g.retry}
                </button>
              </div>
            ) : (
              <div data-settings="guest-note" className={styles.guest}>
                <p>{askSurface ? g.guestNote : t.signInPrompt}</p>
                <a href={accountSignInUrl('/account/settings')} className={styles.pillAccent}>
                  {s.signIn}
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2 · Language & appearance — the same two controls as the conversations footer
          (R3 FULL DESIGN · D13), as rows; standalone Ask only (platform mode is unchanged). */}
      {askSurface && (
        <div data-settings-group="language-appearance">
          <AskPreferencesSection locale={locale} onOpenAppearance={() => setView('appearance')} />
        </div>
      )}

      {/* 3 · Privacy & data */}
      <section data-settings-group="privacy" aria-labelledby="settings-privacy">
        <h3 id="settings-privacy" className={styles.groupHeading}>
          {g.privacyData}
        </h3>
        <div className={styles.card}>
          <a href="/privacy" className={styles.row}>
            <span className={styles.rowLabel}>{g.privacyPolicy}</span>
            <span aria-hidden="true" className={styles.chevron} />
          </a>
          <a href="/cookies" className={styles.row}>
            <span className={styles.rowLabel}>{shell.askR2Strings.cookiesLink}</span>
            <span aria-hidden="true" className={styles.chevron} />
          </a>
          {signedIn && <p className={styles.note}>{g.privacyNote}</p>}
        </div>
      </section>

      {/* 4 · Followed questions — a signed-in reader's own; no count, no unread badge */}
      {signedIn && (
        <section data-settings-group="followed" aria-labelledby="settings-followed">
          <h3 id="settings-followed" className={styles.groupHeading}>
            {g.followedH}
          </h3>
          <div className={styles.card}>
            <Link href={MY_UPDATES_HREF} prefetch={false} className={styles.row}>
              <span className={styles.rowLabel}>{followStrings(ui).myUpdates}</span>
              <span aria-hidden="true" className={styles.chevron} />
            </Link>
            <p className={styles.note}>{g.updatesNote}</p>
          </div>
        </section>
      )}

      {/* 5 · Help & legal */}
      <section data-settings-group="help-legal" aria-labelledby="settings-help">
        <h3 id="settings-help" className={styles.groupHeading}>
          {g.supportLegal}
        </h3>
        <div className={styles.card}>
          <Link href="/support" prefetch={false} className={styles.row}>
            <span className={styles.rowLabel}>{s.help}</span>
            <span aria-hidden="true" className={styles.chevron} />
          </Link>
          <a href="/terms" className={styles.row}>
            <span className={styles.rowLabel}>{g.termsOfUse}</span>
            <span aria-hidden="true" className={styles.chevron} />
          </a>
        </div>
      </section>

      {signedIn && (
        <>
          {/* 6 · Sign out — a separate card */}
          <section data-settings-group="sign-out">
            <div className={styles.signOutCard}>
              <button type="button" data-settings="sign-out" className={styles.signOut} onClick={() => void signOutHere()}>
                {s.signOut}
              </button>
            </div>
            <p className={styles.signOutNote}>{g.signOutNote}</p>
          </section>

          {/* 7 · Delete account — a quiet link to the Danger Zone, which is unchanged */}
          <div data-settings-group="delete-account">
            <button
              type="button"
              data-settings="delete-account-link"
              aria-expanded={dangerOpen}
              className={styles.deleteLink}
              onClick={() => setDangerOpen((was) => !was)}
            >
              {dictionary.navBar.deleteAccount}
              <span aria-hidden="true" className={styles.chevron} />
            </button>
            {dangerOpen && (
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
            )}
          </div>
        </>
      )}
    </>
  );

  const content = (
    <>
      {!isLoading && !user && deleted && (
        <section className="mt-6 rounded-lg border border-cyan-500/25 p-5">
          <h2 className="text-lg font-semibold text-ink-primary">{t.deletedHeading}</h2>
          <p className="mt-2 text-sm text-ink-secondary">{t.deletedNote}</p>
        </section>
      )}
      {view === 'appearance' && askSurface ? (
        <AskAppearanceView locale={locale} backLabel={s.settings} onBack={() => setView('groups')} />
      ) : (
        groups
      )}
    </>
  );

  if (chrome === 'sheet') {
    return <div className={styles.body}>{content}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-void">
      {chrome === 'platform' && <NavBar />}
      {/* R4 · the settings content takes the reader's direction (Arabic RTL); the platform
          NavBar / Footer around it are general platform chrome and keep their own */}
      <main
        className={`mx-auto w-full max-w-3xl flex-1 px-6 py-10 ${tokens.settingsScope}`}
        {...(locale === undefined ? {} : askDirectionProps(locale))}
      >
        <h1 className="text-2xl font-semibold text-ink-primary">{t.heading}</h1>
        <div className={styles.body}>{content}</div>
      </main>
      {chrome === 'platform' && <Footer />}
    </div>
  );
}
