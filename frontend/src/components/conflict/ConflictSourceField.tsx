import type { JSX } from 'react';
import type { ConflictObservation } from '@globalnews-ai/shared';
import { reportingOutlets, UCDP_LICENCE } from '@/lib/ask/askExploreRegions';
import { sourceHref } from '@/lib/conflict/retained';

/** The dataset's proper name (not translated) for each upstream authority. */
const CONFLICT_AUTHORITY_NAME: Readonly<Record<string, string>> = { UCDP_GED: 'UCDP GED' };

/**
 * E1 R135 addendum 02 §3 (R135-C2) — the selected record's "Source": the DATASET and its licence.
 * Never `sourceReference.citation`: UCDP records the reporting outlet's headline in it, and UCDP's
 * CC BY 4.0 licenses UCDP's own data, not that publisher's expression. The outlet NAMES
 * (`reportingOffice`, social handles dropped) and the record's own source link stay.
 */
export function ConflictSourceField({
  row,
  sourceLabel,
}: {
  readonly row: ConflictObservation;
  readonly sourceLabel: string;
}): JSX.Element {
  const href = sourceHref(row.sourceReference.sourceUrl);
  const outlets = reportingOutlets(row.sourceReference.reportingOffice);
  return (
    <div>
      <dt>{sourceLabel}</dt>
      <dd data-conflict="source-dataset">
        <span lang="en" dir="ltr">
          {CONFLICT_AUTHORITY_NAME[row.identity.authority] ?? row.identity.authority}
        </span>
        {' · '}
        <a
          href={UCDP_LICENCE.href}
          target="_blank"
          rel="noopener noreferrer"
          lang="en"
          dir="ltr"
          data-conflict="source-licence"
          className="text-sp-cyan underline"
        >
          {UCDP_LICENCE.name}
        </a>
      </dd>
      {/* outlet NAMES only — social handles (a person's account) are not outlets (as in Ask, R135) */}
      {outlets.length > 0 && <dd data-conflict="source-outlets">{outlets.join(', ')}</dd>}
      {href && (
        <dd>
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sp-cyan underline">
            {sourceLabel}
          </a>
        </dd>
      )}
    </div>
  );
}
