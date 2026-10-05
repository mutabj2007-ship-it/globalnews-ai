import type { SurfaceLocale } from '@/lib/i18n/surfaceLocale';

/**
 * T2 · THE DECLARED FALLBACK, VISIBLE.
 *
 * Rendered once, by the root layout, only when the current surface fell back to English because
 * the reader's selected locale is not complete for it. The text is in the SELECTED language and
 * carries that language's own `lang`/`dir`, so assistive technology reads it correctly inside an
 * English (`<html lang="en" dir="ltr">`) document. Renders nothing otherwise — no element, no
 * text node — so a surface that renders its selected locale is byte-identical to before.
 */
export function DisplayLocaleNotice({ locale }: { locale: SurfaceLocale }): JSX.Element | null {
  if (locale.notice === null) return null;
  return (
    <p
      role="status"
      lang={locale.notice.lang}
      dir={locale.notice.dir}
      data-locale-fallback={locale.requested}
      data-locale-effective={locale.effective}
      data-locale-surface={locale.surface}
      className="w-full border-b border-white/10 bg-void px-4 py-1.5 text-center text-xs text-ink-secondary"
    >
      {locale.notice.notice}
    </p>
  );
}
