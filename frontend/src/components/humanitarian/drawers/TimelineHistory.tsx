'use client';

/**
 * H-09 · TIMELINE — the history of the understanding, which does not exist yet.
 *
 * MEASURED: `AssessmentRevision` and `revisionId` occur ZERO times in all of
 * shared/src. Without a citable revision identity there is no entry to draw, and
 * Part X is explicit that superseded text is "stated as unavailable rather than
 * reconstructed". So this states the absence and reconstructs nothing.
 *
 * History is always free to read — 0 SAND — and remains so when there is none.
 */
import type { JSX } from 'react';
import { HUM_INK } from '@/lib/humanitarian/humTokens';
import { Absence, Dependency, SectionTitle, microLabel } from '../HumParts';
import type { HumStrings } from '@/lib/humanitarian/humStrings';
import type { HumSituationView } from '../HumanitarianModel';

export function TimelineHistory({ view, t }: { view: HumSituationView; t: HumStrings }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <SectionTitle note={t.timeline.historyOfUnderstanding}>{t.timeline.title}</SectionTitle>

      <Absence reason="AWAITING_SHARED_CONTRACT" t={t} note={t.timeline.unavailable} />

      {/*
        The revision identity is NULL on the model, and it is rendered as null rather
        than as a placeholder id. A fabricated "r1" would be a citation to nothing.
      */}
      <span data-hum="revision-identity" data-hum-revision="absent" style={{ ...microLabel, color: HUM_INK.tertiary }}>
        {t.zoneA.revision}: {t.common.noData}
      </span>

      <Dependency t={t} text="Assessment Revision schema — exact revision identity and field names for Timeline entries and revision-pinned export. Shared, and the highest blast radius of the outstanding items." />
    </div>
  );
}
