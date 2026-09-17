'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import { ACTIVE_LANGUAGES, LANGUAGE_NATIVE_LABELS } from '@/lib/i18n/languages';
import { BAND_ACTIVE, BAND_AVAILABLE } from '@/lib/map/spatial/controlBands';

/**
 * CHECKPOINT F — MAP-GLOBAL-LANGUAGE-CONTROL-1.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 *
 * The Spatial shell does not mount the product `NavBar` at any width — C-O
 * ruled that a second bar above a full-screen composition duplicates the brand
 * and costs the map a tenth of the screen, which is right. But the NavBar was
 * also the only EN/PL control in the product, so on `/map` the language could
 * be READ (the route resolves it from the cookie server-side) and never
 * CHANGED. A bilingual product with a page you cannot switch language on.
 *
 * ── WHY THIS IS NOT THE RELEASED LanguageSelector ─────────────────────────
 *
 * `LanguageSelector` is released Claude Design chrome (GN-CD-M66.11) with two
 * accepted variants, built from `cd-*` tokens: a 9 px pill, a 13 px label, a
 * 168 px popup and 40 px rows. The HUD is a 44 px mono bar in `sp-*` tokens.
 * Hosting that control here would need a THIRD variant of a released
 * component — which is inventing chrome, and the ruling forbids inventing
 * branding without an accepted contract.
 *
 * ── SO THIS REUSES A GRAMMAR THIS BAR ALREADY HAS ─────────────────────────
 *
 * The ruling permits "improve information hierarchy using accepted semantic
 * grammar only". The period chips beside this control are already a segmented
 * radiogroup in this exact bar: one hairline border, 1 px gaps, 9.5 px mono,
 * the ACTIVE and AVAILABLE bands. Language is the same KIND of choice — a small
 * closed set, one of which is current — so it takes the same form. Nothing new
 * is drawn; no token, radius, size or colour is introduced.
 *
 * ── AND PERSISTENCE IS THE CALLER'S, AS IT IS FOR THE RELEASED CONTROL ────
 *
 * This component holds no cookie, no storage, no router and no fetch. It calls
 * `onChange` and nothing else, exactly as `LanguageSelector` does, so there is
 * ONE persistence path in the product and this is not a second one.
 *
 * `ACTIVE_LANGUAGES` remains the only source of which languages exist and
 * `LANGUAGE_NATIVE_LABELS` the only source of their names — no endonym appears
 * as a literal here, which is the rule the released selector also keeps.
 */

export interface MapLanguageControlProps {
  readonly value: LanguageCode;
  readonly onChange: (language: LanguageCode) => void;
  /** The group's accessible name — map.topBar.languageGroup. */
  readonly label: string;
  readonly className?: string;
}

export function MapLanguageControl({
  value,
  onChange,
  label,
  className = '',
}: MapLanguageControlProps): JSX.Element {
  return (
    <div
      data-gn="hud-language"
      role="radiogroup"
      aria-label={label}
      className={`flex shrink-0 gap-px overflow-hidden rounded-[2px] border border-sp-line ${className}`}
    >
      {ACTIVE_LANGUAGES.map((code) => {
        const active = code === value;

        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            data-gn="language-chip"
            data-gn-language={code}
            /*
              THE CODE IS THE LABEL, THE ENDONYM IS THE NAME.
              A 44 px bar has room for "EN", and "EN" is what a reader scanning
              a HUD recognises. The accessible name carries the language's own
              name in full, so nobody has to know that EN means English.
            */
            aria-label={LANGUAGE_NATIVE_LABELS[code]}
            onClick={() => {
              /*
                Re-selecting the current language is a no-op HERE, mirroring
                NavBar's own `if (next === language) return;` guard. Without it
                every click would write the cookie and refresh the route.
              */
              if (code === value) return;
              onChange(code);
            }}
            /*
              The period chips' own class string, unchanged: both borders are
              suppressed inside the segmented group because two borders one
              pixel apart read as a rendering fault rather than as emphasis.
            */
            className={`shrink-0 border-transparent px-[9px] py-[6px] font-gn-mono text-[9.5px] tracking-[0.1em] ${
              active ? BAND_ACTIVE : `${BAND_AVAILABLE} !border-transparent !bg-transparent`
            }`}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
