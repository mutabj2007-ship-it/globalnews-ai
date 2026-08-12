import type { SourceDiversity } from '@globalnews-ai/shared';

interface SourceDiversitySummaryProps {
  sourceDiversity?: SourceDiversity;
  isMock: boolean;
}

interface SourceDiversityText {
  primary: string;
  detail: string[];
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * Milestone #44 — pure text-selection logic, isolated from JSX for
 * testability. NEVER uses "independent", "verified", or any wording
 * implying editorial independence — sourceDiversity (Milestone #43) is
 * structural metadata only, and this function's entire vocabulary is
 * built from bounded, structural terms (retrieved/cluster/domain/source
 * name) to match that.
 *
 * MOCK CASE: sourceDiversity can describe mock fixture structure, but
 * that is never genuine real-world evidence breadth. When isMock is
 * true, the summary is explicitly demo-qualified and detail metrics are
 * omitted entirely (the CTO-approved "alternatively simplify" option) —
 * a single clearly-labeled demo line is less noisy than a full detail
 * section built from meaningless mock counts.
 */
export function resolveSourceDiversityText(
  sourceDiversity: SourceDiversity | undefined,
  isMock: boolean,
): SourceDiversityText | undefined {
  if (!sourceDiversity) return undefined;

  if (isMock) {
    return {
      primary: `Demo data: ${plural(sourceDiversity.retrievedArticleCount, 'retrieved article')}, ${plural(sourceDiversity.reportingClusterCount, 'reporting cluster')}`,
      detail: [],
    };
  }

  const primary = `${plural(sourceDiversity.retrievedArticleCount, 'retrieved article')} · ${plural(sourceDiversity.reportingClusterCount, 'reporting cluster')}`;

  const detail: string[] = [
    plural(sourceDiversity.duplicateLikeClusterCount, 'duplicate-like cluster'),
    `Largest cluster: ${plural(sourceDiversity.largestClusterSize, 'article')}`,
    plural(sourceDiversity.knownDomainCount, 'known domain'),
    ...(sourceDiversity.unknownDomainArticleCount > 0
      ? [`${plural(sourceDiversity.unknownDomainArticleCount, 'article')} with unrecognized URLs`]
      : []),
    plural(sourceDiversity.distinctSourceNameCount, 'distinct source name'),
  ];

  return { primary, detail };
}

/**
 * Milestone #44 — renders M43's structural retrieval metadata without
 * claiming editorial independence. Renders nothing when sourceDiversity
 * is absent (per the approved contract — never fabricated).
 */
export function SourceDiversitySummary({
  sourceDiversity,
  isMock,
}: SourceDiversitySummaryProps): JSX.Element | null {
  const text = resolveSourceDiversityText(sourceDiversity, isMock);
  if (!text) return null;

  return (
    <div className="mt-3 flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
        {text.primary}
      </span>

      {text.detail.length > 0 && (
        <details>
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
            Retrieval detail
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {text.detail.map((line) => (
              <li key={line} className="text-[11px] text-ink-tertiary">
                {line}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
