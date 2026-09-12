import type { LanguageCode } from '@globalnews-ai/shared';

/**
 * SPATIAL PRODUCTION PORT — SOURCE LANGUAGE FOR A DISPLAY LOCALE.
 *
 * SOURCE AUTHORITY: C55 `shared/src/language/`, `sourceLanguageFor()`. This is a
 * behaviour-identical frontend-local equivalent, written against the RELEASE
 * LINE's `LanguageCode` union so the Spatial surface can be brought to the
 * rolling release line without importing C55's shared language machinery.
 *
 * WHY A LOCAL COPY IS SAFE HERE, WHEN A METADATA TABLE WOULD NOT BE. This is a
 * pure total function over a CLOSED UNION the compiler enforces — no data
 * table, no state, no I/O, nothing that can silently drift. If `LanguageCode`
 * ever gains a member, this switch stops being exhaustive and the compiler
 * says so.
 *
 * BEHAVIOUR IS IDENTICAL TO C55 FOR EVERY INPUT THIS CONTRACT CAN PRODUCE, and
 * that was measured rather than assumed. C55 returns `undefined` explicitly for
 * 'de' and 'pt'; NEITHER EXISTS in the release line's `LanguageCode`, so those
 * branches are unreachable here. Every value that can actually arrive resolves
 * the same way in both implementations:
 *
 *     en -> en     pl -> pl     fr -> fr     es -> es     ar -> ar
 *     sw -> undefined          rw -> undefined
 *
 * `undefined` means "no localized country names for this locale", and the
 * caller falls back to the canonical name — which is exactly what the release
 * line already does everywhere, since only `en` and `pl` carry dictionaries.
 *
 * ONE AUTHORITY, DELIBERATELY. It lives in its own narrow module rather than
 * inside its single caller, so a second consumer cannot start a divergent copy.
 *
 * WHEN THE SHARED CONTRACT ARRIVES through a lane that owns it, delete this
 * module and import `sourceLanguageFor` from '@globalnews-ai/shared'. The
 * mapping must agree for every shared member at that point, or the two have
 * drifted.
 */
export function sourceLanguageFor(locale: LanguageCode): LanguageCode | undefined {
  switch (locale) {
    case 'en':
    case 'pl':
    case 'fr':
    case 'es':
    case 'ar':
      return locale;
    default:
      /* 'sw' and 'rw' — no localized country names; caller uses the canonical name. */
      return undefined;
  }
}
