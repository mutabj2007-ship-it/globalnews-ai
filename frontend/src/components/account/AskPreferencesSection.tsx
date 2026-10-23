'use client';

import { useCallback, useContext, useEffect, useId, useRef, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { DISPLAY_LOCALE_META, type DisplayLocale } from '@globalnews-ai/shared';
import { SELECTABLE_LOCALES, persistLanguageSelection } from '@/lib/i18n/languages';
import { ThemeScopeContext } from '@/components/platform/ThemeControl';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askDictionary } from '@/lib/ask/shell/askDictionary';
import { askSettingsR2Strings } from '@/lib/ask/askSettingsR2Strings';
import { THEME_PREFERENCES, isValidClockTime } from '@/lib/theme/theme';
import { setThemePreference, useThemePreference, useThemeSchedule } from '@/lib/theme/themeStore';
import { AskSettingsGlyph } from '@/components/ask-frame/AskSettingsGlyph';
import styles from './accountSettings.module.css';

/**
 * ASK R3 FULL DESIGN R1 — D13 "Preferences and privacy": Language (incl. RTL) and Appearance
 * (Light / Dark / System / Scheduled) on the settings page.
 *
 * ASK R3 SETTINGS-NAV ENGINEERING §2 — the group "Language & appearance" as two rows (frames 08,
 * 13): Language · {current} (the same LanguageSelector) and [sun/moon] Appearance · {current} ›,
 * which opens the Appearance sub-view. The sun/moon is used here and nowhere else.
 *
 * NOTHING NEW IS STORED: the same first-party language cookie and the same theme cookie the
 * conversations footer writes (setThemePreference, as ThemeControl does). "What Ask remembers"
 * is omitted — there is no preferences store, and the design permits omission until one exists.
 */
