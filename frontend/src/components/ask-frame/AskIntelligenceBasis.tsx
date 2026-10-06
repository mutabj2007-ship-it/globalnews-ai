import { safeExternalHref, type DisplayLocale } from '@globalnews-ai/shared';
import type { AskR2Payload } from '@/lib/api/askV2Api';
import { askIntelligenceView } from '@/lib/ask/askIntelligenceView';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/**
 * ASK INTELLIGENCE BINDING R1 — the governed structured part of ONE Ask answer, inside the
 * existing turn: a "Based on" line, compact provenance rows per contributor actually used, a
 * place-context line and honest notes. Not a dashboard card, no Map, no module links.
 */
export function AskIntelligenceBasis({
  payload,
  locale,
  reportingSourceCount,
  hideNotes = false,
}: {
  readonly payload: AskR2Payload;
  readonly locale: DisplayLocale;
  readonly reportingSourceCount: number;
  /** LIVE ACCEPTANCE REPAIR R1 — the notes already ARE the answer (a stated absence). */
  readonly hideNotes?: boolean;
}): JSX.Element | null {
  const s = askShellStrings(locale).askIntelligenceStrings;
  const view = askIntelligenceView(payload, s, reportingSourceCount);
  if (view === null) return null;
  return (
    <section data-ask="intelligence" className="mt-4 flex flex-col gap-3">
      {view.basedOn !== null && (
        <p data-ask="based-on" className="font-mono text-[12px] leading-[1.5] text-[#8fa6c0]">
          {`${s.basedOn}: ${view.basedOn.join(' · ')}`}
        </p>
      )}
      {view.place !== null && (
        <p data-ask="place-context" className="font-mono text-[12px] text-[#8fa6c0]">
          {`${s.placeContext}: ${view.place}`}
        </p>
      )}
      {view.sections.map((section) => (
        <div
          key={section.contributorId}
          data-ask="intelligence-section"
          data-contributor={section.contributorId}
          className="flex flex-col gap-1.5 rounded-[10px] border border-[#1d4a73] px-3.5 py-3"
        >
          <p className="text-[14px] font-semibold text-[#e6eef6]">{section.title}</p>
          {/* ASK R2 — what these records ARE (retained, dated, not current reporting) and their
              limits come FIRST, before any record (Alpha 2026-10-06: the historical-date
              limitation appeared only after a long list). */}
          {section.note !== null && (
            <p className="font-mono text-[11px] text-[#8fa6c0]">{section.note}</p>
          )}
          {section.caveats.map((caveat) => (
            <p key={caveat} className="font-mono text-[11px] text-[#8fa6c0]">
              {caveat}
            </p>
          ))}
          {/* ASK R2 — dated background is EXPANDABLE, never a dump in the main answer: a compact
              summary (how many records, which period), the rows on request. */}
          <details data-ask="intelligence-records" className="group">
            <summary className="cursor-pointer list-none font-mono text-[12px] text-[#7cc4f5] underline-offset-2 hover:underline">
              {recordsSummary(section.rows)}
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1">
              {section.rows.map((row) => (
                <li
                  key={row.reference}
                  data-ask="intelligence-row"
                  className="break-words text-[13.5px] leading-[1.45] text-[#cfe2f2]"
                >
                  <span className="font-mono text-[12px] text-[#8299b4]">{row.period}</span>
                  {row.place !== null && (
                    <>
                      {' · '}
                      <span data-ask="intelligence-place" className="font-semibold">
                        {row.place}
                      </span>
                    </>
                  )}
                  {' · '}
                  {row.label}
                  {row.value !== null && <strong className="ms-1">{row.value}</strong>}
                  {/* one source shared by every row is named once, below — not on each row */}
                  {sharedSource(section.rows) === null && (
                    <>
                      {' · '}
                      <SourceLink name={row.sourceName} url={row.sourceUrl} />
                    </>
                  )}
                  {(row.parties !== null || row.cited !== null) && (
                    <span className="block font-mono text-[11px] text-[#8299b4]">
                      {row.parties !== null && `${s.parties}: ${row.parties}`}
                      {row.parties !== null && row.cited !== null && ' · '}
                      {row.cited !== null && `${s.cited}: ${compactCited(row.cited)}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
          {sharedSource(section.rows) !== null && (
            <p className="font-mono text-[11px] text-[#8fa6c0]">
              <SourceLink
                name={sharedSource(section.rows)!.sourceName}
                url={sharedSource(section.rows)!.sourceUrl}
              />
            </p>
          )}
        </div>
      ))}
      {(hideNotes ? [] : view.notes).map((note) => (
        <p key={note} data-ask="intelligence-note" className="text-[13px] text-[#8fa6c0]">
          {note}
        </p>
      ))}
    </section>
  );
}

type BasisRow = ReturnType<typeof askIntelligenceView> extends infer V
  ? V extends { sections: ReadonlyArray<{ rows: ReadonlyArray<infer R> }> }
    ? R
    : never
  : never;

/** ASK R2 — "5 · 2026-08-03 – 2026-08-29": how many records and the period they span. */
function recordsSummary(rows: readonly BasisRow[]): string {
  const periods = rows.map((r) => r.period).filter((p) => p !== '').sort();
  const span =
    periods.length === 0
      ? ''
      : periods[0] === periods[periods.length - 1]
        ? periods[0]
        : `${periods[0]} – ${periods[periods.length - 1]}`;
  return span === '' ? `${rows.length}` : `${rows.length} · ${span}`;
}

/** ASK R2 — the one source every row shares (e.g. UCDP), or null when rows differ. */
function sharedSource(rows: readonly BasisRow[]): BasisRow | null {
  const first = rows[0];
  if (first === undefined) return null;
  return rows.every((r) => r.sourceName === first.sourceName && r.sourceUrl === first.sourceUrl)
    ? first
    : null;
}

/** ASK R2 — cited outlets stay readable on a phone: the first three, then "+N". */
function compactCited(cited: string): string {
  const outlets = cited.split(' · ');
  return outlets.length <= 3 ? cited : `${outlets.slice(0, 3).join(' · ')} +${outlets.length - 3}`;
}

function SourceLink({ name, url }: { readonly name: string; readonly url: string | null }): JSX.Element {
  const href = url === null ? undefined : safeExternalHref(url);
  return href !== undefined ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-[#1d4a73] underline-offset-4">
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
}
