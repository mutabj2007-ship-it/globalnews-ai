import type { JSX } from 'react';
import { safeExternalHref, type NewsArticle } from '@globalnews-ai/shared';
import { LICENCE_NAMES, licenceAttributionStrings } from '@/lib/i18n/licenceAttributionStrings';

/**
 * E1 V7 C-B1 — THE LICENCE CREDIT LINE, rendered in code at the render seam.
 *
 * The four CC BY 3.0 conditions plus the publisher's house rule, for one article:
 *   "Written by <author> · <publisher> · Original article · Licence: CC BY 3.0 · Headline shown unchanged"
 * - the author comes only from the article's own `authorName` (an admission verdict on its page);
 * - "Original article" links the canonical URL the page itself declared (`url`);
 * - the licence links the exact deed the item carries (a wrong deed is itself a breach);
 * - the change notice says the headline is unchanged — this surface shows nothing else of the text.
 *
 * FAIL CLOSED: an article missing any of author / licence id / licence URL, or carrying a licence id
 * this component cannot name, renders NOTHING — and its caller must then not render the item either
 * (`isFullyCredited`). The author's name is isolated with <bdi> in markup, never with characters.
 */
export function isFullyCredited(article: NewsArticle): boolean {
  return (
    typeof article.authorName === 'string' &&
    article.authorName.trim().length > 0 &&
    typeof article.licenseId === 'string' &&
    LICENCE_NAMES[article.licenseId] !== undefined &&
    typeof article.licenseUrl === 'string' &&
    safeExternalHref(article.licenseUrl) !== undefined &&
    safeExternalHref(article.url) !== undefined
  );
}

export function LicenceAttribution({
  article,
  language,
}: {
  readonly article: NewsArticle;
  readonly language: string;
}): JSX.Element | null {
  if (!isFullyCredited(article)) return null;
  const t = licenceAttributionStrings(language);
  return (
    <p data-licence-attribution="" className="text-[12px] leading-[1.5] text-[var(--gt-ink2)]">
      <span>
        {t.writtenBy} <bdi data-credit-author="">{article.authorName}</bdi>
      </span>
      <span aria-hidden="true"> · </span>
      <span data-credit-publisher="">{article.sourceName}</span>
      <span aria-hidden="true"> · </span>
      <a data-credit-original="" href={safeExternalHref(article.url)} target="_blank" rel="noopener noreferrer" className="underline">
        {t.original}
      </a>
      <span aria-hidden="true"> · </span>
      <span>
        {t.licence}:{' '}
        <a data-credit-licence="" href={safeExternalHref(article.licenseUrl)} target="_blank" rel="noopener noreferrer license" className="underline">
          {LICENCE_NAMES[article.licenseId!]}
        </a>
      </span>
      <span aria-hidden="true"> · </span>
      <span data-credit-changes="">{t.unchanged}</span>
    </p>
  );
}
