import { HistoryClient } from '@/components/history/HistoryClient';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';

/**
 * T2 · /history reads its locale from the display-locale authority. `historyStrings` is English
 * only, so a non-English selection renders English with the declared notice (root layout) until
 * Claude L's wording lands — instead of the silent English this page used to render.
 */
export default function HistoryPage(): JSX.Element {
  const locale = surfaceLocale('history');
  return <HistoryClient locale={locale.effective} language={locale.language} />;
}
