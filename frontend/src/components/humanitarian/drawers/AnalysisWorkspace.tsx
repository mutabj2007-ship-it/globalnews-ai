/**
 * PART X · HUMANITARIAN — THE ANALYSIS WORKSPACE, RENDERED.
 *
 * WHAT IT RENDERS. One row per dimension, in the projection's order: a carried
 * dimension shows the publisher-stated attribute and the records it came from; an empty
 * one shows the reason it is empty. There is no third presentation, because there is no
 * third state a reader could be in.
 *
 * WHAT IT CANNOT DO. It cannot compute. There is no `analyzeNews`, no `askV2Api`, no
 * fetch and no provider in this file or in `humWorkspace`. "Ask about this humanitarian
 * situation" KEEPS a question and navigates to `/ask`, where the existing composer
 * drafts it and the reader presses Send — one ordinary turn on the one Ask engine, on an
 * explicit action, in the reader's own words. Nothing is sent from here.
 *
 * WHY DEEP ANALYSIS IS STILL DISABLED. R15 stands: with no cost estimate the control is
 * disabled and says so. An ordinary Ask turn has no quote to state, which is exactly why
 * the Ask handoff may be live while Deep analysis may not. The two are different
 * controls for that reason and not by oversight.
 */
import type { JSX } from 'react';
import type { HumanitarianAnalysisWorkspace } from '@globalnews-ai/shared';
import { humanitarianAskHandoff } from '@globalnews-ai/shared';
import { HUM_INK, HUM_LICENSED, HUM_LINE, HUM_MONO, HUM_TYPE } from '@/lib/humanitarian/humTokens';
import { HUM_HIT_TARGET_PX } from '@/lib/humanitarian/humConfig';
import {
  humAskQuestion,
  humAskUnavailableLabel,
  humDimensionLabel,
  humEmptyReasonLabel,
  humStoredAnalysisHref,
  humWorkspaceRows,
} from '@/lib/humanitarian/humWorkspace';
import { keepQuestion } from '@/lib/ask/askKeptQuestion';
import type { HumLocale, HumStrings } from '@/lib/humanitarian/humStrings';
import { SectionTitle, microLabel } from '../HumParts';

export function AnalysisWorkspace({
  workspace,
  t,
  locale,
  storedOperationId = null,
}: {
  workspace: HumanitarianAnalysisWorkspace;
  t: HumStrings;
  locale: HumLocale;
  /** An owned, stored Ask operation for this situation. `null` today, and stated as such. */
  storedOperationId?: string | null;
}): JSX.Element {
  const rows = humWorkspaceRows(workspace);
  const composition = humAskQuestion(humanitarianAskHandoff(workspace), locale);
  const storedHref = humStoredAnalysisHref(storedOperationId);

  return (
    <div
      data-hum="analysis-workspace"
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
    >
      <SectionTitle note={t.workspace.subtitle}>{t.workspace.title}</SectionTitle>

      <ol
        data-hum="workspace-dimensions"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {rows.map((row) => (
          <li
            key={row.id}
            data-hum="workspace-dimension"
            data-hum-dimension={row.id}
            data-hum-state={row.state}
            data-hum-absence={row.absence ?? ''}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              borderTop: `1px solid ${HUM_LINE.hairline}`,
              paddingTop: '8px',
            }}
          >
            <span style={{ fontSize: HUM_TYPE.body, color: HUM_INK.primary }}>
              {humDimensionLabel(t, row.id)}
            </span>

            {row.state === 'EMPTY' && (
              <span
                data-hum="workspace-absence"
                data-hum-store={row.storeState ?? ''}
                style={{ ...microLabel, color: HUM_INK.tertiary }}
              >
                {humEmptyReasonLabel(t, row)}
              </span>
            )}

            {row.state === 'DERIVED' && (
              <>
                <span style={{ ...microLabel, color: HUM_INK.tertiary }}>
                  {t.workspace.unknownRoster}
                </span>
                <span
                  data-hum="workspace-unknown-roster"
                  style={{ ...microLabel, color: HUM_INK.secondary }}
                >
                  {row.derivedFrom.map((id) => humDimensionLabel(t, id)).join(' · ')}
                </span>
              </>
            )}

            {row.state === 'CARRIED' &&
              row.claims.map((claim) => (
                <span
                  key={`${row.id}:${claim.attribute}:${claim.records[0]?.observationKey ?? ''}`}
                  data-hum="workspace-claim"
                  data-hum-claim-class={claim.claimClass}
                  style={{ ...microLabel, color: HUM_INK.secondary, fontFamily: HUM_MONO }}
                >
                  {claim.attribute}
                  {claim.value === null ? '' : ` · ${String(claim.value)}`}
                  {claim.unit === null ? '' : ` ${claim.unit}`} · {t.workspace.statedBy} ·{' '}
                  {t.workspace.recordsFrom} {claim.records.length}
                </span>
              ))}
          </li>
        ))}
      </ol>

      {/* ── THE ASK HANDOFF. Navigation plus a kept draft. Never a send. ──── */}
      {composition.available ? (
        <a
          data-hum="workspace-ask"
          data-hum-ask="available"
          href="/ask"
          onClick={() => {
            keepQuestion(composition.question);
          }}
          style={{
            minHeight: `${HUM_HIT_TARGET_PX}px`,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 14px',
            alignSelf: 'flex-start',
            textDecoration: 'none',
            border: `1px solid ${HUM_LICENSED.sand}`,
            color: HUM_INK.secondary,
            fontSize: HUM_TYPE.monoMeta,
            textTransform: 'uppercase',
          }}
        >
          {t.workspace.askAbout}
        </a>
      ) : (
        <span
          data-hum="workspace-ask"
          data-hum-ask="unavailable"
          data-hum-ask-refusal={composition.refusal}
          style={{ ...microLabel, color: HUM_INK.tertiary }}
        >
          {t.workspace.askAbout} — {humAskUnavailableLabel(t, composition.refusal)}
        </span>
      )}

      {/* ── OPENING A STORED RESULT. Display only; no rerun. ──────────────── */}
      {storedHref === null ? (
        <span
          data-hum="workspace-stored"
          data-hum-stored="unavailable"
          style={{ ...microLabel, color: HUM_INK.tertiary }}
        >
          {t.workspace.openStoredUnavailable}
        </span>
      ) : (
        <a
          data-hum="workspace-stored"
          data-hum-stored="available"
          href={storedHref}
          title={t.workspace.displayOnly}
          style={{ ...microLabel, color: HUM_INK.secondary }}
        >
          {t.workspace.openStored}
        </a>
      )}
      <span style={{ ...microLabel, color: HUM_INK.tertiary }}>{t.workspace.displayOnly}</span>
    </div>
  );
}
