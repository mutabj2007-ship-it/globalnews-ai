'use client';

import { useCallback, useContext, useEffect, useId, useRef, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { persistLanguageSelection } from '@/lib/i18n/languages';
import { LanguageSelector } from '@/components/search/LanguageSelector';
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
}: {
  readonly locale: DisplayLocale;
  readonly onOpenAppearance: () => void;
}): JSX.Element {
  const scope = useContext(ThemeScopeContext);
  const preference = useThemePreference(scope ?? 'system');
  const router = useRouter();
  const nav = askShellStrings(locale).askNavStrings;
  const g = askSettingsR2Strings(locale);
  const theme = askDictionary(locale).homeR1.theme;
  const changeLanguage = useCallback(
    (next: DisplayLocale): void => {
      if (next === locale) return;
      persistLanguageSelection(next);
      router.refresh();
    },
    [locale, router],
  );
  return (
    <section data-ask="settings-preferences" aria-labelledby="ask-settings-preferences">
      {/* SUPERSEDED heading: askR3FullStrings(locale).preferencesHeading */}
      <h3 id="ask-settings-preferences" className={styles.groupHeading}>
        {g.langApp}
      </h3>
      <div className={styles.card}>
        <div className={styles.row} data-settings="language-row">
          <span className={styles.rowLabel}>{nav.language}</span>
          <LanguageSelector
            value={locale}
            onChange={changeLanguage}
            label={nav.language}
            actionLabel={nav.languageSelectorAction}
            variant="mobile"
            anchor="self"
          />
        </div>
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
