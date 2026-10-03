import { safeExternalHref } from '@globalnews-ai/shared';
import type { AnalysisSourceRef, LanguageCode } from '@globalnews-ai/shared';
import type { AskComparisonTable } from '@/lib/api/askV2Api';

/**
 * ═══ R2-S1 · THE EVIDENCE-LINKED COMPARISON TABLE ═══════════════════════════
 *
 * Renders the server's deterministic `comparisonTable` projection (backend
 * ask-v2/comparison-table.ts): rows the validated answer already holds — its
 * agreements and the positions of its differences — each with the sources that
 * support it. Nothing is composed or re-worded here, and no row is invented: a
 * row is shown exactly as projected, a citation number is the source's position
 * in `analysis.sources` (the number the Sources list prints), and an id that is
 * not in that list is never shown.
 *
 * Accessible: a real <table> with a caption, column headers and row headers;
 * on a phone each row stacks into a labelled block instead of scrolling sideways.
 */
const STRINGS = {
  en: {
    caption: 'What the reports say, point by point',
    point: 'Point',
    reported: 'Reported',
    sources: 'Sources',
    agreement: 'Reports agree',
    citation: (n: number) => `Source ${n}`,
    omitted: (n: number) =>
      n === 1
        ? '1 point is not shown because no listed source supports it.'
        : `${n} points are not shown because no listed source supports them.`,
  },
  pl: {
    caption: 'Co mówią źródła, punkt po punkcie',
    point: 'Kwestia',
    reported: 'Według źródeł',
    sources: 'Źródła',
    agreement: 'Źródła są zgodne',
    citation: (n: number) => `Źródło ${n}`,
    omitted: (n: number) =>
      n === 1
        ? 'Nie pokazano 1 punktu, bo żadne z wymienionych źródeł go nie potwierdza.'
        : `Nie pokazano punktów: ${n}, bo żadne z wymienionych źródeł ich nie potwierdza.`,
  },
} as const;

export function AskEvidenceTable({
  table,
  sources,
  language,
}: {
  readonly table: AskComparisonTable | null | undefined;
  readonly sources: readonly AnalysisSourceRef[];
  readonly language: LanguageCode;
}): JSX.Element | null {
  if (!table || table.schema !== 'ask-comparison-table/1' || table.rows.length < 2) return null;
  const t = language === 'pl' ? STRINGS.pl : STRINGS.en;
  const numbered = (ids: readonly string[]) =>
    ids
      .map((id) => sources.findIndex((s) => s.articleId === id))
      .filter((i) => i >= 0)
      .map((i) => ({ n: i + 1, source: sources[i] }))
      .sort((a, b) => a.n - b.n);
  const rows = table.rows
    .map((row, index) => ({ row, index, cites: numbered(row.sourceArticleIds) }))
    .filter((r) => r.cites.length > 0);
  if (rows.length < 2) return null;

  return (
    <div data-ask="evidence-table" className="flex flex-col gap-2">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="mb-2 text-left font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
          {t.caption}
        </caption>
        <thead className="sr-only sm:not-sr-only">
          <tr className="border-b border-white/10">
            <th scope="col" className="py-2 pe-3 text-xs font-semibold text-ink-tertiary">
              {t.point}
            </th>
            <th scope="col" className="py-2 pe-3 text-xs font-semibold text-ink-tertiary">
              {t.reported}
            </th>
            <th scope="col" className="py-2 text-xs font-semibold text-ink-tertiary">
              {t.sources}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, index, cites }) => (
            <tr
              key={index}
              data-ask="evidence-row"
              data-row-kind={row.kind}
              className="block border-b border-white/10 py-2 sm:table-row sm:py-0"
            >
              <th
                scope="row"
                className="block pe-3 align-top text-xs font-semibold text-ink-secondary sm:table-cell sm:py-2"
              >
                {row.kind === 'AGREEMENT' ? t.agreement : (row.topic ?? '')}
              </th>
              <td className="block pe-3 align-top text-ink-primary sm:table-cell sm:py-2">
                {row.statement}
              </td>
              <td className="block align-top sm:table-cell sm:py-2">
                <span className="sr-only sm:hidden">{t.sources}: </span>
                {cites.map(({ n, source }) => (
                  <a
                    key={n}
                    data-ask="evidence-citation"
                    data-citation={n}
                    href={safeExternalHref(source.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.citation(n)}
                    className="me-1 font-mono text-[11px] text-signal hover:underline"
                  >
                    [{n}]
                  </a>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {table.omittedRows > 0 ? (
        <p data-ask="evidence-table-omitted" className="text-xs text-ink-tertiary">
          {t.omitted(table.omittedRows)}
        </p>
      ) : null}
    </div>
  );
}
