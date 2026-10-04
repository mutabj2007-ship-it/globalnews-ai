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
          {section.note !== null && (
            <p className="font-mono text-[11px] text-[#8fa6c0]">{section.note}</p>
          )}
          <ul className="flex flex-col gap-1">
            {section.rows.map((row) => (
              <li
                key={row.reference}
                data-ask="intelligence-row"
                className="text-[13.5px] leading-[1.45] text-[#cfe2f2]"
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
                {' · '}
                {safeExternalHref(row.sourceUrl) !== undefined ? (
                  <a
                    href={safeExternalHref(row.sourceUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-[#1d4a73] underline-offset-4"
                  >
                    {row.sourceName}
                  </a>
                ) : (
                  <span>{row.sourceName}</span>
                )}
                {(row.parties !== null || row.cited !== null) && (
                  <span className="block font-mono text-[11px] text-[#8299b4]">
                    {row.parties !== null && `${s.parties}: ${row.parties}`}
                    {row.parties !== null && row.cited !== null && ' · '}
                    {row.cited !== null && `${s.cited}: ${row.cited}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {section.caveats.map((caveat) => (
            <p key={caveat} className="font-mono text-[11px] text-[#8fa6c0]">
              {caveat}
            </p>
          ))}
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