export function AskPreferencesSection({
  locale,
  onOpenAppearance,
  onOpenLanguage,
}: {
  readonly locale: DisplayLocale;
  readonly onOpenAppearance: () => void;
  /** R3.1 FIX 5 — opens the Language sub-view (AskLanguageView). */
  readonly onOpenLanguage: () => void;
}): JSX.Element {
  const scope = useContext(ThemeScopeContext);
  const preference = useThemePreference(scope ?? 'system');
  const nav = askShellStrings(locale).askNavStrings;
  const g = askSettingsR2Strings(locale);
  const theme = askDictionary(locale).homeR1.theme;
  return (
    <section data-ask="settings-preferences" aria-labelledby="ask-settings-preferences">
      {/* SUPERSEDED heading: askR3FullStrings(locale).preferencesHeading */}
      <h3 id="ask-settings-preferences" className={styles.groupHeading}>
        {g.langApp}
      </h3>
      <div className={styles.card}>
        {/*
          R3.1 PRODUCT OWNER ACCEPTANCE · FIX 5 — SUPERSEDED: the small legacy "EN" dropdown
          (LanguageSelector) in this row. The row now reads "Language · {the language's own name} ›"
          like Appearance, and opens the Language view below. Same cookie, same refresh.
        */}
        <button
          type="button"
          data-settings="language-row"
          className={styles.rowButton}
          onClick={onOpenLanguage}
        >
          <span className={styles.rowLabel}>{nav.language}</span>
          <span className={styles.rowValue} lang={locale} dir={DISPLAY_LOCALE_META[locale].direction}>
            {DISPLAY_LOCALE_META[locale].endonym}
          </span>
          <span aria-hidden="true" className={styles.chevron} />
        </button>
        {scope !== null && (
          <button
            type="button"
            data-settings="appearance-row"
            className={styles.rowButton}
            onClick={onOpenAppearance}
          >
            <span className={styles.rowLabel}>
              <AskSettingsGlyph name="appearance" className={styles.glyph} />
              {g.appearance}
            </span>
            <span className={styles.rowValue}>{theme[preference]}</span>
            <span aria-hidden="true" className={styles.chevron} />
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * R3.1 PRODUCT OWNER ACCEPTANCE · FIX 5 — THE LANGUAGE VIEW, the same pattern as Appearance:
 * "‹ Settings", the title, then a native radiogroup of every SELECTABLE locale (the contracted
 * seven: EN / PL / FR / DE / ES / PT / AR), each in its own name, in its own language and
 * direction. The selected one is checked and marked; arrows move and select, as native radios do.
 *
 * Choosing writes the SAME first-party language cookie (persistLanguageSelection) and re-renders
 * the server components (router.refresh), exactly what the old dropdown did. No request to Ask, no
 * reload: client state — the view, the sheet, an unsent Ask draft underneath — stays. Re-choosing
 * the current language is a no-op. Escape returns to the Settings list.
 *
 * NOT OFFERED: Kiswahili and Kinyarwanda. They are source languages (LanguageCode) but not display
 * locales: no qualified interface catalogue exists, and listing them would present an English
 * interface as localized. See the R3.1 language-support matrix.
 */
export function AskLanguageView({
  locale,
  backLabel,
  onBack,
}: {
  readonly locale: DisplayLocale;
  readonly backLabel: string;
  readonly onBack: () => void;
}): JSX.Element {
  const router = useRouter();
  const nav = askShellStrings(locale).askNavStrings;
  const g = askSettingsR2Strings(locale);
  const id = useId();
  const backRef = useRef<HTMLButtonElement | null>(null);
  const choose = useCallback(
    (next: DisplayLocale): void => {
      if (next === locale) return;
      persistLanguageSelection(next);
      router.refresh();
    },
    [locale, router],
  );

  /* focus moves to Back once, when the view opens — not again when the language changes */
  useEffect(() => {
    backRef.current?.focus();
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onBack();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <section data-settings="language-view" aria-labelledby={`${id}-title`}>
      <div className={styles.subHead}>
        <button ref={backRef} type="button" data-settings="language-back" className={styles.back} onClick={onBack}>
          {backLabel}
        </button>
      </div>
      <h3 id={`${id}-title`} className={styles.subTitle}>
        {nav.language}
      </h3>
      <div role="radiogroup" aria-labelledby={`${id}-title`} className={styles.card}>
        {SELECTABLE_LOCALES.map((option) => (
          <label key={option} className={styles.option} data-language-option={option}>
            <input
              type="radio"
              name={`${id}-language`}
              value={option}
              checked={locale === option}
              onChange={() => choose(option)}
            />
            <span lang={option} dir={DISPLAY_LOCALE_META[option].direction} className={styles.optionName}>
              {DISPLAY_LOCALE_META[option].endonym}
            </span>
            {/* the visible mark of the selected language (the radio carries it for assistive technology) */}
            {locale === option && (
              <span aria-hidden="true" data-language-selected="" className={styles.optionCheck}>
                ✓
              </span>
            )}
          </label>
        ))}
      </div>
      <p className={styles.footnote}>{g.themeSaved}</p>
    </section>
  );
}

/**
 * ASK R3 SETTINGS-NAV ENGINEERING §2 (2a, frame 13) — the Appearance sub-view: "‹ Settings",
 * the title, a radiogroup of Light · Dark · System · Scheduled with the existing ThemeControl
 * labels and notes (so the Scheduled note is the one ThemeControl itself shows), the Scheduled
 * hours exactly as ThemeControl edits them, and "Saved on this device." Choosing writes the same
 * theme cookie; no request. Escape returns to the Settings list.
 */
export function AskAppearanceView({
  locale,
  backLabel,
  onBack,
}: {
  readonly locale: DisplayLocale;
  readonly backLabel: string;
  readonly onBack: () => void;
}): JSX.Element {
  const scope = useContext(ThemeScopeContext);
  const preference = useThemePreference(scope ?? 'system');
  const schedule = useThemeSchedule();
  const t = askDictionary(locale).homeR1.theme;
  const g = askSettingsR2Strings(locale);
  const id = useId();
  const backRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    backRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onBack();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <section data-settings="appearance-view" aria-labelledby={`${id}-title`}>
      <div className={styles.subHead}>
        <button ref={backRef} type="button" data-settings="appearance-back" className={styles.back} onClick={onBack}>
          {backLabel}
        </button>
      </div>
      <h3 id={`${id}-title`} className={styles.subTitle}>
        {g.appearance}
      </h3>
      <div role="radiogroup" aria-labelledby={`${id}-title`} className={styles.card}>
        {THEME_PREFERENCES.map((option) => (
          <label key={option} className={styles.option}>
            <input
              type="radio"
              name={`${id}-theme`}
              value={option}
              checked={preference === option}
              onChange={() => setThemePreference(option)}
              data-theme-option={option}
            />
            <span>
              {t[option]}
              {option === 'system' && <span className={styles.optionNote}>{t.systemNote}</span>}
              {option === 'scheduled' && <span className={styles.optionNote}>{t.scheduledNote}</span>}
            </span>
          </label>
        ))}
        {preference === 'scheduled' && (
          <div className={styles.schedule} data-theme-schedule="">
            {(['lightFrom', 'darkFrom'] as const).map((edge) => (
              <label key={edge}>
                {t[edge]}
                <input
                  type="time"
                  step={300}
                  value={schedule[edge]}
                  data-theme-schedule-edge={edge}
                  onChange={(event) => {
                    const value = event.target.value.slice(0, 5);
                    if (!isValidClockTime(value)) return;
                    const next = { ...schedule, [edge]: value };
                    if (next.lightFrom === next.darkFrom) return;
                    setThemePreference('scheduled', next);
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </div>
      <p className={styles.footnote}>{g.themeSaved}</p>
    </section>
  );
}
